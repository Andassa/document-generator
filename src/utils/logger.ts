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
  defaultMeta: { service: 'document-generator' },
  transports: [new winston.transports.Console()],
});

export function createChildLogger(correlationId: string): winston.Logger {
  return rootLogger.child({ correlationId });
}
