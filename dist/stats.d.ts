import { EndpointStats, ErrorCategory, StorageAdapter, AlgorithmConfig } from './types';
export declare class StatsCollector {
    private stats;
    private config;
    private storageAdapter?;
    private pendingSaves;
    private saveDebounceMs;
    constructor(config?: Partial<AlgorithmConfig>, storageAdapter?: StorageAdapter);
    recordSuccess(endpoint: string, attemptNumber: number, recoveryTime?: number): void;
    recordFailure(endpoint: string, errorCategory: ErrorCategory): void;
    recordExhausted(endpoint: string): void;
    getStats(endpoint: string): EndpointStats | null;
    getEndpoints(): string[];
    clearStats(endpoint: string): void;
    clearAll(): void;
    loadFromStorage(): Promise<void>;
    getSuccessProbability(endpoint: string, attemptNumber: number): number;
    getTimeOfDayFactor(endpoint: string): number;
    getRecoveryEstimate(endpoint: string): number;
    private getOrCreate;
    private createEmptyStats;
    private updateRate;
    private calculateAverage;
    private recordStreakOutcome;
    private scheduleSave;
}
//# sourceMappingURL=stats.d.ts.map