import type { Request, Response } from 'express';
import { catchAsync } from '../../utils/asyncHandler';
import { checkHealth } from '../../services/health.service';

export const getHealth = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const report = await checkHealth();
  req.logger.info('Health check', report);
  const status = report.ok ? 200 : 503;
  res.status(status).json({
    status: report.ok ? 'ok' : 'degraded',
    mongo: report.mongo,
    redis: report.redis,
    queue: report.queue,
  });
});
