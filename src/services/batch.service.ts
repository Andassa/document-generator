import mongoose from 'mongoose';
import { pdfQueue } from '../queue/pdfQueue';
import { BatchModel } from '../models/batch.model';
import { DocumentModel } from '../models/document.model';
import { NotFoundError } from '../utils/errors';
import type { Logger } from 'winston';
import type { PdfJobPayload } from '../types/pdf';

export interface BatchDocumentInput {
  title: string;
  content: string;
}

export interface CreateBatchResult {
  batchId: string;
  documentIds: string[];
}

export async function createBatch(
  documents: BatchDocumentInput[],
  correlationId: string,
  logger: Logger,
): Promise<CreateBatchResult> {
  const session = await mongoose.startSession();
  try {
    let result: CreateBatchResult = { batchId: '', documentIds: [] };
    await session.withTransaction(async () => {
      const batch = await BatchModel.create(
        [{ status: 'pending', documents: [] }],
        { session },
      );
      const b = batch[0];
      if (!b) {
        throw new Error('Création de lot impossible');
      }
      const docIds: mongoose.Types.ObjectId[] = [];
      for (let i = 0; i < documents.length; i++) {
        const d = documents[i];
        const doc = await DocumentModel.create(
          [
            {
              batchId: b._id,
              title: d.title,
              content: d.content,
              status: 'pending',
            },
          ],
          { session },
        );
        const created = doc[0];
        if (!created) {
          throw new Error('Création de document impossible');
        }
        docIds.push(created._id);
      }
      b.documents = docIds;
      b.status = 'processing';
      await b.save({ session });
      result = {
        batchId: b._id.toHexString(),
        documentIds: docIds.map((id) => id.toHexString()),
      };
    });
    logger.info('Lot créé, envoi des jobs', {
      batchId: result.batchId,
      count: result.documentIds.length,
    });
    for (let i = 0; i < documents.length; i++) {
      const payload: PdfJobPayload = {
        documentId: result.documentIds[i] ?? '',
        batchId: result.batchId,
        title: documents[i]?.title ?? '',
        content: documents[i]?.content ?? '',
        correlationId,
      };
      await pdfQueue.add('generate', payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: false,
      });
    }
    return result;
  } finally {
    await session.endSession();
  }
}

export interface BatchDocumentStatus {
  documentId: string;
  title: string;
  status: string;
  gridFsFileId?: string;
  errorMessage?: string;
}

export interface BatchDetails {
  batchId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  documents: BatchDocumentStatus[];
}

export async function getBatchById(batchId: string, logger: Logger): Promise<BatchDetails> {
  if (!mongoose.isValidObjectId(batchId)) {
    throw new NotFoundError('Lot introuvable');
  }
  const batch = await BatchModel.findById(batchId).exec();
  if (!batch) {
    throw new NotFoundError('Lot introuvable');
  }
  logger.info('Consultation lot', { batchId });
  const docs = await DocumentModel.find({ batchId: batch._id }).sort({ _id: 1 }).lean().exec();
  return {
    batchId: batch._id.toHexString(),
    status: batch.status,
    createdAt: batch.createdAt.toISOString(),
    updatedAt: batch.updatedAt.toISOString(),
    documents: docs.map((d) => ({
      documentId: d._id.toHexString(),
      title: d.title,
      status: d.status,
      gridFsFileId: d.gridFsFileId ? d.gridFsFileId.toHexString() : undefined,
      errorMessage: d.errorMessage ?? undefined,
    })),
  };
}
