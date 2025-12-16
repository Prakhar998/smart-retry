import { CircuitState, CircuitBreakerConfig } from './types';
import { getDefaultCircuitBreakerConfig } from './config';

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private lastStateChange = Date.now();
  private config: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = { ...getDefaultCircuitBreakerConfig(), ...config };
  }

  canAttempt(): boolean {
    switch (this.state) {
      case CircuitState.CLOSED: return true;
      case CircuitState.OPEN:
        if (Date.now() - this.lastFailureTime >= this.config.resetTimeout) { this.transitionTo(CircuitState.HALF_OPEN); return true; }
        return false;
      case CircuitState.HALF_OPEN: return true;
    }
  }

  recordSuccess(): void {
    switch (this.state) {
      case CircuitState.CLOSED: this.failureCount = 0; break;
      case CircuitState.HALF_OPEN: this.successCount++; if (this.successCount >= this.config.successThreshold) this.transitionTo(CircuitState.CLOSED); break;
      case CircuitState.OPEN: break;
    }
  }

  recordFailure(): void {
    this.lastFailureTime = Date.now();
    switch (this.state) {
      case CircuitState.CLOSED: this.failureCount++; if (this.failureCount >= this.config.failureThreshold) this.transitionTo(CircuitState.OPEN); break;
      case CircuitState.HALF_OPEN: this.transitionTo(CircuitState.OPEN); break;
      case CircuitState.OPEN: break;
    }
  }

  getState(): CircuitState { return this.state; }

  getStatus(): CircuitBreakerStatus {
    const now = Date.now();
    let timeUntilRetry: number | null = null;
    if (this.state === CircuitState.OPEN) {
      const elapsed = now - this.lastFailureTime;
      timeUntilRetry = Math.max(0, this.config.resetTimeout - elapsed);
    }
    return { state: this.state, failureCount: this.failureCount, successCount: this.successCount, lastFailureTime: this.lastFailureTime || null, lastStateChange: this.lastStateChange, timeUntilRetry, config: { ...this.config } };
  }

  reset(): void { this.transitionTo(CircuitState.CLOSED); this.failureCount = 0; this.successCount = 0; this.lastFailureTime = 0; }
  open(): void { this.transitionTo(CircuitState.OPEN); this.lastFailureTime = Date.now(); }
  updateConfig(config: Partial<CircuitBreakerConfig>): void { this.config = { ...this.config, ...config }; }

  private transitionTo(newState: CircuitState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.lastStateChange = Date.now();
      if (newState === CircuitState.CLOSED) { this.failureCount = 0; this.successCount = 0; }
      else if (newState === CircuitState.HALF_OPEN) { this.successCount = 0; }
    }
  }
}

export interface CircuitBreakerStatus {
  state: CircuitState; failureCount: number; successCount: number;
  lastFailureTime: number | null; lastStateChange: number; timeUntilRetry: number | null;
  config: CircuitBreakerConfig;
}

export class CircuitOpenError extends Error {
  public readonly timeUntilRetry: number;
  public readonly endpoint: string;
  constructor(endpoint: string, timeUntilRetry: number) {
    super(`Circuit breaker is open for endpoint: ${endpoint}. Retry in ${timeUntilRetry}ms`);
    this.name = 'CircuitOpenError'; this.endpoint = endpoint; this.timeUntilRetry = timeUntilRetry;
  }
}