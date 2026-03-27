import CircuitBreaker from 'opossum';
import { config } from '../config';
import { circuitBreakerState } from '../utils/metrics';
import type { Logger } from 'winston';

export function createMongoCircuit<T extends unknown[], R>(
  name: string,
  fn: (...args: T) => Promise<R>,
  logger: Logger,
): CircuitBreaker<T, R> {
  const breaker = new CircuitBreaker(fn, {
    name,
    timeout: config.CIRCUIT_TIMEOUT_MS,
    errorThresholdPercentage: config.CIRCUIT_ERROR_THRESHOLD_PERCENTAGE,
    resetTimeout: config.CIRCUIT_RESET_TIMEOUT_MS,
    volumeThreshold: config.CIRCUIT_VOLUME_THRESHOLD,
  });

  const syncGauge = (): void => {
    const s = breaker.opened ? 1 : breaker.halfOpen ? 2 : 0;
    circuitBreakerState.labels({ name }).set(s);
  };

  breaker.on('open', () => {
    logger.warn('Circuit breaker ouvert', { name });
    syncGauge();
  });
  breaker.on('halfOpen', () => {
    logger.info('Circuit breaker semi-ouvert', { name });
    syncGauge();
  });
  breaker.on('close', () => {
    logger.info('Circuit breaker fermé', { name });
    syncGauge();
  });
  breaker.on('failure', (err: Error) => {
    logger.warn('Circuit breaker échec enregistré', { name, err: err.message });
  });

  syncGauge();
  return breaker;
}
