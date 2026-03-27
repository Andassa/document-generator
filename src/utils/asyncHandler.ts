import type { Request, Response, NextFunction, RequestHandler } from 'express';

export function catchAsync(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
}
