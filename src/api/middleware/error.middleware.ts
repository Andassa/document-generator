import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/errors';
import { rootLogger } from '../../utils/logger';

function getClientErrorStatus(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) {
    return undefined;
  }
  const o = err as { status?: unknown; statusCode?: unknown };
  const s = typeof o.status === 'number' ? o.status : undefined;
  const sc = typeof o.statusCode === 'number' ? o.statusCode : undefined;
  const code = s ?? sc;
  if (code !== undefined && code >= 400 && code < 500) {
    return code;
  }
  return undefined;
}

function isEntityParseFailed(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) {
    return false;
  }
  return (err as { type?: string }).type === 'entity.parse.failed';
}

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
    const clientStatus = getClientErrorStatus(err);
    if (clientStatus !== undefined) {
      const message = err instanceof Error ? err.message : 'Requête invalide';
      const code = isEntityParseFailed(err) ? 'INVALID_JSON' : 'CLIENT_ERROR';
      logger.warn('Erreur requête client (middleware)', {
        statusCode: clientStatus,
        code,
        message,
      });
      res.status(clientStatus).json({
        error: { message, code },
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
