import { SmartRetryOptions, SmartRetryResult, AlgorithmConfig, CircuitBreakerConfig, EndpointStats, StorageAdapter } from './types';
export declare class SmartRetry {
    private statsCollector;
    private delayCalculator;
    private circuitBreakers;
    private circuitBreakerConfig;
    private useCircuitBreakerDefault;
    constructor(options?: SmartRetryConstructorOptions);
    execute<T>(fn: () => Promise<T>, options: SmartRetryOptions): Promise<SmartRetryResult<T>>;
    getStats(endpoint: string): EndpointStats | null;
    getTrackedEndpoints(): string[];
    getCircuitBreakerStatus(endpoint: string): import("./circuit-breaker").CircuitBreakerStatus | null;
    resetCircuitBreaker(endpoint: string): void;
    clearAllStats(): void;
    loadFromStorage(): Promise<void>;
    private getCircuitBreaker;
    private withTimeout;
    private sleep;
}
export interface SmartRetryConstructorOptions {
    config?: Partial<AlgorithmConfig>;
    circuitBreakerConfig?: Partial<CircuitBreakerConfig>;
    useCircuitBreaker?: boolean;
    storageAdapter?: StorageAdapter;
}
export declare function getDefaultInstance(): SmartRetry;
export declare function smartRetry<T>(fn: () => Promise<T>, options: SmartRetryOptions): Promise<SmartRetryResult<T>>;
//# sourceMappingURL=smart-retry.d.ts.map