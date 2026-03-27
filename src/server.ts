import http from 'node:http';
import { config } from './config';
import { connectMongo, disconnectMongo } from './db/mongo';
import { createApp } from './app';
import { pdfQueue } from './queue/pdfQueue';
import { rootLogger } from './utils/logger';
import { shutdownGridFsCircuit } from './services/gridfs.service';

async function closeHttpServer(server: http.Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

async function main(): Promise<void> {
  try {
    await connectMongo();
    const app = createApp();
    const server = http.createServer(app);
    server.listen(config.PORT, () => {
      rootLogger.info('Serveur HTTP à l’écoute', { port: config.PORT });
    });

    let shuttingDown = false;
    const shutdown = async (signal: string): Promise<void> => {
      if (shuttingDown) {
        return;
      }
      shuttingDown = true;
      rootLogger.info('Signal reçu, arrêt gracieux', { signal });
      try {
        await closeHttpServer(server);
      } catch (err) {
        rootLogger.warn('Erreur fermeture HTTP', {
          err: err instanceof Error ? err.message : String(err),
        });
      }
      try {
        await pdfQueue.close();
      } catch (err) {
        rootLogger.warn('Erreur fermeture file Bull', {
          err: err instanceof Error ? err.message : String(err),
        });
      }
      try {
        await shutdownGridFsCircuit();
      } catch (err) {
        rootLogger.warn('Erreur shutdown circuit GridFS', {
          err: err instanceof Error ? err.message : String(err),
        });
      }
      try {
        await disconnectMongo();
      } catch (err) {
        rootLogger.warn('Erreur déconnexion MongoDB', {
          err: err instanceof Error ? err.message : String(err),
        });
      }
      process.exit(0);
    };

    process.on('SIGTERM', () => {
      void shutdown('SIGTERM');
    });
    process.on('SIGINT', () => {
      void shutdown('SIGINT');
    });
  } catch (err) {
    rootLogger.error('Démarrage serveur impossible', {
      err: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }
}

void main();
