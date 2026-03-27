import type { Request, Response } from 'express';
import { catchAsync } from '../../utils/asyncHandler';
import { buildObservabilityTextSummary } from '../../services/observabilitySummary.service';

export const getObservabilitySummary = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    req.logger.debug('Résumé observabilité texte');
    const body = await buildObservabilityTextSummary();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send(body);
  },
);
