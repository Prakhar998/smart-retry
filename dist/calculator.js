"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DelayCalculator = void 0;
exports.compareWithExponentialBackoff = compareWithExponentialBackoff;
const types_1 = require("./types");
const config_1 = require("./config");
class DelayCalculator {
    constructor(config) {
        this.config = { ...(0, config_1.getDefaultConfig)(), ...config };
    }
    calculate(errorCategory, attemptNumber, statsCollector, endpoint) {
        if (errorCategory === types_1.ErrorCategory.PERMANENT)
            return { delay: 0, shouldRetry: false, factors: this.emptyFactors() };
        const factors = this.computeFactors(errorCategory, attemptNumber, statsCollector, endpoint);
        if (factors.successProbability < this.config.minSuccessProbability)
            return { delay: 0, shouldRetry: false, factors };
        let delay = this.config.baseDelays[errorCategory] * factors.errorWeight * factors.timeOfDayFactor * factors.streakPenalty;
        if (factors.recoveryEstimate > 0)
            delay = delay * 0.4 + factors.recoveryEstimate * 0.6;
        const jitterRange = delay * this.config.jitterPercent;
        const jitter = jitterRange * (Math.random() * 2 - 1);
        delay = delay + jitter;
        delay = Math.max(this.config.minDelay, delay);
        delay = Math.min(this.config.maxDelay, delay);
        return { delay: Math.round(delay), shouldRetry: true, factors };
    }
    computeFactors(errorCategory, attemptNumber, statsCollector, endpoint) {
        const errorWeight = this.config.errorWeights[errorCategory];
        const timeOfDayFactor = statsCollector.getTimeOfDayFactor(endpoint);
        const recoveryEstimate = statsCollector.getRecoveryEstimate(endpoint);
        const successProbability = statsCollector.getSuccessProbability(endpoint, attemptNumber);
        const streakPenalty = Math.min(Math.pow(this.config.streakBase, attemptNumber - 1), this.config.maxStreakPenalty);
        return { errorWeight, timeOfDayFactor, recoveryEstimate, successProbability, streakPenalty };
    }
    emptyFactors() {
        return { errorWeight: 0, timeOfDayFactor: 1, recoveryEstimate: 0, successProbability: 0, streakPenalty: 1 };
    }
    updateConfig(config) { this.config = { ...this.config, ...config }; }
    getConfig() { return { ...this.config }; }
}
exports.DelayCalculator = DelayCalculator;
function compareWithExponentialBackoff(attemptNumber, baseDelay = 1000) {
    return { exponential: baseDelay * Math.pow(2, attemptNumber - 1), smartRetry: 'Depends on learned patterns (typically 30-70% lower)' };
}
//# sourceMappingURL=calculator.js.map