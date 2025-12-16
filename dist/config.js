"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultConfig = getDefaultConfig;
exports.getDefaultCircuitBreakerConfig = getDefaultCircuitBreakerConfig;
exports.mergeConfig = mergeConfig;
const types_1 = require("./types");
function getDefaultConfig() {
    return {
        baseDelays: {
            [types_1.ErrorCategory.TRANSIENT]: 100,
            [types_1.ErrorCategory.OVERLOAD]: 1000,
            [types_1.ErrorCategory.TIMEOUT]: 500,
            [types_1.ErrorCategory.PERMANENT]: 0,
            [types_1.ErrorCategory.UNKNOWN]: 300,
        },
        errorWeights: {
            [types_1.ErrorCategory.TRANSIENT]: 1.0,
            [types_1.ErrorCategory.OVERLOAD]: 3.0,
            [types_1.ErrorCategory.TIMEOUT]: 1.5,
            [types_1.ErrorCategory.PERMANENT]: 0,
            [types_1.ErrorCategory.UNKNOWN]: 2.0,
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
function getDefaultCircuitBreakerConfig() {
    return {
        failureThreshold: 5,
        resetTimeout: 30000,
        successThreshold: 2,
    };
}
function mergeConfig(userConfig) {
    const defaults = getDefaultConfig();
    if (!userConfig)
        return defaults;
    return {
        ...defaults,
        ...userConfig,
        baseDelays: { ...defaults.baseDelays, ...userConfig.baseDelays },
        errorWeights: { ...defaults.errorWeights, ...userConfig.errorWeights },
    };
}
//# sourceMappingURL=config.js.map