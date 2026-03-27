import type { Logger } from 'winston';

declare module 'express-serve-static-core' {
  interface Request {
    correlationId: string;
    logger: Logger;
  }
}
