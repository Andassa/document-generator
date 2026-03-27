import type { Logger } from 'winston';

type QueueWithCounts = {
  getJobCounts(): Promise<{ active: number }>;
};

export async function waitPdfQueueIdle(
  queue: QueueWithCounts,
  maxMs: number,
  logger: Logger,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const c = await queue.getJobCounts();
      if (c.active === 0) {
        return;
      }
    } catch (err) {
      logger.warn('Impossible de lire les compteurs de file pendant l’arrêt', {
        err: err instanceof Error ? err.message : String(err),
      });
      return;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  logger.warn('Délai d’attente des jobs actifs dépassé avant fermeture de la file', { maxMs });
}
