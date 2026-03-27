import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.string().default('info'),
  MONGODB_URI: z.string().min(1),
  REDIS_URL: z.string().min(1),
  BULL_QUEUE_NAME: z.string().min(1).default('document-pdf'),
  PDF_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(2),
  GRIDFS_BUCKET_NAME: z.string().min(1).default('pdfs'),
  CIRCUIT_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  CIRCUIT_ERROR_THRESHOLD_PERCENTAGE: z.coerce.number().int().min(1).max(100).default(50),
  CIRCUIT_RESET_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  CIRCUIT_VOLUME_THRESHOLD: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
});

export type AppConfig = z.infer<typeof envSchema>;

function loadConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    throw new Error(`Configuration invalide: ${JSON.stringify(msg)}`);
  }
  return parsed.data;
}

export const config = loadConfig();
