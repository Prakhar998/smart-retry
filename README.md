```markdown
# smart-retry

Intelligent retry mechanism that learns from failure patterns — smarter than exponential backoff.

[![npm version](https://img.shields.io/npm/v/smart-retry.svg)](https://www.npmjs.com/package/smart-retry)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Why SmartRetry?

Traditional exponential backoff is dumb:

- Treats all failures the same (timeout vs 500 vs rate limit)
- Ignores context (retrying at 3am vs peak hours)
- Doesn't learn (same mistake, same strategy, forever)
- Arbitrary multipliers (why 2x? why not 1.5x?)
- Wastes time (waiting 32s when service recovered in 2s)

**SmartRetry learns from your actual failure patterns** to calculate optimal retry delays.

## Install

```bash
npm install smart-retry
```

## Quick Start

```typescript
import { smartRetry } from 'smart-retry';

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

## How It Works

SmartRetry calculates delay using learned patterns:

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
| `errorType` | Auto-classified from error | Different base delays for timeout vs rate-limit vs network error |
| `timeOfDayFactor` | Learned from history | If failures spike at 9am, waits longer at 9am |
| `recoveryTime` | Learned from history | "This endpoint usually recovers in ~200ms" |
| `successProbability` | Learned from history | Stops retrying when success is unlikely |
| `streakPenalty` | Calculated | Gentler than exponential (1.5x not 2x) |

## Usage Examples

### Basic Usage

```typescript
import { smartRetry } from 'smart-retry';

const result = await smartRetry(
  () => fetch('https://api.example.com/users/123'),
  { endpoint: 'user-api' }
);
```

### With Options

```typescript
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
import { SmartRetry } from 'smart-retry';

const retry = new SmartRetry({
  config: {
    maxDelay: 60000,        // Cap delays at 60s
    minDelay: 100,          // Minimum 100ms between retries
    streakBase: 1.3,        // Gentler backoff multiplier
  },
  circuitBreakerConfig: {
    failureThreshold: 10,   // Open circuit after 10 failures
    resetTimeout: 60000,    // Try again after 60s
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
import { SmartRetry, CircuitOpenError } from 'smart-retry';

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
import { smartRetry, ErrorCategory } from 'smart-retry';

const result = await smartRetry(
  () => myApiCall(),
  {
    endpoint: 'custom-api',
    classifyError: (error, statusCode) => {
      // Custom logic
      if (statusCode === 418) return ErrorCategory.PERMANENT;
      if (error.message.includes('maintenance')) return ErrorCategory.OVERLOAD;
      return ErrorCategory.UNKNOWN;
    }
  }
);
```

## API Reference

### `smartRetry(fn, options)`

Simple function for quick usage.

```typescript
const result = await smartRetry(fn, {
  endpoint: string;           // Required: unique identifier for stats tracking
  maxRetries?: number;        // Default: 5
  timeout?: number;           // Default: 30000 (ms)
  onRetry?: (info) => void;   // Callback before each retry
  classifyError?: (error, statusCode?) => ErrorCategory;  // Custom classifier
  useCircuitBreaker?: boolean; // Default: true
});
```

### `new SmartRetry(options)`

Create an instance for advanced usage.

```typescript
const retry = new SmartRetry({
  config?: Partial<AlgorithmConfig>;
  circuitBreakerConfig?: Partial<CircuitBreakerConfig>;
  useCircuitBreaker?: boolean;
  storageAdapter?: StorageAdapter;  // For persistent stats
});
```

### `classifyError(error, statusCode?)`

Manually classify an error.

```typescript
import { classifyError, ErrorCategory } from 'smart-retry';

const category = classifyError(new Error('ECONNRESET'));
// Returns: ErrorCategory.TRANSIENT
```

## Error Categories

| Category | Examples | Behavior |
|----------|----------|----------|
| `TRANSIENT` | ECONNRESET, network error | Fast retry (100ms base) |
| `OVERLOAD` | 429, 503 | Back off significantly (1000ms base) |
| `TIMEOUT` | Request timeout | Medium backoff (500ms base) |
| `PERMANENT` | 400, 401, 404 | No retry |
| `UNKNOWN` | Unrecognized errors | Conservative retry (300ms base) |

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
    OVERLOAD: 3.0,
    TIMEOUT: 1.5,
    PERMANENT: 0,
    UNKNOWN: 2.0,
  },
  streakBase: 1.5,              // Multiplier per retry (gentler than 2x)
  maxStreakPenalty: 10,         // Cap multiplier at 10x
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

## Comparison with Exponential Backoff

| Attempt | Exponential (2x) | SmartRetry |
|---------|------------------|------------|
| 1 | 1000ms | 100-300ms (based on error type) |
| 2 | 2000ms | 150-500ms (learns from history) |
| 3 | 4000ms | 200-800ms |
| 4 | 8000ms | 300-1200ms |
| 5 | 16000ms | May stop early if P(success) < 10% |

SmartRetry is typically **30-70% faster** while being more respectful of overloaded servers.

## Persistent Storage (Optional)

For distributed systems, persist stats across restarts:

```typescript
const retry = new SmartRetry({
  storageAdapter: {
    async get(key) { return redis.get(key); },
    async set(key, stats) { await redis.set(key, JSON.stringify(stats)); },
    async delete(key) { await redis.del(key); },
    async keys() { return redis.keys('smart-retry:*'); },
  }
});

// Load previous stats on startup
await retry.loadFromStorage();
```

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type {
  SmartRetryOptions,
  SmartRetryResult,
  RetryInfo,
  ErrorCategory,
  EndpointStats,
  AlgorithmConfig,
  CircuitBreakerConfig,
} from 'smart-retry';
```

## Contributing

Contributions are welcome! Please open an issue or submit a PR.

## License

MIT © [Prakhar998](https://github.com/Prakhar998)
```

---
