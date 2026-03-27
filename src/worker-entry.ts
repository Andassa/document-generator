import { connectMongo, disconnectMongo } from './db/mongo';
import { config } from './config';
import { pdfQueue } from './queue/pdfQueue';
import { registerPdfWorkerProcessor } from './workers/worker';
import { rootLogger } from './utils/logger';
import { shutdownDocuSignCircuit } from './services/docusignSimulated.service';
import { shutdownGridFsCircuit } from './services/gridfs.service';
import { shutdownPdfThreadPool } from './services/pdfThreadPool';
import { startQueueSizePolling } from './utils/metrics';
import { waitPdfQueueIdle } from './utils/queueShutdown';
import { closeWorkerMetricsServer, startWorkerMetricsServer } from './workerMetricsServer';

let stopQueuePolling: (() => void) | undefined;
let metricsServer: ReturnType<typeof startWorkerMetricsServer> | undefined;

async function bootstrap(): Promise<void> {
  try {
    if (config.QUEUE_BACKEND === 'memory') {
      rootLogger.error(
        'QUEUE_BACKEND=memory : le worker est intégré au serveur HTTP — ne lancez pas worker-entry.',
      );
      process.exit(1);
    }
    await connectMongo();
    registerPdfWorkerProcessor();
    rootLogger.info('Processeur Bull PDF enregistré', {
      queueName: config.BULL_QUEUE_NAME,
      redisUrlHost: (() => {
        try {
          return new URL(config.REDIS_URL).host;
        } catch {
          return '(URL Redis invalide)';
        }
      })(),
    });
    const counts = await pdfQueue.getJobCounts();
    rootLogger.info('État file Bull (worker)', counts);
    stopQueuePolling = startQueueSizePolling(pdfQueue, config.QUEUE_METRICS_POLL_MS);
    if (config.WORKER_METRICS_PORT > 0) {
      metricsServer = startWorkerMetricsServer(config.WORKER_METRICS_PORT);
    }
  } catch (err) {
    rootLogger.error('Échec démarrage worker', {
      err: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }
}

void bootstrap();

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  rootLogger.info('Signal reçu, arrêt gracieux du worker', { signal });
  try {
    stopQueuePolling?.();
    stopQueuePolling = undefined;
  } catch (err) {
    rootLogger.warn('Erreur arrêt polling queue_size (worker)', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  try {
    if (metricsServer) {
      await closeWorkerMetricsServer(metricsServer);
      metricsServer = undefined;
    }
  } catch (err) {
    rootLogger.warn('Erreur fermeture serveur métriques worker', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  try {
    await waitPdfQueueIdle(
      pdfQueue,
      config.GRACEFUL_SHUTDOWN_ACTIVE_JOBS_TIMEOUT_MS,
      rootLogger,
    );
  } catch (err) {
    rootLogger.warn('Erreur attente file PDF (worker)', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  try {
    await shutdownDocuSignCircuit();
  } catch (err) {
    rootLogger.warn('Erreur shutdown circuit DocuSign simulé (worker)', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  try {
    await pdfQueue.close();
  } catch (err) {
    rootLogger.warn('Erreur fermeture file Bull (worker)', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  try {
    await shutdownPdfThreadPool();
  } catch (err) {
    rootLogger.warn('Erreur fermeture pool threads PDF', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  try {
    await shutdownGridFsCircuit();
  } catch (err) {
    rootLogger.warn('Erreur shutdown circuit GridFS (worker)', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  try {
    await disconnectMongo();
  } catch (err) {
    rootLogger.warn('Erreur déconnexion MongoDB (worker)', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  process.exit(0);
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
