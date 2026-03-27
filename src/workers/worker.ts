import type { Job } from 'bull';
import mongoose from 'mongoose';
import { config } from '../config';
import { pdfQueue } from '../queue/pdfQueue';
import { DocumentModel } from '../models/document.model';
import { BatchModel } from '../models/batch.model';
import type { PdfJobPayload } from '../types/pdf';
import { verifySimulatedDocuSignEnvelope } from '../services/docusignSimulated.service';
import { streamPdfFromWorkerToGridFS } from '../services/pdfRunner.service';
import { createChildLogger } from '../utils/logger';
import {
  pdfJobsProcessedTotal,
  pdfJobDurationSeconds,
  activeBullJobs,
  documentsGeneratedTotal,
  batchProcessingDurationSeconds,
} from '../utils/metrics';

async function refreshBatchStatus(batchId: mongoose.Types.ObjectId): Promise<void> {
  const docs = await DocumentModel.find({ batchId }).exec();
  if (docs.length === 0) {
    return;
  }
  const terminal = docs.every((d) => d.status === 'completed' || d.status === 'failed');
  if (!terminal) {
    return;
  }
  const allOk = docs.every((d) => d.status === 'completed');
  const allFail = docs.every((d) => d.status === 'failed');
  const nextStatus = allOk ? 'completed' : allFail ? 'failed' : 'partial';

  const prev = await BatchModel.findOneAndUpdate(
    { _id: batchId, status: { $nin: ['completed', 'failed', 'partial'] } },
    { $set: { status: nextStatus } },
  ).exec();

  if (prev?.createdAt) {
    const elapsedSec = (Date.now() - prev.createdAt.getTime()) / 1000;
    batchProcessingDurationSeconds.observe({ outcome: nextStatus }, elapsedSec);
  }
}

export function registerPdfWorkerProcessor(): void {
  void pdfQueue.process(
    'generate',
    config.PDF_WORKER_CONCURRENCY,
    async (job: Job<PdfJobPayload>) => {
      const started = process.hrtime.bigint();
      activeBullJobs.inc();
      const logger = createChildLogger(job.data.correlationId, {
        batchId: job.data.batchId,
        documentId: job.data.documentId,
      });
      let outcome: 'success' | 'failure' = 'failure';
      try {
        logger.info('Traitement job PDF', { jobId: String(job.id) });
        await DocumentModel.findByIdAndUpdate(job.data.documentId, {
          status: 'processing',
        }).exec();
        await verifySimulatedDocuSignEnvelope();
        const fileId = await streamPdfFromWorkerToGridFS(job.data, logger);
        await DocumentModel.findByIdAndUpdate(job.data.documentId, {
          status: 'completed',
          gridFsFileId: fileId,
          $unset: { errorMessage: 1 },
        }).exec();
        await refreshBatchStatus(new mongoose.Types.ObjectId(job.data.batchId));
        outcome = 'success';
        pdfJobsProcessedTotal.inc({ status: 'success' });
        documentsGeneratedTotal.inc();
        logger.info('Job PDF terminé', { jobId: String(job.id) });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('Échec job PDF', { jobId: String(job.id), err: message });
        pdfJobsProcessedTotal.inc({ status: 'failure' });
        await DocumentModel.findByIdAndUpdate(job.data.documentId, {
          status: 'failed',
          errorMessage: message,
        }).exec();
        await refreshBatchStatus(new mongoose.Types.ObjectId(job.data.batchId));
        throw err instanceof Error ? err : new Error(message);
      } finally {
        activeBullJobs.dec();
        const elapsedNs = process.hrtime.bigint() - started;
        const seconds = Number(elapsedNs) / 1e9;
        pdfJobDurationSeconds.observe({ status: outcome }, seconds);
      }
    },
  );
}
