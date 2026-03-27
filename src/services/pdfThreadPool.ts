import fs from 'node:fs';
import { Worker } from 'worker_threads';
import path from 'path';
import { config } from '../config';

/**
 * En exécution compilée (`dist/`), il faut `pdf.worker.js` même si NODE_ENV=development dans `.env`.
 * Sinon le spawn pointe vers un `.ts` absent sous `dist/workers/` → aucun PDF, completed figé à 0.
 */
function resolveWorkerScriptPath(): string {
  const workersDir = path.join(__dirname, '..', 'workers');
  const jsPath = path.join(workersDir, 'pdf.worker.js');
  if (fs.existsSync(jsPath)) {
    return jsPath;
  }
  return path.join(workersDir, 'pdf.worker.ts');
}

function workerOptionsForPath(scriptPath: string): ConstructorParameters<typeof Worker>[1] {
  if (scriptPath.endsWith('.ts')) {
    return {
      execArgv: [...process.execArgv, '-r', 'ts-node/register/transpile-only'],
    };
  }
  return { execArgv: process.execArgv };
}

/**
 * Threads PDF réutilisés : le module `pdf.worker` n’est chargé qu’une fois par thread,
 * ce qui rend utile le cache de « template » (options PDFKit, amorçage).
 */
export class PdfThreadPool {
  private readonly scriptPath = resolveWorkerScriptPath();
  private readonly workerOpts = workerOptionsForPath(this.scriptPath);
  private readonly idle: Worker[] = [];
  private readonly waitAcquire: Array<(w: Worker) => void> = [];
  private live = 0;
  private readonly max: number;

  constructor(max: number) {
    this.max = max;
  }

  async acquire(): Promise<Worker> {
    const w = this.idle.pop();
    if (w) {
      return w;
    }
    if (this.live < this.max) {
      this.live++;
      return new Worker(this.scriptPath, this.workerOpts);
    }
    return new Promise((resolve) => {
      this.waitAcquire.push(resolve);
    });
  }

  release(w: Worker): void {
    const waiter = this.waitAcquire.shift();
    if (waiter) {
      waiter(w);
      return;
    }
    this.idle.push(w);
  }

  async discard(w: Worker): Promise<void> {
    await w.terminate().catch(() => undefined);
    this.live = Math.max(0, this.live - 1);
    while (this.waitAcquire.length > 0 && this.live < this.max) {
      this.live++;
      const nw = new Worker(this.scriptPath, this.workerOpts);
      this.waitAcquire.shift()!(nw);
    }
  }

  async shutdown(): Promise<void> {
    const all = [...this.idle.splice(0)];
    await Promise.all(all.map((w) => w.terminate().catch(() => undefined)));
  }
}

let pool: PdfThreadPool | undefined;

export function getPdfThreadPool(): PdfThreadPool {
  pool ??= new PdfThreadPool(config.PDF_THREAD_POOL_SIZE);
  return pool;
}

export async function shutdownPdfThreadPool(): Promise<void> {
  await pool?.shutdown();
  pool = undefined;
}
