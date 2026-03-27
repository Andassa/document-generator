import { parentPort } from 'worker_threads';
import type { Readable } from 'node:stream';
import PDFDocument from 'pdfkit';
import type { PdfWorkerStartMessage } from '../types/pdf';

if (!parentPort) {
  throw new Error('pdf.worker doit être exécuté dans un worker_threads');
}

const port = parentPort;

port.on('message', (raw: unknown) => {
  void runPdf(raw);
});

function isStartMessage(raw: unknown): raw is PdfWorkerStartMessage {
  if (typeof raw !== 'object' || raw === null) {
    return false;
  }
  const o = raw as { type?: unknown; title?: unknown; content?: unknown };
  return o.type === 'start' && typeof o.title === 'string' && typeof o.content === 'string';
}

async function runPdf(raw: unknown): Promise<void> {
  try {
    if (!isStartMessage(raw)) {
      port.postMessage({ type: 'error', message: 'Message de démarrage invalide' });
      return;
    }
    const msg = raw;
    const doc = new PDFDocument({ margin: 50 });
    doc.fontSize(18).text(msg.title, { underline: true });
    doc.moveDown();
    doc.fontSize(11).text(msg.content, { align: 'left' });
    doc.end();
    let total = 0;
    const readable = doc as unknown as Readable;
    for await (const chunk of readable) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buf.length;
      port.postMessage({ type: 'chunk', buf });
    }
    port.postMessage({ type: 'done', byteLength: total });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    port.postMessage({ type: 'error', message });
  }
}
