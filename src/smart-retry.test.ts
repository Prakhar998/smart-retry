import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  SmartRetry, 
  smartRetry, 
  classifyError, 
  ErrorCategory,
  CircuitOpenError 
} from './index';

describe('SmartRetry', () => {
  let retry: SmartRetry;

  beforeEach(() => {
    retry = new SmartRetry();
    retry.clearAllStats();
  });

  describe('basic execution', () => {
    it('should return result on success', async () => {
      const fn = vi.fn().mockResolvedValue({ data: 'success' });

      const result = await retry.execute(fn, { endpoint: 'test' });

      expect(result.data).toEqual({ data: 'success' });
      expect(result.attempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on transient failure then succeed', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValue({ data: 'success' });

      const result = await retry.execute(fn, { 
        endpoint: 'test',
        maxRetries: 3 
      });

      expect(result.data).toEqual({ data: 'success' });
      expect(result.attempts).toBe(2);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should not retry permanent errors', async () => {
      const error = new Error('Not Found');
      (error as any).status = 404;
      const fn = vi.fn().mockRejectedValue(error);

      await expect(
        retry.execute(fn, { endpoint: 'test', maxRetries: 3 })
      ).rejects.toThrow('Not Found');

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should exhaust retries and throw', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('ECONNRESET'));

      await expect(
        retry.execute(fn, { endpoint: 'test', maxRetries: 3 })
      ).rejects.toThrow('ECONNRESET');

      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe('onRetry callback', () => {
    it('should call onRetry with retry info', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValue('success');

      const onRetry = vi.fn();

      await retry.execute(fn, { 
        endpoint: 'test',
        maxRetries: 3,
        onRetry 
      });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        expect.objectContaining({
          attempt: 1,
          delay: expect.any(Number),
          error: expect.any(Error),
          errorCategory: ErrorCategory.TIMEOUT,
        })
      );
    });
  });

  describe('timeout', () => {
    it('should timeout slow requests', async () => {
      const fn = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 5000))
      );

      await expect(
        retry.execute(fn, { 
          endpoint: 'test',
          timeout: 100,
          maxRetries: 1 
        })
      ).rejects.toThrow('Timeout');
    });
  });

  describe('stats tracking', () => {
    it('should track endpoint stats', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      await retry.execute(fn, { endpoint: 'stats-test' });
      await retry.execute(fn, { endpoint: 'stats-test' });

      const stats = retry.getStats('stats-test');
      expect(stats).not.toBeNull();
      expect(stats?.endpoint).toBe('stats-test');
    });

    it('should list tracked endpoints', async () => {
      await retry.execute(vi.fn().mockResolvedValue('a'), { endpoint: 'api-a' });
      await retry.execute(vi.fn().mockResolvedValue('b'), { endpoint: 'api-b' });

      const endpoints = retry.getTrackedEndpoints();
      expect(endpoints).toContain('api-a');
      expect(endpoints).toContain('api-b');
    });
  });
});

describe('classifyError', () => {
  it('should classify HTTP status codes', () => {
    const error404 = new Error('Not found');
    (error404 as any).status = 404;
    expect(classifyError(error404)).toBe(ErrorCategory.PERMANENT);

    const error429 = new Error('Rate limited');
    (error429 as any).status = 429;
    expect(classifyError(error429)).toBe(ErrorCategory.OVERLOAD);

    const error500 = new Error('Internal error');
    (error500 as any).status = 500;
    expect(classifyError(error500)).toBe(ErrorCategory.TRANSIENT);
  });

  it('should classify by error message', () => {
    expect(classifyError(new Error('ECONNRESET'))).toBe(ErrorCategory.TRANSIENT);
    expect(classifyError(new Error('timeout'))).toBe(ErrorCategory.TIMEOUT);
    expect(classifyError(new Error('rate limit exceeded'))).toBe(ErrorCategory.OVERLOAD);
    expect(classifyError(new Error('ENOTFOUND'))).toBe(ErrorCategory.PERMANENT);
  });

  it('should return UNKNOWN for unrecognized errors', () => {
    expect(classifyError(new Error('Something weird'))).toBe(ErrorCategory.UNKNOWN);
  });
});

describe('smartRetry convenience function', () => {
  it('should work with default instance', async () => {
    const fn = vi.fn().mockResolvedValue('data');

    const result = await smartRetry(fn, { endpoint: 'convenience-test' });

    expect(result.data).toBe('data');
  });
});

describe('Circuit Breaker', () => {
  it('should open after threshold failures', async () => {
    const retry = new SmartRetry({
      circuitBreakerConfig: {
        failureThreshold: 2,
        resetTimeout: 10000,
      },
    });

    const fn = vi.fn().mockRejectedValue(new Error('ECONNRESET'));

    // First two attempts exhaust retries
    await expect(
      retry.execute(fn, { endpoint: 'cb-test', maxRetries: 1 })
    ).rejects.toThrow();

    await expect(
      retry.execute(fn, { endpoint: 'cb-test', maxRetries: 1 })
    ).rejects.toThrow();

    // Third attempt should hit open circuit
    await expect(
      retry.execute(fn, { endpoint: 'cb-test', maxRetries: 1 })
    ).rejects.toThrow(CircuitOpenError);
  });

  it('should allow manual reset', async () => {
    const retry = new SmartRetry({
      circuitBreakerConfig: { failureThreshold: 1 },
    });

    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValue('success');

    await expect(
      retry.execute(fn, { endpoint: 'reset-test', maxRetries: 1 })
    ).rejects.toThrow();

    // Circuit should be open
    await expect(
      retry.execute(fn, { endpoint: 'reset-test', maxRetries: 1 })
    ).rejects.toThrow(CircuitOpenError);

    // Reset and retry
    retry.resetCircuitBreaker('reset-test');
    const result = await retry.execute(fn, { endpoint: 'reset-test', maxRetries: 1 });
    expect(result.data).toBe('success');
  });
});