import { ErrorCategory, DelayResult, AlgorithmConfig } from './types';
import { StatsCollector } from './stats';
export declare class DelayCalculator {
    private config;
    constructor(config?: Partial<AlgorithmConfig>);
    calculate(errorCategory: ErrorCategory, attemptNumber: number, statsCollector: StatsCollector, endpoint: string): DelayResult;
    private computeFactors;
    private emptyFactors;
    updateConfig(config: Partial<AlgorithmConfig>): void;
    getConfig(): AlgorithmConfig;
}
export declare function compareWithExponentialBackoff(attemptNumber: number, baseDelay?: number): {
    exponential: number;
    smartRetry: string;
};
//# sourceMappingURL=calculator.d.ts.map