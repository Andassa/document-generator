import { connectMongo, disconnectMongo } from './db/mongo';
import { pdfQueue } from './queue/pdfQueue';
import { registerPdfWorkerProcessor } from './workers/worker';
import { rootLogger } from './utils/logger';
import { shutdownGridFsCircuit } from './services/gridfs.service';

async function bootstrap(): Promise<void> {
  try {
    await connectMongo();
    registerPdfWorkerProcessor();
    rootLogger.info('Processeur Bull PDF enregistré');
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
    await pdfQueue.close();
  } catch (err) {
    rootLogger.warn('Erreur fermeture file Bull (worker)', {
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
