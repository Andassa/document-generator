import { once } from 'node:events';
import { Worker } from 'worker_threads';
import path from 'path';
import type { GridFSBucketWriteStream } from 'mongodb';
import { ObjectId } from 'mongodb';
import { getGridFsBucket } from './gridfs.service';
import type { PdfJobPayload, PdfWorkerParentMessage, PdfWorkerStartMessage } from '../types/pdf';
import { pdfWorkerChunksTotal } from '../utils/metrics';
import type { Logger } from 'winston';

function resolveWorkerScriptPath(): string {
  const useJs = process.env.NODE_ENV === 'production';
  return path.join(__dirname, '..', 'workers', useJs ? 'pdf.worker.js' : 'pdf.worker.ts');
}

function workerOptionsForPath(scriptPath: string): ConstructorParameters<typeof Worker>[1] {
  if (scriptPath.endsWith('.ts')) {
    return {
      execArgv: [...process.execArgv, '-r', 'ts-node/register/transpile-only'],
    };
  }
  return { execArgv: process.execArgv };
}

function writeWithDrain(stream: GridFSBucketWriteStream, buf: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const ok = stream.write(buf, (err) => {
      if (err) {
        reject(err);
      }
    });
    if (ok) {
      resolve();
      return;
    }
    stream.once('drain', resolve);
  });
}

export async function streamPdfFromWorkerToGridFS(
  job: PdfJobPayload,
  logger: Logger,
): Promise<ObjectId> {
  const bucket = getGridFsBucket();
  const filename = `doc-${job.documentId}.pdf`;
  const uploadStream = bucket.openUploadStream(filename, {
    metadata: {
      documentId: job.documentId,
      batchId: job.batchId,
      correlationId: job.correlationId,
    },
  });
  const scriptPath = resolveWorkerScriptPath();
  const worker = new Worker(scriptPath, workerOptionsForPath(scriptPath));
  logger.info('Worker PDF démarré', { scriptPath, documentId: job.documentId });

  return await new Promise<ObjectId>((resolve, reject) => {
    let settled = false;
    let chain: Promise<void> = Promise.resolve();

    const fail = (err: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      void worker.terminate().catch(() => undefined);
      uploadStream.destroy(err);
      reject(err);
    };

    const succeed = (id: ObjectId): void => {
      if (settled) {
        return;
      }
      settled = true;
      void worker.terminate().catch(() => undefined);
      resolve(id);
    };

    uploadStream.on('error', (err: Error) => {
      logger.error('Erreur upload GridFS', { err });
      fail(err);
    });
    worker.on('error', (err: Error) => {
      logger.error('Erreur thread PDF', { err });
      fail(err);
    });
    worker.on('exit', (code) => {
      if (!settled && code !== 0) {
        fail(new Error(`Worker PDF terminé avec le code ${String(code)}`));
      }
    });

    worker.on('message', (raw: unknown) => {
      const msg = raw as PdfWorkerParentMessage;
      chain = chain
        .then(async () => {
          if (msg.type === 'chunk') {
            await writeWithDrain(uploadStream, msg.buf);
            pdfWorkerChunksTotal.inc();
            return;
          }
          if (msg.type === 'error') {
            throw new Error(msg.message);
          }
          if (msg.type === 'done') {
            uploadStream.end();
            await once(uploadStream, 'finish');
            const id = uploadStream.id;
            if (!id) {
              throw new Error('Identifiant GridFS manquant après écriture');
            }
            logger.info('PDF stocké dans GridFS', {
              documentId: job.documentId,
              gridFsFileId: id.toHexString(),
              byteLength: msg.byteLength,
            });
            succeed(id as ObjectId);
          }
        })
        .catch((err: unknown) => {
          const e = err instanceof Error ? err : new Error(String(err));
          fail(e);
        });
    });

    const start: PdfWorkerStartMessage = {
      type: 'start',
      title: job.title,
      content: job.content,
    };
    worker.postMessage(start);
  });
}
