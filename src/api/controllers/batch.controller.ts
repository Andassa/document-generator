import type { Request, Response } from 'express';
import { catchAsync } from '../../utils/asyncHandler';
import { ValidationError } from '../../utils/errors';
import { firstRouteParam } from '../../utils/routeParams';
import { createBatch, getBatchById } from '../../services/batch.service';
import { createBatchSchema } from '../../validation/batch.schema';

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
  req.logger.info('Réponse lot acceptée', { batchId: result.batchId });
  res.status(202).json({
    batchId: result.batchId,
    documentIds: result.documentIds,
  });
});

export const getBatch = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const id = firstRouteParam(req.params.id);
  const details = await getBatchById(id, req.logger);
  res.status(200).json(details);
});
