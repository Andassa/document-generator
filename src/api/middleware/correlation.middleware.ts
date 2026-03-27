import type { Request, Response, NextFunction } from 'express';
import { getOrCreateCorrelationId } from '../../utils/correlation';
import { createChildLogger } from '../../utils/logger';

export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    const correlationId = getOrCreateCorrelationId(req);
    req.correlationId = correlationId;
    req.logger = createChildLogger(correlationId);
    res.setHeader('x-correlation-id', correlationId);
    next();
  } catch (err) {
    next(err instanceof Error ? err : new Error(String(err)));
  }
}
