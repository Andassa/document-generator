import {
  Registry,
  collectDefaultMetrics,
  Counter,
  Histogram,
  Gauge,
} from 'prom-client';

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
  registers: [registry],
});

export const activeBullJobs = new Gauge({
  name: 'bull_active_jobs',
  help: 'Jobs Bull actifs',
  registers: [registry],
});
