import { SmartRetryOptions, SmartRetryResult, AlgorithmConfig, CircuitBreakerConfig, EndpointStats, StorageAdapter, RetryInfo, ErrorCategory } from './types';
import { classifyError, extractStatusCode } from './classifier';
import { StatsCollector } from './stats';
import { DelayCalculator } from './calculator';
import { CircuitBreaker, CircuitOpenError } from './circuit-breaker';
import { mergeConfig, getDefaultCircuitBreakerConfig } from './config';

export class SmartRetry {
  private statsCollector: StatsCollector;
  private delayCalculator: DelayCalculator;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private circuitBreakerConfig: CircuitBreakerConfig;
  private useCircuitBreakerDefault: boolean;

  constructor(options?: SmartRetryConstructorOptions) {
    const config = mergeConfig(options?.config);
    this.statsCollector = new StatsCollector(config, options?.storageAdapter);
    this.delayCalculator = new DelayCalculator(config);
    this.circuitBreakerConfig = { ...getDefaultCircuitBreakerConfig(), ...options?.circuitBreakerConfig };
    this.useCircuitBreakerDefault = options?.useCircuitBreaker ?? true;
  }

  async execute<T>(fn: () => Promise<T>, options: SmartRetryOptions): Promise<SmartRetryResult<T>> {
    const { endpoint, maxRetries = 5, timeout = 30000, onRetry, classifyError: customClassifier, useCircuitBreaker = this.useCircuitBreakerDefault } = options;
    const startTime = Date.now();
    const circuitBreaker = useCircuitBreaker ? this.getCircuitBreaker(endpoint) : null;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (circuitBreaker && !circuitBreaker.canAttempt()) {
        const status = circuitBreaker.getStatus();
        throw new CircuitOpenError(endpoint, status.timeUntilRetry || 0);
      }
      try {
        const result = await this.withTimeout(fn(), timeout);
        const recoveryTime = attempt > 1 ? Date.now() - startTime : undefined;
        this.statsCollector.recordSuccess(endpoint, attempt, recoveryTime);
        circuitBreaker?.recordSuccess();
        return { data: result, attempts: attempt, totalTime: Date.now() - startTime, endpoint };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const statusCode = extractStatusCode(error);
        const errorCategory = customClassifier ? customClassifier(lastError, statusCode) : classifyError(lastError, statusCode);
        this.statsCollector.recordFailure(endpoint, errorCategory);
        circuitBreaker?.recordFailure();
        const { delay, shouldRetry, factors } = this.delayCalculator.calculate(errorCategory, attempt, this.statsCollector, endpoint);
        if (!shouldRetry || attempt === maxRetries) { this.statsCollector.recordExhausted(endpoint); break; }
        if (onRetry) { const retryInfo: RetryInfo = { attempt, delay, error: lastError, factors, errorCategory, successProbability: factors.successProbability }; onRetry(retryInfo); }
        await this.sleep(delay);
      }
    }
    throw lastError || new Error('Retry failed');
  }

  getStats(endpoint: string): EndpointStats | null { return this.statsCollector.getStats(endpoint); }
  getTrackedEndpoints(): string[] { return this.statsCollector.getEndpoints(); }
  getCircuitBreakerStatus(endpoint: string) { const cb = this.circuitBreakers.get(endpoint); return cb?.getStatus() || null; }
  resetCircuitBreaker(endpoint: string): void { this.circuitBreakers.get(endpoint)?.reset(); }
  clearAllStats(): void { this.statsCollector.clearAll(); this.circuitBreakers.clear(); }
  async loadFromStorage(): Promise<void> { await this.statsCollector.loadFromStorage(); }

  private getCircuitBreaker(endpoint: string): CircuitBreaker {
    if (!this.circuitBreakers.has(endpoint)) this.circuitBreakers.set(endpoint, new CircuitBreaker(this.circuitBreakerConfig));
    return this.circuitBreakers.get(endpoint)!;
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
      promise.then((result) => { clearTimeout(timer); resolve(result); }).catch((error) => { clearTimeout(timer); reject(error); });
    });
  }

  private sleep(ms: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, ms)); }
}

export interface SmartRetryConstructorOptions {
  config?: Partial<AlgorithmConfig>;
  circuitBreakerConfig?: Partial<CircuitBreakerConfig>;
  useCircuitBreaker?: boolean;
  storageAdapter?: StorageAdapter;
}

let defaultInstance: SmartRetry | null = null;
export function getDefaultInstance(): SmartRetry { if (!defaultInstance) defaultInstance = new SmartRetry(); return defaultInstance; }
export async function smartRetry<T>(fn: () => Promise<T>, options: SmartRetryOptions): Promise<SmartRetryResult<T>> { return getDefaultInstance().execute(fn, options); }