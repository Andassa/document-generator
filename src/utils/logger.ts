import winston from 'winston';
import { config } from '../config';

const baseFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

export const rootLogger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: baseFormat,
  defaultMeta: { service: 'document-generator', environment: config.NODE_ENV },
  transports: [new winston.transports.Console()],
});

/** Champs toujours présents dans les lignes JSON (observabilité / corrélation métier). */
export interface LogBusinessContext {
  batchId?: string;
  documentId?: string;
}

export function createChildLogger(
  correlationId: string,
  ctx: LogBusinessContext = {},
): winston.Logger {
  const meta: Record<string, string> = { correlationId };
  if (ctx.batchId !== undefined) {
    meta.batchId = ctx.batchId;
  }
  if (ctx.documentId !== undefined) {
    meta.documentId = ctx.documentId;
  }
  return rootLogger.child(meta);
}
