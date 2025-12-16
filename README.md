# smart-retry-ai

Intelligent retry mechanism that learns from failure patterns — smarter than exponential backoff.

## Install

```bash
npm install smart-retry-ai
```

## Usage

```typescript
import { smartRetry } from 'smart-retry-ai';

const result = await smartRetry(
  () => fetch('https://api.example.com/data'),
  { endpoint: 'my-api' }
);
```

## Features

- **Intelligent error classification** — different strategies for timeout vs rate-limit vs network error
- **Learns from patterns** — adapts delays based on historical recovery times
- **Time-of-day awareness** — backs off more during historically bad hours
- **Built-in circuit breaker** — prevents hammering dead services
- **Success probability** — stops retrying when success is unlikely

## License

MIT
