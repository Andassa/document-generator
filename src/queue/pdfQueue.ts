import Bull from 'bull';
import { config } from '../config';
import { InMemoryPdfQueue } from './inMemoryPdfQueue';

export const pdfQueue: Bull.Queue | InMemoryPdfQueue =
  config.QUEUE_BACKEND === 'memory'
    ? new InMemoryPdfQueue()
    : new Bull(config.BULL_QUEUE_NAME, config.REDIS_URL);
