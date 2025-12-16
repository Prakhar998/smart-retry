"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitOpenError = exports.CircuitBreaker = void 0;
const types_1 = require("./types");
const config_1 = require("./config");
class CircuitBreaker {
    constructor(config) {
        this.state = types_1.CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = 0;
        this.lastStateChange = Date.now();
        this.config = { ...(0, config_1.getDefaultCircuitBreakerConfig)(), ...config };
    }
    canAttempt() {
        switch (this.state) {
            case types_1.CircuitState.CLOSED: return true;
            case types_1.CircuitState.OPEN:
                if (Date.now() - this.lastFailureTime >= this.config.resetTimeout) {
                    this.transitionTo(types_1.CircuitState.HALF_OPEN);
                    return true;
                }
                return false;
            case types_1.CircuitState.HALF_OPEN: return true;
        }
    }
    recordSuccess() {
        switch (this.state) {
            case types_1.CircuitState.CLOSED:
                this.failureCount = 0;
                break;
            case types_1.CircuitState.HALF_OPEN:
                this.successCount++;
                if (this.successCount >= this.config.successThreshold)
                    this.transitionTo(types_1.CircuitState.CLOSED);
                break;
            case types_1.CircuitState.OPEN: break;
        }
    }
    recordFailure() {
        this.lastFailureTime = Date.now();
        switch (this.state) {
            case types_1.CircuitState.CLOSED:
                this.failureCount++;
                if (this.failureCount >= this.config.failureThreshold)
                    this.transitionTo(types_1.CircuitState.OPEN);
                break;
            case types_1.CircuitState.HALF_OPEN:
                this.transitionTo(types_1.CircuitState.OPEN);
                break;
            case types_1.CircuitState.OPEN: break;
        }
    }
    getState() { return this.state; }
    getStatus() {
        const now = Date.now();
        let timeUntilRetry = null;
        if (this.state === types_1.CircuitState.OPEN) {
            const elapsed = now - this.lastFailureTime;
            timeUntilRetry = Math.max(0, this.config.resetTimeout - elapsed);
        }
        return { state: this.state, failureCount: this.failureCount, successCount: this.successCount, lastFailureTime: this.lastFailureTime || null, lastStateChange: this.lastStateChange, timeUntilRetry, config: { ...this.config } };
    }
    reset() { this.transitionTo(types_1.CircuitState.CLOSED); this.failureCount = 0; this.successCount = 0; this.lastFailureTime = 0; }
    open() { this.transitionTo(types_1.CircuitState.OPEN); this.lastFailureTime = Date.now(); }
    updateConfig(config) { this.config = { ...this.config, ...config }; }
    transitionTo(newState) {
        if (this.state !== newState) {
            this.state = newState;
            this.lastStateChange = Date.now();
            if (newState === types_1.CircuitState.CLOSED) {
                this.failureCount = 0;
                this.successCount = 0;
            }
            else if (newState === types_1.CircuitState.HALF_OPEN) {
                this.successCount = 0;
            }
        }
    }
}
exports.CircuitBreaker = CircuitBreaker;
class CircuitOpenError extends Error {
    constructor(endpoint, timeUntilRetry) {
        super(`Circuit breaker is open for endpoint: ${endpoint}. Retry in ${timeUntilRetry}ms`);
        this.name = 'CircuitOpenError';
        this.endpoint = endpoint;
        this.timeUntilRetry = timeUntilRetry;
    }
}
exports.CircuitOpenError = CircuitOpenError;
//# sourceMappingURL=circuit-breaker.js.map