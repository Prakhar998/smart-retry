"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractStatusCode = extractStatusCode;
exports.extractErrorCode = extractErrorCode;
exports.classifyError = classifyError;
exports.isRetryable = isRetryable;
exports.getCategoryDescription = getCategoryDescription;
const types_1 = require("./types");
const STATUS_CATEGORIES = {
    400: types_1.ErrorCategory.PERMANENT, 401: types_1.ErrorCategory.PERMANENT,
    403: types_1.ErrorCategory.PERMANENT, 404: types_1.ErrorCategory.PERMANENT,
    405: types_1.ErrorCategory.PERMANENT, 410: types_1.ErrorCategory.PERMANENT,
    422: types_1.ErrorCategory.PERMANENT, 429: types_1.ErrorCategory.OVERLOAD,
    500: types_1.ErrorCategory.TRANSIENT, 502: types_1.ErrorCategory.OVERLOAD,
    503: types_1.ErrorCategory.OVERLOAD, 504: types_1.ErrorCategory.TIMEOUT,
};
const MESSAGE_PATTERNS = [
    { pattern: /timeout|timedout|timed out|ETIMEDOUT/i, category: types_1.ErrorCategory.TIMEOUT },
    { pattern: /ECONNRESET|ECONNREFUSED|EPIPE|ENETUNREACH|EHOSTUNREACH|connection reset|socket hang up|network error/i, category: types_1.ErrorCategory.TRANSIENT },
    { pattern: /ENOTFOUND|getaddrinfo/i, category: types_1.ErrorCategory.PERMANENT },
    { pattern: /rate limit|too many requests|throttl/i, category: types_1.ErrorCategory.OVERLOAD },
    { pattern: /service unavailable|temporarily unavailable/i, category: types_1.ErrorCategory.OVERLOAD },
    { pattern: /certificate|SSL|TLS/i, category: types_1.ErrorCategory.PERMANENT },
];
const ERROR_CODES = {
    'ETIMEDOUT': types_1.ErrorCategory.TIMEOUT, 'ESOCKETTIMEDOUT': types_1.ErrorCategory.TIMEOUT,
    'ECONNRESET': types_1.ErrorCategory.TRANSIENT, 'ECONNREFUSED': types_1.ErrorCategory.TRANSIENT,
    'ECONNABORTED': types_1.ErrorCategory.TRANSIENT, 'EPIPE': types_1.ErrorCategory.TRANSIENT,
    'ENETUNREACH': types_1.ErrorCategory.TRANSIENT, 'EHOSTUNREACH': types_1.ErrorCategory.TRANSIENT,
    'ENOTFOUND': types_1.ErrorCategory.PERMANENT, 'EAI_AGAIN': types_1.ErrorCategory.TRANSIENT,
};
function extractStatusCode(error) {
    if (!error || typeof error !== 'object')
        return undefined;
    const err = error;
    if (typeof err.status === 'number')
        return err.status;
    if (typeof err.statusCode === 'number')
        return err.statusCode;
    if (err.response && typeof err.response === 'object') {
        const response = err.response;
        if (typeof response.status === 'number')
            return response.status;
    }
    return undefined;
}
function extractErrorCode(error) {
    if (!error || typeof error !== 'object')
        return undefined;
    const err = error;
    if (typeof err.code === 'string')
        return err.code;
    if (err.cause && typeof err.cause === 'object') {
        const cause = err.cause;
        if (typeof cause.code === 'string')
            return cause.code;
    }
    return undefined;
}
function classifyError(error, statusCode) {
    const status = statusCode ?? extractStatusCode(error);
    if (status !== undefined) {
        if (status in STATUS_CATEGORIES)
            return STATUS_CATEGORIES[status];
        if (status >= 400 && status < 500)
            return types_1.ErrorCategory.PERMANENT;
        if (status >= 500)
            return types_1.ErrorCategory.TRANSIENT;
    }
    const errorCode = extractErrorCode(error);
    if (errorCode && errorCode in ERROR_CODES)
        return ERROR_CODES[errorCode];
    const message = error.message || '';
    for (const { pattern, category } of MESSAGE_PATTERNS) {
        if (pattern.test(message))
            return category;
    }
    const name = error.name || '';
    if (name.includes('Timeout'))
        return types_1.ErrorCategory.TIMEOUT;
    if (name.includes('Network'))
        return types_1.ErrorCategory.TRANSIENT;
    if (name.includes('Abort'))
        return types_1.ErrorCategory.PERMANENT;
    return types_1.ErrorCategory.UNKNOWN;
}
function isRetryable(category) {
    return category !== types_1.ErrorCategory.PERMANENT;
}
function getCategoryDescription(category) {
    const descriptions = {
        [types_1.ErrorCategory.TRANSIENT]: 'Temporary network issue - fast retry',
        [types_1.ErrorCategory.OVERLOAD]: 'Service overloaded - back off significantly',
        [types_1.ErrorCategory.TIMEOUT]: 'Request timed out - medium backoff',
        [types_1.ErrorCategory.PERMANENT]: 'Permanent error - do not retry',
        [types_1.ErrorCategory.UNKNOWN]: 'Unknown error - conservative retry',
    };
    return descriptions[category];
}
//# sourceMappingURL=classifier.js.map