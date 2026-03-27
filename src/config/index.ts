import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

/** Toujours charger la racine du projet, pas le cwd (évite worker/API sur une autre Redis si lancé ailleurs). */
const envFile = path.resolve(__dirname, '..', '..', '.env');
dotenv.config({ path: envFile });

const envSchema = z
  .object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.string().default('info'),
    MONGODB_URI: z.string().min(1),
    /** Ignoré par la file si QUEUE_BACKEND=memory (valeur factice possible). */
    REDIS_URL: z.string().min(1).default('redis://127.0.0.1:6379'),
    /** `redis` : Bull + Redis. `memory` : file en processus (un seul Node : API + worker intégré, sans worker-entry). */
    QUEUE_BACKEND: z.enum(['redis', 'memory']).default('redis'),
    BULL_QUEUE_NAME: z.string().min(1).default('document-pdf'),
  PDF_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(2),
  /** Pool de threads PDF réutilisables (défaut = PDF_WORKER_CONCURRENCY) */
  PDF_THREAD_POOL_SIZE: z.coerce.number().int().positive().optional(),
  GRIDFS_BUCKET_NAME: z.string().min(1).default('pdfs'),
  CIRCUIT_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  CIRCUIT_ERROR_THRESHOLD_PERCENTAGE: z.coerce.number().int().min(1).max(100).default(50),
  CIRCUIT_RESET_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  CIRCUIT_VOLUME_THRESHOLD: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  BATCH_MAX_DOCUMENTS: z.coerce.number().int().min(1).max(5000).default(1000),
  JSON_BODY_LIMIT_MB: z.coerce.number().int().min(1).max(100).default(32),
  /** 0 = désactiver le serveur HTTP /metrics du worker */
  WORKER_METRICS_PORT: z.coerce.number().int().min(0).max(65_535).default(9464),
    QUEUE_METRICS_POLL_MS: z.coerce.number().int().min(1000).max(120_000).default(10_000),
    /** Délai max pour la génération PDF (thread worker → flux GridFS). */
    PDF_GENERATION_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
    /** Attente des jobs Bull encore actifs avant fermeture de la file (worker / API en mode memory). */
    GRACEFUL_SHUTDOWN_ACTIVE_JOBS_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
    /** Probabilité d’échec du DocuSign simulé (0–1). */
    DOCUSIGN_SIM_FAILURE_RATE: z.coerce.number().min(0).max(1).default(0.02),
  })
  .transform((d) => ({
    ...d,
    PDF_THREAD_POOL_SIZE: d.PDF_THREAD_POOL_SIZE ?? d.PDF_WORKER_CONCURRENCY,
  }));

export type AppConfig = z.output<typeof envSchema>;

function loadConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    throw new Error(`Configuration invalide: ${JSON.stringify(msg)}`);
  }
  return parsed.data;
}

export const config = loadConfig();
