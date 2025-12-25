/**
 * @file Error Type Definitions
 * @description Type-safe error handling interfaces
 */

/**
 * HTTP Error with status code
 */
export interface HttpError extends Error {
  statusCode?: number;
  status?: number;
  code?: string;
}

/**
 * Database error with code
 */
export interface DatabaseError extends Error {
  code?: string;
}

/**
 * Firebase/FCM error
 */
export interface FirebaseError extends Error {
  code?: string;
  errorInfo?: {
    code: string;
    message: string;
  };
}

/**
 * Type guard for HttpError
 */
export function isHttpError(error: unknown): error is HttpError {
  return error instanceof Error && ('statusCode' in error || 'status' in error);
}

/**
 * Type guard for DatabaseError
 */
export function isDatabaseError(error: unknown): error is DatabaseError {
  return error instanceof Error && 'code' in error;
}

/**
 * Get status code from error (with fallback)
 */
export function getErrorStatusCode(error: unknown, defaultCode = 500): number {
  if (isHttpError(error)) {
    return error.statusCode || error.status || defaultCode;
  }
  return defaultCode;
}

/**
 * Get error code string (with fallback)
 */
export function getErrorCode(error: unknown, defaultCode = 'INTERNAL_ERROR'): string {
  if (error instanceof Error && 'code' in error) {
    return (error as DatabaseError).code || defaultCode;
  }
  return defaultCode;
}
