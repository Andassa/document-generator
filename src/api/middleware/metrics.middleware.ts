import type { Request, Response, NextFunction } from 'express';
import { httpRequestDurationSeconds, httpRequestsTotal } from '../../utils/metrics';

function normalizeRoute(req: Request): string {
  if (req.route?.path) {
    const base = req.baseUrl ?? '';
    return `${base}${req.route.path}`;
  }
  return req.path || 'unknown';
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      try {
        const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
        const route = normalizeRoute(req);
        const status_code = String(res.statusCode);
        httpRequestDurationSeconds.observe(
          { method: req.method, route, status_code },
          durationSec,
        );
        httpRequestsTotal.inc({ method: req.method, route, status_code });
      } catch (err) {
        req.logger?.error('Échec enregistrement métriques HTTP', {
          err: err instanceof Error ? err.message : String(err),
        });
      }
    });
    next();
  } catch (err) {
    next(err instanceof Error ? err : new Error(String(err)));
  }
}
