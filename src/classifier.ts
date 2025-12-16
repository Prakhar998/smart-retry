import { ErrorCategory } from './types';

const STATUS_CATEGORIES: Record<number, ErrorCategory> = {
  400: ErrorCategory.PERMANENT, 401: ErrorCategory.PERMANENT,
  403: ErrorCategory.PERMANENT, 404: ErrorCategory.PERMANENT,
  405: ErrorCategory.PERMANENT, 410: ErrorCategory.PERMANENT,
  422: ErrorCategory.PERMANENT, 429: ErrorCategory.OVERLOAD,
  500: ErrorCategory.TRANSIENT, 502: ErrorCategory.OVERLOAD,
  503: ErrorCategory.OVERLOAD, 504: ErrorCategory.TIMEOUT,
};

const MESSAGE_PATTERNS: Array<{ pattern: RegExp; category: ErrorCategory }> = [
  { pattern: /timeout|timedout|timed out|ETIMEDOUT/i, category: ErrorCategory.TIMEOUT },
  { pattern: /ECONNRESET|ECONNREFUSED|EPIPE|ENETUNREACH|EHOSTUNREACH|connection reset|socket hang up|network error/i, category: ErrorCategory.TRANSIENT },
  { pattern: /ENOTFOUND|getaddrinfo/i, category: ErrorCategory.PERMANENT },
  { pattern: /rate limit|too many requests|throttl/i, category: ErrorCategory.OVERLOAD },
  { pattern: /service unavailable|temporarily unavailable/i, category: ErrorCategory.OVERLOAD },
  { pattern: /certificate|SSL|TLS/i, category: ErrorCategory.PERMANENT },
];

const ERROR_CODES: Record<string, ErrorCategory> = {
  'ETIMEDOUT': ErrorCategory.TIMEOUT, 'ESOCKETTIMEDOUT': ErrorCategory.TIMEOUT,
  'ECONNRESET': ErrorCategory.TRANSIENT, 'ECONNREFUSED': ErrorCategory.TRANSIENT,
  'ECONNABORTED': ErrorCategory.TRANSIENT, 'EPIPE': ErrorCategory.TRANSIENT,
  'ENETUNREACH': ErrorCategory.TRANSIENT, 'EHOSTUNREACH': ErrorCategory.TRANSIENT,
  'ENOTFOUND': ErrorCategory.PERMANENT, 'EAI_AGAIN': ErrorCategory.TRANSIENT,
};

export function extractStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const err = error as Record<string, unknown>;
  if (typeof err.status === 'number') return err.status;
  if (typeof err.statusCode === 'number') return err.statusCode;
  if (err.response && typeof err.response === 'object') {
    const response = err.response as Record<string, unknown>;
    if (typeof response.status === 'number') return response.status;
  }
  return undefined;
}

export function extractErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const err = error as Record<string, unknown>;
  if (typeof err.code === 'string') return err.code;
  if (err.cause && typeof err.cause === 'object') {
    const cause = err.cause as Record<string, unknown>;
    if (typeof cause.code === 'string') return cause.code;
  }
  return undefined;
}

export function classifyError(error: Error, statusCode?: number): ErrorCategory {
  const status = statusCode ?? extractStatusCode(error);
  if (status !== undefined) {
    if (status in STATUS_CATEGORIES) return STATUS_CATEGORIES[status];
    if (status >= 400 && status < 500) return ErrorCategory.PERMANENT;
    if (status >= 500) return ErrorCategory.TRANSIENT;
  }
  const errorCode = extractErrorCode(error);
  if (errorCode && errorCode in ERROR_CODES) return ERROR_CODES[errorCode];
  const message = error.message || '';
  for (const { pattern, category } of MESSAGE_PATTERNS) {
    if (pattern.test(message)) return category;
  }
  const name = error.name || '';
  if (name.includes('Timeout')) return ErrorCategory.TIMEOUT;
  if (name.includes('Network')) return ErrorCategory.TRANSIENT;
  if (name.includes('Abort')) return ErrorCategory.PERMANENT;
  return ErrorCategory.UNKNOWN;
}

export function isRetryable(category: ErrorCategory): boolean {
  return category !== ErrorCategory.PERMANENT;
}

export function getCategoryDescription(category: ErrorCategory): string {
  const descriptions: Record<ErrorCategory, string> = {
    [ErrorCategory.TRANSIENT]: 'Temporary network issue - fast retry',
    [ErrorCategory.OVERLOAD]: 'Service overloaded - back off significantly',
    [ErrorCategory.TIMEOUT]: 'Request timed out - medium backoff',
    [ErrorCategory.PERMANENT]: 'Permanent error - do not retry',
    [ErrorCategory.UNKNOWN]: 'Unknown error - conservative retry',
  };
  return descriptions[category];
}
