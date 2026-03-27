import type { Request, Response } from 'express';
import { catchAsync } from '../../utils/asyncHandler';
import { ValidationError } from '../../utils/errors';
import { firstRouteParam } from '../../utils/routeParams';
import { createBatch, getBatchById } from '../../services/batch.service';
import { createBatchSchema, createBatchUserIdsSchema } from '../../validation/batch.schema';

export const postBatch = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const parsed = createBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => i.message).join('; ');
    throw new ValidationError(detail);
  }
  const result = await createBatch(
    parsed.data.documents,
    req.correlationId,
    req.logger,
  );
  req.logger.child({ batchId: result.batchId }).info('Réponse lot acceptée');
  res.status(202).json({
    batchId: result.batchId,
    documentIds: result.documentIds,
  });
});

/** Variante sujet : tableau `userIds` → un PDF par identifiant (titre / contenu dérivés). */
export const postBatchByUserIds = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const parsed = createBatchUserIdsSchema.safeParse(req.body);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => i.message).join('; ');
    throw new ValidationError(detail);
  }
  const documents = parsed.data.userIds.map((userId) => ({
    title: `Document — ${userId}`,
    content: `Identifiant utilisateur : ${userId}\n\nDocument généré automatiquement.`,
  }));
  const result = await createBatch(documents, req.correlationId, req.logger);
  req.logger.child({ batchId: result.batchId }).info('Réponse lot acceptée (userIds)');
  res.status(202).json({
    batchId: result.batchId,
    documentIds: result.documentIds,
  });
});

export const getBatch = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const id = firstRouteParam(req.params.batchId ?? req.params.id);
  const details = await getBatchById(id, req.logger);
  res.status(200).json(details);
});
