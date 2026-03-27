import mongoose from 'mongoose';
import type { Response } from 'express';
import { DocumentModel } from '../models/document.model';
import { ConflictError, NotFoundError } from '../utils/errors';
import { pipeGridFsFileToResponse } from './gridfs.service';
import type { Logger } from 'winston';

export async function streamDocumentPdf(
  documentId: string,
  res: Response,
  logger: Logger,
): Promise<void> {
  if (!mongoose.isValidObjectId(documentId)) {
    throw new NotFoundError('Document introuvable');
  }
  const doc = await DocumentModel.findById(documentId).exec();
  if (!doc) {
    throw new NotFoundError('Document introuvable');
  }
  if (doc.status === 'pending' || doc.status === 'processing') {
    throw new ConflictError('Le document est encore en cours de génération');
  }
  if (doc.status === 'failed' || !doc.gridFsFileId) {
    throw new NotFoundError('PDF non disponible pour ce document');
  }
  const log = logger.child({
    documentId: doc._id.toHexString(),
    batchId: doc.batchId.toHexString(),
  });
  log.info('Téléchargement PDF', { status: doc.status });
  await pipeGridFsFileToResponse(doc.gridFsFileId, res, log);
}
