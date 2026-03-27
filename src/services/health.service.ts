import IORedis from 'ioredis';
import mongoose from 'mongoose';
import { config } from '../config';
import { pdfQueue } from '../queue/pdfQueue';
import { rootLogger } from '../utils/logger';

export interface HealthQueueStatus {
  ok: boolean;
  backend: 'redis' | 'memory';
  waiting?: number;
  active?: number;
  error?: string;
}

export interface HealthReport {
  ok: boolean;
  mongo: boolean;
  redis: boolean;
  queue: HealthQueueStatus;
}

export async function checkHealth(): Promise<HealthReport> {
  try {
    const mongo = mongoose.connection.readyState === 1;
    let redis = false;
    if (config.QUEUE_BACKEND === 'memory') {
      redis = true;
    } else {
      const client = new IORedis(config.REDIS_URL, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        lazyConnect: false,
      });
      try {
        const pong = await client.ping();
        redis = pong === 'PONG';
      } catch (err) {
        rootLogger.warn('Redis indisponible (health)', {
          err: err instanceof Error ? err.message : String(err),
        });
        redis = false;
      } finally {
        try {
          await client.quit();
        } catch {
          client.disconnect();
        }
      }
    }

    const queueBase: HealthQueueStatus = {
      ok: false,
      backend: config.QUEUE_BACKEND,
    };
    let queue: HealthQueueStatus = queueBase;
    try {
      const counts = await pdfQueue.getJobCounts();
      queue = {
        ok: true,
        backend: config.QUEUE_BACKEND,
        waiting: counts.waiting,
        active: counts.active,
      };
    } catch (err) {
      queue = {
        ok: false,
        backend: config.QUEUE_BACKEND,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    const ok = mongo && redis && queue.ok;
    rootLogger.debug('Health check', { mongo, redis, queue: queue.ok, ok });
    return { ok, mongo, redis, queue };
  } catch (err) {
    rootLogger.error('Erreur health check', {
      err: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      mongo: false,
      redis: false,
      queue: { ok: false, backend: config.QUEUE_BACKEND, error: 'health_check_exception' },
    };
  }
}
