export enum ErrorCategory {
  TRANSIENT = 'TRANSIENT',
  OVERLOAD = 'OVERLOAD',
  TIMEOUT = 'TIMEOUT',
  PERMANENT = 'PERMANENT',
  UNKNOWN = 'UNKNOWN'
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface EndpointStats {
  endpoint: string;
  recentRecoveryTimes: number[];
  avgRecoveryTime: number;
  hourlySuccessRate: number[];
  hourlyAttempts: number[];
  streakOutcomes: Map<number, { succeeded: number; failed: number }>;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  consecutiveFailures: number;
  errorCategoryCounts: Record<ErrorCategory, number>;
}

export interface DelayFactors {
  errorWeight: number;
  timeOfDayFactor: number;
  recoveryEstimate: number;
  successProbability: number;
  streakPenalty: number;
}

export interface DelayResult {
  delay: number;
  shouldRetry: boolean;
  factors: DelayFactors;
}

export interface SmartRetryOptions {
  endpoint: string;
  maxRetries?: number;
  timeout?: number;
  onRetry?: (info: RetryInfo) => void;
  classifyError?: (error: Error, statusCode?: number) => ErrorCategory;
  useCircuitBreaker?: boolean;
}

export interface RetryInfo {
  attempt: number;
  delay: number;
  error: Error;
  factors: DelayFactors;
  errorCategory: ErrorCategory;
  successProbability: number;
}

export interface SmartRetryResult<T> {
  data: T;
  attempts: number;
  totalTime: number;
  endpoint: string;
}

export interface AlgorithmConfig {
  baseDelays: Record<ErrorCategory, number>;
  errorWeights: Record<ErrorCategory, number>;
  streakBase: number;
  maxStreakPenalty: number;
  jitterPercent: number;
  maxDelay: number;
  minDelay: number;
  minSuccessProbability: number;
  maxHistorySamples: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  successThreshold: number;
}

export interface StorageAdapter {
  get(key: string): Promise<EndpointStats | null>;
  set(key: string, stats: EndpointStats): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}
