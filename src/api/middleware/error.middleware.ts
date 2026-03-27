import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/errors';
import { rootLogger } from '../../utils/logger';

export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const logger = req.logger ?? rootLogger;
  try {
    if (err instanceof AppError) {
      logger.warn('Erreur applicative', {
        message: err.message,
        statusCode: err.statusCode,
        code: err.code,
      });
      res.status(err.statusCode).json({
        error: { message: err.message, code: err.code },
      });
      return;
    }
    const message = err instanceof Error ? err.message : 'Erreur interne';
    logger.error('Erreur non gérée', {
      message,
      stack: err instanceof Error ? err.stack : undefined,
    });
    res.status(500).json({
      error: { message: 'Erreur interne du serveur', code: 'INTERNAL_ERROR' },
    });
  } catch (nested) {
    rootLogger.error('Erreur dans le middleware d’erreur', {
      err: nested instanceof Error ? nested.message : String(nested),
    });
    res.status(500).json({
      error: { message: 'Erreur interne du serveur', code: 'INTERNAL_ERROR' },
    });
  }
}
