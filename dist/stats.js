"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatsCollector = void 0;
const types_1 = require("./types");
const config_1 = require("./config");
class StatsCollector {
    constructor(config, storageAdapter) {
        this.stats = new Map();
        this.pendingSaves = new Set();
        this.saveDebounceMs = 1000;
        this.config = { ...(0, config_1.getDefaultConfig)(), ...config };
        this.storageAdapter = storageAdapter;
    }
    recordSuccess(endpoint, attemptNumber, recoveryTime) {
        const stat = this.getOrCreate(endpoint);
        const hour = new Date().getHours();
        stat.hourlySuccessRate[hour] = this.updateRate(stat.hourlySuccessRate[hour], stat.hourlyAttempts[hour], true);
        stat.hourlyAttempts[hour]++;
        if (recoveryTime !== undefined && attemptNumber > 1) {
            stat.recentRecoveryTimes.push(recoveryTime);
            while (stat.recentRecoveryTimes.length > this.config.maxHistorySamples)
                stat.recentRecoveryTimes.shift();
            stat.avgRecoveryTime = this.calculateAverage(stat.recentRecoveryTimes);
        }
        if (stat.consecutiveFailures > 0)
            this.recordStreakOutcome(stat, stat.consecutiveFailures, true);
        stat.lastSuccessTime = Date.now();
        stat.consecutiveFailures = 0;
        this.scheduleSave(endpoint);
    }
    recordFailure(endpoint, errorCategory) {
        const stat = this.getOrCreate(endpoint);
        const hour = new Date().getHours();
        stat.hourlySuccessRate[hour] = this.updateRate(stat.hourlySuccessRate[hour], stat.hourlyAttempts[hour], false);
        stat.hourlyAttempts[hour]++;
        stat.errorCategoryCounts[errorCategory]++;
        stat.consecutiveFailures++;
        stat.lastFailureTime = Date.now();
        this.scheduleSave(endpoint);
    }
    recordExhausted(endpoint) {
        const stat = this.getOrCreate(endpoint);
        if (stat.consecutiveFailures > 0)
            this.recordStreakOutcome(stat, stat.consecutiveFailures, false);
        this.scheduleSave(endpoint);
    }
    getStats(endpoint) { return this.stats.get(endpoint) || null; }
    getEndpoints() { return Array.from(this.stats.keys()); }
    clearStats(endpoint) { this.stats.delete(endpoint); this.storageAdapter?.delete(endpoint); }
    clearAll() { const endpoints = this.getEndpoints(); this.stats.clear(); if (this.storageAdapter)
        endpoints.forEach(ep => this.storageAdapter.delete(ep)); }
    async loadFromStorage() {
        if (!this.storageAdapter)
            return;
        const keys = await this.storageAdapter.keys();
        for (const key of keys) {
            const stat = await this.storageAdapter.get(key);
            if (stat) {
                const entries = Object.entries(stat.streakOutcomes || {}).map(([k, v]) => [parseInt(k, 10), v]);
                stat.streakOutcomes = new Map(entries);
                this.stats.set(key, stat);
            }
        }
    }
    getSuccessProbability(endpoint, attemptNumber) {
        const stat = this.stats.get(endpoint);
        if (!stat)
            return Math.pow(0.7, attemptNumber - 1);
        const bucket = Math.min(attemptNumber, 10);
        const outcomes = stat.streakOutcomes.get(bucket);
        if (outcomes && (outcomes.succeeded + outcomes.failed) >= 5)
            return outcomes.succeeded / (outcomes.succeeded + outcomes.failed);
        return Math.pow(0.7, attemptNumber - 1);
    }
    getTimeOfDayFactor(endpoint) {
        const stat = this.stats.get(endpoint);
        if (!stat)
            return 1.0;
        const hour = new Date().getHours();
        if (stat.hourlyAttempts[hour] < 10)
            return 1.0;
        const hourlyRate = stat.hourlySuccessRate[hour];
        const avgRate = stat.hourlySuccessRate.reduce((a, b) => a + b, 0) / 24;
        if (hourlyRate <= 0.01)
            return 3.0;
        const factor = avgRate / hourlyRate;
        return Math.min(Math.max(factor, 0.5), 3.0);
    }
    getRecoveryEstimate(endpoint) {
        const stat = this.stats.get(endpoint);
        if (!stat || stat.recentRecoveryTimes.length === 0)
            return 1000;
        const sorted = [...stat.recentRecoveryTimes].sort((a, b) => a - b);
        const p75Index = Math.floor(sorted.length * 0.75);
        return sorted[p75Index];
    }
    getOrCreate(endpoint) {
        if (!this.stats.has(endpoint))
            this.stats.set(endpoint, this.createEmptyStats(endpoint));
        return this.stats.get(endpoint);
    }
    createEmptyStats(endpoint) {
        return {
            endpoint, recentRecoveryTimes: [], avgRecoveryTime: 1000,
            hourlySuccessRate: new Array(24).fill(0.5), hourlyAttempts: new Array(24).fill(0),
            streakOutcomes: new Map(), lastFailureTime: null, lastSuccessTime: null, consecutiveFailures: 0,
            errorCategoryCounts: { [types_1.ErrorCategory.TRANSIENT]: 0, [types_1.ErrorCategory.OVERLOAD]: 0, [types_1.ErrorCategory.TIMEOUT]: 0, [types_1.ErrorCategory.PERMANENT]: 0, [types_1.ErrorCategory.UNKNOWN]: 0 },
        };
    }
    updateRate(currentRate, attempts, success) {
        const alpha = Math.min(0.3, 1 / (attempts + 1));
        return currentRate * (1 - alpha) + (success ? 1 : 0) * alpha;
    }
    calculateAverage(arr) {
        if (arr.length === 0)
            return 1000;
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }
    recordStreakOutcome(stat, streak, succeeded) {
        const bucket = Math.min(streak, 10);
        if (!stat.streakOutcomes.has(bucket))
            stat.streakOutcomes.set(bucket, { succeeded: 0, failed: 0 });
        const outcome = stat.streakOutcomes.get(bucket);
        if (succeeded)
            outcome.succeeded++;
        else
            outcome.failed++;
    }
    scheduleSave(endpoint) {
        if (!this.storageAdapter)
            return;
        this.pendingSaves.add(endpoint);
        setTimeout(() => {
            if (this.pendingSaves.has(endpoint)) {
                this.pendingSaves.delete(endpoint);
                const stat = this.stats.get(endpoint);
                if (stat) {
                    const toStore = { ...stat, streakOutcomes: Object.fromEntries(stat.streakOutcomes) };
                    this.storageAdapter.set(endpoint, toStore);
                }
            }
        }, this.saveDebounceMs);
    }
}
exports.StatsCollector = StatsCollector;
//# sourceMappingURL=stats.js.map