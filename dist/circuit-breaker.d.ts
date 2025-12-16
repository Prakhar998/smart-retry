import { CircuitState, CircuitBreakerConfig } from './types';
export declare class CircuitBreaker {
    private state;
    private failureCount;
    private successCount;
    private lastFailureTime;
    private lastStateChange;
    private config;
    constructor(config?: Partial<CircuitBreakerConfig>);
    canAttempt(): boolean;
    recordSuccess(): void;
    recordFailure(): void;
    getState(): CircuitState;
    getStatus(): CircuitBreakerStatus;
    reset(): void;
    open(): void;
    updateConfig(config: Partial<CircuitBreakerConfig>): void;
    private transitionTo;
}
export interface CircuitBreakerStatus {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime: number | null;
    lastStateChange: number;
    timeUntilRetry: number | null;
    config: CircuitBreakerConfig;
}
export declare class CircuitOpenError extends Error {
    readonly timeUntilRetry: number;
    readonly endpoint: string;
    constructor(endpoint: string, timeUntilRetry: number);
}
//# sourceMappingURL=circuit-breaker.d.ts.map