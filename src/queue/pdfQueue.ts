import Queue from 'bull';
import { config } from '../config';

export const pdfQueue = new Queue(config.BULL_QUEUE_NAME, config.REDIS_URL);
