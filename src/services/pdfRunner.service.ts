import { once } from 'node:events';
import type { GridFSBucketWriteStream } from 'mongodb';
import { ObjectId } from 'mongodb';
import { config } from '../config';
import { getGridFsBucket } from './gridfs.service';
import { getPdfThreadPool } from './pdfThreadPool';
import type { PdfJobPayload, PdfWorkerParentMessage, PdfWorkerStartMessage } from '../types/pdf';
import { pdfWorkerChunksTotal } from '../utils/metrics';
import type { Logger } from 'winston';

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

  const pool = getPdfThreadPool();
  const worker = await pool.acquire();
  logger.info('Worker PDF (pool) pris', { documentId: job.documentId });

  const timeoutMs = config.PDF_GENERATION_TIMEOUT_MS;

  return await new Promise<ObjectId>((resolve, reject) => {
    let settled = false;
    let chain: Promise<void> = Promise.resolve();
    let timer: NodeJS.Timeout | undefined;

    const clearTimer = (): void => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    };

    const detachWorkerListeners = (): void => {
      worker.removeListener('message', onWorkerMessage);
      worker.removeListener('error', onWorkerError);
      worker.removeListener('exit', onWorkerExit);
    };

    const rejectOnce = (err: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimer();
      detachWorkerListeners();
      uploadStream.destroy(err);
      void pool.discard(worker).then(() => {
        reject(err);
      });
    };

    const resolveOnce = (id: ObjectId): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimer();
      detachWorkerListeners();
      pool.release(worker);
      resolve(id);
    };

    timer = setTimeout(() => {
      rejectOnce(
        new Error(`Génération PDF : délai de ${String(timeoutMs)} ms dépassé`),
      );
    }, timeoutMs);

    const onWorkerMessage = (raw: unknown): void => {
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
            resolveOnce(id as ObjectId);
          }
        })
        .catch((err: unknown) => {
          const e = err instanceof Error ? err : new Error(String(err));
          rejectOnce(e);
        });
    };

    const onWorkerError = (err: Error): void => {
      logger.error('Erreur thread PDF', { err });
      rejectOnce(err);
    };

    const onWorkerExit = (code: number): void => {
      if (!settled && code !== 0) {
        rejectOnce(new Error(`Worker PDF terminé avec le code ${String(code)}`));
      }
    };

    uploadStream.on('error', (err: Error) => {
      logger.error('Erreur upload GridFS', { err });
      rejectOnce(err);
    });
    worker.on('message', onWorkerMessage);
    worker.on('error', onWorkerError);
    worker.on('exit', onWorkerExit);

    const start: PdfWorkerStartMessage = {
      type: 'start',
      title: job.title,
      content: job.content,
    };
    worker.postMessage(start);
  });
}
