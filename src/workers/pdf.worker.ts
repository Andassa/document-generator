import { parentPort } from 'worker_threads';
import type { Readable } from 'node:stream';
import PDFDocument from 'pdfkit';
import type { PdfWorkerStartMessage } from '../types/pdf';

if (!parentPort) {
  throw new Error('pdf.worker doit être exécuté dans un worker_threads');
}

const port = parentPort;

/** Options PDF « compilées » une fois : réutilisées pour chaque document (pool de threads). */
const PDF_DOCUMENT_TEMPLATE = Object.freeze({
  margin: 50,
  size: 'A4' as const,
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
    const doc = new PDFDocument({
      margin: PDF_DOCUMENT_TEMPLATE.margin,
      size: PDF_DOCUMENT_TEMPLATE.size,
    });
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

/** Traitement séquentiel des jobs sur ce thread (évite chevauchement si messages rapides). */
let jobChain = Promise.resolve();
port.on('message', (raw: unknown) => {
  jobChain = jobChain.then(() => runPdf(raw));
});
