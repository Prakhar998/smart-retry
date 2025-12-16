# adaptive-retry

Intelligent retry mechanism that learns from failure patterns — smarter than exponential backoff.

[![npm version](https://img.shields.io/npm/v/adaptive-retry.svg)](https://www.npmjs.com/package/adaptive-retry)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Why AdaptiveRetry?

Traditional exponential backoff is dumb:

- Treats all failures the same (timeout vs 500 vs rate limit)
- Ignores context (retrying at 3am vs peak hours)
- Doesn't learn (same mistake, same strategy, forever)
- Arbitrary multipliers (why 2x? why not 1.5x?)
- Wastes time (waiting 32s when service recovered in 2s)

**AdaptiveRetry learns from your actual failure patterns** to calculate optimal retry delays.

## Install
```bash
npm install adaptive-retry
```

## Quick Start
```typescript
import { smartRetry } from 'adaptive-retry';

const result = await smartRetry(
  () => fetch('https://api.example.com/data'),
  { endpoint: 'my-api' }
);

console.log(result.data);       // Your data
console.log(result.attempts);   // How many attempts it took
console.log(result.totalTime);  // Total time elapsed (ms)
```

## Features

- **Intelligent error classification** — different strategies for timeout vs rate-limit vs network error
- **Learns from patterns** — adapts delays based on historical recovery times
- **Time-of-day awareness** — backs off more during historically bad hours
- **Built-in circuit breaker** — prevents hammering dead services
- **Success probability** — stops retrying when success is unlikely
- **TypeScript first** — full type support out of the box

---

## 📊 Real-World Performance

### Retry with Adaptive Learning
```
Attempt 1  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 655ms  [P: 100%] ❌
Attempt 2  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   621ms  [P: 70%]  ❌
Attempt 3  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  639ms  [P: 49%]  ❌
Attempt 4  ✅ Success!

Total: 1926ms across 4 attempts
```

| Attempt | Delay | Success Probability | Result |
|:-------:|------:|--------------------:|:------:|
| 1 | 655ms | 100.0% | ❌ |
| 2 | 621ms | 70.0% | ❌ |
| 3 | 639ms | 49.0% | ❌ |
| 4 | — | 34.3% | ✅ |

> 💡 Success probability decreases with each failure, helping decide when to give up.

---

### Error Classification & Delay Strategy

AdaptiveRetry automatically classifies errors and applies appropriate delays:
```
TRANSIENT (ECONNRESET)  ━━━━━━━━━━━━━━━━━━        656ms   Fast retry
TIMEOUT                 ━━━━━━━━━━━━━━━━━━━━━━━   919ms   Medium backoff  
OVERLOAD (429)          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  2093ms  Back off!
PERMANENT (404)         ⛔ No retry
```

| Error Type | Category | Delay | Behavior |
|------------|:--------:|------:|----------|
| `ECONNRESET` | `TRANSIENT` | 656ms | Fast retry — likely a blip |
| `Timeout` | `TIMEOUT` | 919ms | Medium backoff — server slow |
| `429 Too Many Requests` | `OVERLOAD` | **2093ms** | **3x longer** — respect rate limits |
| `404 Not Found` | `PERMANENT` | — | **No retry** — won't help |

> 🛡️ `OVERLOAD` errors wait 3x longer to protect overwhelmed servers.

---

### Circuit Breaker Protection

When an endpoint is clearly down, AdaptiveRetry stops hammering it:
```
Call 1  ━━━━━━━━━━  Error ❌
Call 2  ━━━━━━━━━━  Error ❌
Call 3  ━━━━━━━━━━  Error ❌  → Circuit OPENS
Call 4  ⚡ Blocked instantly (CircuitOpenError)
Call 5  ⚡ Blocked instantly (CircuitOpenError)

Circuit State: 🔴 OPEN
Time until retry: 5000ms
```

| Call | Duration | Result |
|:----:|:--------:|--------|
| 1 | ~600ms | ❌ Error |
| 2 | ~600ms | ❌ Error |
| 3 | ~600ms | ❌ Error → **Circuit Opens** |
| 4 | **<1ms** | 🛑 `CircuitOpenError` |
| 5 | **<1ms** | 🛑 `CircuitOpenError` |

> ⚡ Calls 4-5 fail **instantly** without network request — protects your app and the server!

---

## AdaptiveRetry vs Exponential Backoff
```
                    Delay Comparison (5 retries)
     │
 16s │                                          ┌───────────┐
     │                                          │ Exponential│
 12s │                                    ┌─────│   Backoff  │
     │                                    │     └───────────┘
  8s │                              ┌─────┘
     │                              │           ┌─────────────┐
  4s │                        ┌─────┘           │AdaptiveRetry│
     │    ┌───────────────────┤                 └─────────────┘
  2s │────┴─────┬─────┬───────┘
  1s │──────────┴─────┴─────────────────────────────────────
     │
     └──────────────────────────────────────────────────────
        1       2     3       4       5       Attempt
```

| Attempt | Exponential (2x) | AdaptiveRetry | Savings |
|:-------:|-----------------:|--------------:|--------:|
| 1 | 1000ms | 100-300ms | **70%** |
| 2 | 2000ms | 150-500ms | **75%** |
| 3 | 4000ms | 200-800ms | **80%** |
| 4 | 8000ms | 300-1200ms | **85%** |
| 5 | 16000ms | May stop early* | **90%+** |
| **Total** | **31,000ms** | **~2,000ms** | **94%** |

> \* AdaptiveRetry stops retrying when success probability drops below 10%

---

## How It Works

AdaptiveRetry calculates delay using learned patterns:
```
delay = baseDelay[errorType] 
        × errorWeight 
        × timeOfDayFactor 
        × streakPenalty
        BLENDED WITH historicalRecoveryTime
        + jitter
```

| Factor | Source | What It Does |
|--------|--------|--------------|
| `errorType` | Auto-classified | Different base delays per error |
| `timeOfDayFactor` | Learned | Backs off more during bad hours |
| `recoveryTime` | Learned | "This endpoint recovers in ~200ms" |
| `successProbability` | Learned | Stops when success unlikely |
| `streakPenalty` | Calculated | Gentler than exponential (1.5x) |

---

## Usage Examples

### Basic Usage
```typescript
import { smartRetry } from 'adaptive-retry';

const result = await smartRetry(
  () => fetch('https://api.example.com/users/123'),
  { endpoint: 'user-api' }
);
```

### With Options
```typescript
import { smartRetry } from 'adaptive-retry';

const result = await smartRetry(
  () => fetch('https://api.example.com/data'),
  {
    endpoint: 'my-api',
    maxRetries: 5,
    timeout: 10000,
    onRetry: (info) => {
      console.log(`Attempt ${info.attempt} failed`);
      console.log(`Error type: ${info.errorCategory}`);
      console.log(`Retrying in ${info.delay}ms`);
      console.log(`Success probability: ${(info.successProbability * 100).toFixed(1)}%`);
    }
  }
);
```

### Using SmartRetry Class
```typescript
import { SmartRetry } from 'adaptive-retry';

const retry = new SmartRetry({
  config: {
    maxDelay: 60000,
    minDelay: 100,
    streakBase: 1.3,
  },
  circuitBreakerConfig: {
    failureThreshold: 10,
    resetTimeout: 60000,
  }
});

const result = await retry.execute(
  () => myApiCall(),
  { endpoint: 'payment-service' }
);

// Check stats
const stats = retry.getStats('payment-service');
console.log('Avg recovery time:', stats?.avgRecoveryTime);
```

### Circuit Breaker
```typescript
import { SmartRetry, CircuitOpenError } from 'adaptive-retry';

const retry = new SmartRetry();

try {
  await retry.execute(fn, { endpoint: 'my-api' });
} catch (error) {
  if (error instanceof CircuitOpenError) {
    console.log(`Circuit open! Retry in ${error.timeUntilRetry}ms`);
  }
}

// Manually reset circuit breaker
retry.resetCircuitBreaker('my-api');
```

### Custom Error Classification
```typescript
import { smartRetry, ErrorCategory } from 'adaptive-retry';

const result = await smartRetry(
  () => myApiCall(),
  {
    endpoint: 'custom-api',
    classifyError: (error, statusCode) => {
      if (statusCode === 418) return ErrorCategory.PERMANENT;
      if (error.message.includes('maintenance')) return ErrorCategory.OVERLOAD;
      return ErrorCategory.UNKNOWN;
    }
  }
);
```

---

## API Reference

### `smartRetry(fn, options)`
```typescript
const result = await smartRetry(fn, {
  endpoint: string;           // Required: unique identifier
  maxRetries?: number;        // Default: 5
  timeout?: number;           // Default: 30000 (ms)
  onRetry?: (info) => void;   // Callback before retry
  classifyError?: (error, statusCode?) => ErrorCategory;
  useCircuitBreaker?: boolean; // Default: true
});
```

### `new SmartRetry(options)`
```typescript
const retry = new SmartRetry({
  config?: Partial<AlgorithmConfig>;
  circuitBreakerConfig?: Partial<CircuitBreakerConfig>;
  useCircuitBreaker?: boolean;
  storageAdapter?: StorageAdapter;
});
```

---

## Error Categories

| Category | HTTP Codes | Examples | Base Delay |
|----------|:----------:|----------|:----------:|
| `TRANSIENT` | 500 | ECONNRESET, network error | 100ms |
| `OVERLOAD` | 429, 502, 503 | Rate limited, service unavailable | 1000ms |
| `TIMEOUT` | 504 | Request timeout, gateway timeout | 500ms |
| `PERMANENT` | 400, 401, 403, 404 | Bad request, not found | ⛔ No retry |
| `UNKNOWN` | — | Unrecognized errors | 300ms |

---

## Configuration

### Algorithm Config
```typescript
{
  baseDelays: {
    TRANSIENT: 100,
    OVERLOAD: 1000,
    TIMEOUT: 500,
    PERMANENT: 0,
    UNKNOWN: 300,
  },
  errorWeights: {
    TRANSIENT: 1.0,
    OVERLOAD: 3.0,    // 3x longer for overload
    TIMEOUT: 1.5,
    PERMANENT: 0,
    UNKNOWN: 2.0,
  },
  streakBase: 1.5,              // Gentler than 2x
  maxStreakPenalty: 10,         // Cap at 10x
  jitterPercent: 0.2,           // ±20% randomization
  maxDelay: 30000,              // 30s cap
  minDelay: 50,                 // 50ms floor
  minSuccessProbability: 0.1,   // Give up below 10%
  maxHistorySamples: 100,       // Stats retention
}
```

### Circuit Breaker Config
```typescript
{
  failureThreshold: 5,      // Failures before opening
  resetTimeout: 30000,      // Time before retry (ms)
  successThreshold: 2,      // Successes to close
}
```

---

## Persistent Storage (Optional)

For distributed systems:
```typescript
import { SmartRetry } from 'adaptive-retry';

const retry = new SmartRetry({
  storageAdapter: {
    async get(key) { return redis.get(key); },
    async set(key, stats) { await redis.set(key, JSON.stringify(stats)); },
    async delete(key) { await redis.del(key); },
    async keys() { return redis.keys('adaptive-retry:*'); },
  }
});

await retry.loadFromStorage();
```

---

## TypeScript Support
```typescript
import type {
  SmartRetryOptions,
  SmartRetryResult,
  RetryInfo,
  ErrorCategory,
  EndpointStats,
  AlgorithmConfig,
  CircuitBreakerConfig,
} from 'adaptive-retry';
```

---

## Contributing

Contributions are welcome! Please open an issue or submit a PR.

## License

MIT © [Prakhar998](https://github.com/Prakhar998)