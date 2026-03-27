import IORedis from 'ioredis';
import mongoose from 'mongoose';
import { config } from '../config';
import { rootLogger } from '../utils/logger';

export interface HealthReport {
  ok: boolean;
  mongo: boolean;
  redis: boolean;
}

export async function checkHealth(): Promise<HealthReport> {
  try {
    const mongo = mongoose.connection.readyState === 1;
    let redis = false;
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
    const ok = mongo && redis;
    rootLogger.debug('Health check', { mongo, redis, ok });
    return { ok, mongo, redis };
  } catch (err) {
    rootLogger.error('Erreur health check', {
      err: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, mongo: false, redis: false };
  }
}
