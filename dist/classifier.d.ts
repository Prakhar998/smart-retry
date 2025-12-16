import { ErrorCategory } from './types';
export declare function extractStatusCode(error: unknown): number | undefined;
export declare function extractErrorCode(error: unknown): string | undefined;
export declare function classifyError(error: Error, statusCode?: number): ErrorCategory;
export declare function isRetryable(category: ErrorCategory): boolean;
export declare function getCategoryDescription(category: ErrorCategory): string;
//# sourceMappingURL=classifier.d.ts.map