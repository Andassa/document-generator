import { GridFSBucket, ObjectId, type Document } from 'mongodb';
import mongoose from 'mongoose';
import type { Response } from 'express';
import { config } from '../config';
import { createMongoCircuit } from './circuit.service';
import { NotFoundError } from '../utils/errors';
import { rootLogger } from '../utils/logger';
import type { Logger } from 'winston';

function getDb(): mongoose.mongo.Db {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Base MongoDB non initialisée');
  }
  return db;
}

export function getGridFsBucket(): GridFSBucket {
  return new GridFSBucket(getDb(), { bucketName: config.GRIDFS_BUCKET_NAME });
}

export function getFilesCollectionName(): string {
  return `${config.GRIDFS_BUCKET_NAME}.files`;
}

const findFileBreaker = createMongoCircuit(
  'gridfs-find-file',
  async (id: ObjectId) => {
    const col = getDb().collection(getFilesCollectionName());
    return col.findOne({ _id: id }) as Promise<Document | null>;
  },
  rootLogger,
);

export async function findGridFsFileMetadata(fileId: ObjectId): Promise<Document | null> {
  return findFileBreaker.fire(fileId);
}

export async function shutdownGridFsCircuit(): Promise<void> {
  await findFileBreaker.shutdown();
}

export async function assertFileExistsForDownload(fileId: ObjectId): Promise<void> {
  const meta = await findGridFsFileMetadata(fileId);
  if (!meta) {
    throw new NotFoundError('Fichier PDF introuvable dans GridFS');
  }
}

export async function pipeGridFsFileToResponse(
  fileId: ObjectId,
  res: Response,
  logger: Logger,
): Promise<void> {
  await assertFileExistsForDownload(fileId);
  logger.info('Streaming PDF depuis GridFS', { fileId: fileId.toHexString() });
  const bucket = getGridFsBucket();
  const downloadStream = bucket.openDownloadStream(fileId);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${fileId.toHexString()}.pdf"`);
  await new Promise<void>((resolve, reject) => {
    downloadStream.on('error', (err: Error) => {
      logger.error('Erreur lecture GridFS', { err });
      reject(err);
    });
    res.on('error', (err: Error) => {
      logger.error('Erreur réponse HTTP (stream PDF)', { err });
      reject(err);
    });
    downloadStream.on('end', () => resolve());
    downloadStream.pipe(res);
  });
}
