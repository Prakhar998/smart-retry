import { AlgorithmConfig, CircuitBreakerConfig, ErrorCategory } from './types';

export function getDefaultConfig(): AlgorithmConfig {
  return {
    baseDelays: {
      [ErrorCategory.TRANSIENT]: 100,
      [ErrorCategory.OVERLOAD]: 1000,
      [ErrorCategory.TIMEOUT]: 500,
      [ErrorCategory.PERMANENT]: 0,
      [ErrorCategory.UNKNOWN]: 300,
    },
    errorWeights: {
      [ErrorCategory.TRANSIENT]: 1.0,
      [ErrorCategory.OVERLOAD]: 3.0,
      [ErrorCategory.TIMEOUT]: 1.5,
      [ErrorCategory.PERMANENT]: 0,
      [ErrorCategory.UNKNOWN]: 2.0,
    },
    streakBase: 1.5,
    maxStreakPenalty: 10,
    jitterPercent: 0.2,
    maxDelay: 30000,
    minDelay: 50,
    minSuccessProbability: 0.1,
    maxHistorySamples: 100,
  };
}

export function getDefaultCircuitBreakerConfig(): CircuitBreakerConfig {
  return {
    failureThreshold: 5,
    resetTimeout: 30000,
    successThreshold: 2,
  };
}

export function mergeConfig(userConfig?: Partial<AlgorithmConfig>): AlgorithmConfig {
  const defaults = getDefaultConfig();
  if (!userConfig) return defaults;
  return {
    ...defaults,
    ...userConfig,
    baseDelays: { ...defaults.baseDelays, ...userConfig.baseDelays },
    errorWeights: { ...defaults.errorWeights, ...userConfig.errorWeights },
  };
}
