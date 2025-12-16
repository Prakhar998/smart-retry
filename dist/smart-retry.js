"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartRetry = void 0;
exports.getDefaultInstance = getDefaultInstance;
exports.smartRetry = smartRetry;
const classifier_1 = require("./classifier");
const stats_1 = require("./stats");
const calculator_1 = require("./calculator");
const circuit_breaker_1 = require("./circuit-breaker");
const config_1 = require("./config");
class SmartRetry {
    constructor(options) {
        this.circuitBreakers = new Map();
        const config = (0, config_1.mergeConfig)(options?.config);
        this.statsCollector = new stats_1.StatsCollector(config, options?.storageAdapter);
        this.delayCalculator = new calculator_1.DelayCalculator(config);
        this.circuitBreakerConfig = { ...(0, config_1.getDefaultCircuitBreakerConfig)(), ...options?.circuitBreakerConfig };
        this.useCircuitBreakerDefault = options?.useCircuitBreaker ?? true;
    }
    async execute(fn, options) {
        const { endpoint, maxRetries = 5, timeout = 30000, onRetry, classifyError: customClassifier, useCircuitBreaker = this.useCircuitBreakerDefault } = options;
        const startTime = Date.now();
        const circuitBreaker = useCircuitBreaker ? this.getCircuitBreaker(endpoint) : null;
        let lastError = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            if (circuitBreaker && !circuitBreaker.canAttempt()) {
                const status = circuitBreaker.getStatus();
                throw new circuit_breaker_1.CircuitOpenError(endpoint, status.timeUntilRetry || 0);
            }
            try {
                const result = await this.withTimeout(fn(), timeout);
                const recoveryTime = attempt > 1 ? Date.now() - startTime : undefined;
                this.statsCollector.recordSuccess(endpoint, attempt, recoveryTime);
                circuitBreaker?.recordSuccess();
                return { data: result, attempts: attempt, totalTime: Date.now() - startTime, endpoint };
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                const statusCode = (0, classifier_1.extractStatusCode)(error);
                const errorCategory = customClassifier ? customClassifier(lastError, statusCode) : (0, classifier_1.classifyError)(lastError, statusCode);
                this.statsCollector.recordFailure(endpoint, errorCategory);
                circuitBreaker?.recordFailure();
                const { delay, shouldRetry, factors } = this.delayCalculator.calculate(errorCategory, attempt, this.statsCollector, endpoint);
                if (!shouldRetry || attempt === maxRetries) {
                    this.statsCollector.recordExhausted(endpoint);
                    break;
                }
                if (onRetry) {
                    const retryInfo = { attempt, delay, error: lastError, factors, errorCategory, successProbability: factors.successProbability };
                    onRetry(retryInfo);
                }
                await this.sleep(delay);
            }
        }
        throw lastError || new Error('Retry failed');
    }
    getStats(endpoint) { return this.statsCollector.getStats(endpoint); }
    getTrackedEndpoints() { return this.statsCollector.getEndpoints(); }
    getCircuitBreakerStatus(endpoint) { const cb = this.circuitBreakers.get(endpoint); return cb?.getStatus() || null; }
    resetCircuitBreaker(endpoint) { this.circuitBreakers.get(endpoint)?.reset(); }
    clearAllStats() { this.statsCollector.clearAll(); this.circuitBreakers.clear(); }
    async loadFromStorage() { await this.statsCollector.loadFromStorage(); }
    getCircuitBreaker(endpoint) {
        if (!this.circuitBreakers.has(endpoint))
            this.circuitBreakers.set(endpoint, new circuit_breaker_1.CircuitBreaker(this.circuitBreakerConfig));
        return this.circuitBreakers.get(endpoint);
    }
    withTimeout(promise, ms) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
            promise.then((result) => { clearTimeout(timer); resolve(result); }).catch((error) => { clearTimeout(timer); reject(error); });
        });
    }
    sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
}
exports.SmartRetry = SmartRetry;
let defaultInstance = null;
function getDefaultInstance() { if (!defaultInstance)
    defaultInstance = new SmartRetry(); return defaultInstance; }
async function smartRetry(fn, options) { return getDefaultInstance().execute(fn, options); }
//# sourceMappingURL=smart-retry.js.map