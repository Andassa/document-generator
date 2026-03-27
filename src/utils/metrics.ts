import {
  Registry,
  collectDefaultMetrics,
  Counter,
  Histogram,
  Gauge,
} from 'prom-client';

/** Évite d’importer le type `Queue` de bull (namespace vs valeur selon @types). */
export type BullQueueForMetrics = {
  getJobCounts(): Promise<{
    waiting: number;
    active: number;
    delayed: number;
  }>;
};

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Durée des requêtes HTTP en secondes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Nombre total de requêtes HTTP',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

export const pdfJobsProcessedTotal = new Counter({
  name: 'pdf_jobs_processed_total',
  help: 'Nombre de jobs PDF traités',
  labelNames: ['status'],
  registers: [registry],
});

export const pdfJobDurationSeconds = new Histogram({
  name: 'pdf_job_duration_seconds',
  help: 'Durée du traitement Bull + worker PDF',
  labelNames: ['status'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60],
  registers: [registry],
});

export const pdfWorkerChunksTotal = new Counter({
  name: 'pdf_worker_chunks_written_total',
  help: 'Chunks écrits vers GridFS depuis le worker',
  registers: [registry],
});

export const circuitBreakerState = new Gauge({
  name: 'circuit_breaker_state',
  help: 'État du disjoncteur (0=closed, 1=open, 2=halfOpen)',
  labelNames: ['name'],
  registers: [registry],
});

export const activeBullJobs = new Gauge({
  name: 'bull_active_jobs',
  help: 'Jobs Bull actifs',
  registers: [registry],
});

/** Noms alignés sujet « Test 24h » */
export const documentsGeneratedTotal = new Counter({
  name: 'documents_generated_total',
  help: 'Documents PDF générés avec succès',
  registers: [registry],
});

export const batchProcessingDurationSeconds = new Histogram({
  name: 'batch_processing_duration_seconds',
  help: 'Durée du lot jusqu’à statut terminal (createdAt → completed|failed|partial)',
  labelNames: ['outcome'],
  buckets: [0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600, 1800, 3600],
  registers: [registry],
});

export const queueSize = new Gauge({
  name: 'queue_size',
  help: 'Profondeur file Bull (waiting + active + delayed)',
  registers: [registry],
});

export function startQueueSizePolling(queue: BullQueueForMetrics, intervalMs: number): () => void {
  const tick = (): void => {
    void queue
      .getJobCounts()
      .then((c: { waiting: number; active: number; delayed: number }) => {
        queueSize.set(c.waiting + c.active + c.delayed);
      })
      .catch(() => undefined);
  };
  tick();
  const id = setInterval(tick, intervalMs);
  return () => clearInterval(id);
}
