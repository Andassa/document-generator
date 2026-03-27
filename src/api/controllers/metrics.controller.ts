import type { Request, Response } from 'express';
import { catchAsync } from '../../utils/asyncHandler';
import { registry } from '../../utils/metrics';

export const getMetrics = catchAsync(async (req: Request, res: Response): Promise<void> => {
  req.logger.debug('Export métriques Prometheus');
  res.setHeader('Content-Type', registry.contentType);
  const body = await registry.metrics();
  res.status(200).send(body);
});
