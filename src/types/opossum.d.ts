declare module 'opossum' {
  import { EventEmitter } from 'node:events';

  type AsyncFn<T extends unknown[], R> = (...args: T) => Promise<R>;

  interface CircuitBreakerOptions {
    timeout?: number;
    errorThresholdPercentage?: number;
    resetTimeout?: number;
    volumeThreshold?: number;
    name?: string;
  }

  export default class CircuitBreaker<T extends unknown[] = unknown[], R = unknown> extends EventEmitter {
    constructor(action: AsyncFn<T, R>, options?: CircuitBreakerOptions);
    fire(...args: T): Promise<R>;
    readonly opened: boolean;
    readonly halfOpen: boolean;
    shutdown(): Promise<void>;
  }
}
