import { randomUUID } from 'crypto';
import type { Request } from 'express';

const HEADER = 'x-correlation-id';

export function getOrCreateCorrelationId(req: Request): string {
  const headerVal = req.headers[HEADER];
  if (typeof headerVal === 'string' && headerVal.trim().length > 0) {
    return headerVal.trim();
  }
  if (Array.isArray(headerVal) && headerVal[0]) {
    return headerVal[0].trim();
  }
  return randomUUID();
}

export const correlationHeaderName = HEADER;
