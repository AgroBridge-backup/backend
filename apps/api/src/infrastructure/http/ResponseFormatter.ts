/**
 * @file Response Formatter
 * @description Standardized JSON response format for API v2
 *
 * Provides consistent response structure:
 * - Success responses with data, meta, and links
 * - Error responses with code, message, and details
 * - Pagination with HATEOAS links
 *
 * @author AgroBridge Engineering Team
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Success response structure
 */
export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
  links?: PaginationLinks;
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ErrorDetail[] | Record<string, unknown>;
    timestamp: string;
    path?: string;
    requestId?: string;
  };
}

/**
 * Error detail for validation errors
 */
export interface ErrorDetail {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * HATEOAS pagination links
 */
export interface PaginationLinks {
  self: string;
  first: string;
  prev: string | null;
  next: string | null;
  last: string;
}

/**
 * Generic API response
 */
export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSE FORMATTER CLASS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Response Formatter
 *
 * Provides standardized response formatting for REST API v2.
 * Ensures consistent structure across all endpoints.
 */
export class ResponseFormatter {
  /**
   * Format success response
   *
   * @example
   * ResponseFormatter.success({ id: '1', name: 'Test' })
   * // { success: true, data: { id: '1', name: 'Test' } }
   */
  static success<T>(data: T): SuccessResponse<T> {
    return {
      success: true,
      data,
    };
  }

  /**
   * Format paginated response
   *
   * @example
   * ResponseFormatter.paginated(batches, 100, 1, 20, '/api/v2/batches')
   * // { success: true, data: [...], meta: {...}, links: {...} }
   */
  static paginated<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
    baseUrl: string,
    queryParams?: Record<string, unknown>
  ): SuccessResponse<T[]> {
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return {
      success: true,
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
      links: this.buildPaginationLinks(
        baseUrl,
        page,
        limit,
        totalPages,
        queryParams
      ),
    };
  }

  /**
   * Format error response
   *
   * @example
   * ResponseFormatter.error('VALIDATION_ERROR', 'Invalid input', [{ field: 'email', message: 'Invalid format' }])
   * // { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: [...] } }
   */
  static error(
    code: string,
    message: string,
    details?: ErrorDetail[] | Record<string, unknown>,
    path?: string,
    requestId?: string
  ): ErrorResponse {
    return {
      success: false,
      error: {
        code,
        message,
        details,
        timestamp: new Date().toISOString(),
        path,
        requestId,
      },
    };
  }

  /**
   * Format validation error response
   *
   * @example
   * ResponseFormatter.validationError([{ field: 'email', message: 'Required' }])
   */
  static validationError(
    errors: ErrorDetail[],
    path?: string
  ): ErrorResponse {
    return this.error(
      'VALIDATION_ERROR',
      'Request validation failed',
      errors,
      path
    );
  }

  /**
   * Format not found error response
   */
  static notFound(
    resource: string,
    id?: string,
    path?: string
  ): ErrorResponse {
    const message = id
      ? `${resource} with ID '${id}' not found`
      : `${resource} not found`;

    return this.error('NOT_FOUND', message, undefined, path);
  }

  /**
   * Format unauthorized error response
   */
  static unauthorized(
    message: string = 'Authentication required',
    path?: string
  ): ErrorResponse {
    return this.error('UNAUTHORIZED', message, undefined, path);
  }

  /**
   * Format forbidden error response
   */
  static forbidden(
    message: string = 'Access denied',
    path?: string
  ): ErrorResponse {
    return this.error('FORBIDDEN', message, undefined, path);
  }

  /**
   * Format rate limit error response
   */
  static rateLimited(
    retryAfter?: number,
    path?: string
  ): ErrorResponse {
    return this.error(
      'RATE_LIMITED',
      'Too many requests. Please try again later.',
      retryAfter ? { retryAfter } : undefined,
      path
    );
  }

  /**
   * Format internal error response
   */
  static internalError(
    message: string = 'An unexpected error occurred',
    path?: string,
    requestId?: string
  ): ErrorResponse {
    return this.error(
      'INTERNAL_ERROR',
      message,
      undefined,
      path,
      requestId
    );
  }

  /**
   * Format conflict error response
   */
  static conflict(
    message: string,
    details?: Record<string, unknown>,
    path?: string
  ): ErrorResponse {
    return this.error('CONFLICT', message, details, path);
  }

  /**
   * Format bad request error response
   */
  static badRequest(
    message: string,
    details?: Record<string, unknown>,
    path?: string
  ): ErrorResponse {
    return this.error('BAD_REQUEST', message, details, path);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Build pagination links
   */
  private static buildPaginationLinks(
    baseUrl: string,
    page: number,
    limit: number,
    totalPages: number,
    queryParams?: Record<string, unknown>
  ): PaginationLinks {
    const buildUrl = (p: number): string => {
      const params = new URLSearchParams();

      // Add existing query params (except page/limit)
      if (queryParams) {
        Object.entries(queryParams).forEach(([key, value]) => {
          if (key !== 'page' && key !== 'limit' && value !== undefined) {
            if (typeof value === 'object') {
              // Handle nested objects like filter[status]
              Object.entries(value as Record<string, unknown>).forEach(
                ([nestedKey, nestedValue]) => {
                  if (typeof nestedValue === 'object' && nestedValue !== null) {
                    Object.entries(nestedValue as Record<string, unknown>).forEach(
                      ([opKey, opValue]) => {
                        params.append(`${key}[${nestedKey}][${opKey}]`, String(opValue));
                      }
                    );
                  } else {
                    params.append(`${key}[${nestedKey}]`, String(nestedValue));
                  }
                }
              );
            } else {
              params.append(key, String(value));
            }
          }
        });
      }

      params.set('page', p.toString());
      params.set('limit', limit.toString());

      return `${baseUrl}?${params.toString()}`;
    };

    return {
      self: buildUrl(page),
      first: buildUrl(1),
      prev: page > 1 ? buildUrl(page - 1) : null,
      next: page < totalPages ? buildUrl(page + 1) : null,
      last: buildUrl(Math.max(totalPages, 1)),
    };
  }

  /**
   * Create response with custom status code helper
   * (For use with Express res.status().json())
   */
  static withStatus<T>(
    status: number,
    response: ApiResponse<T>
  ): { status: number; body: ApiResponse<T> } {
    return { status, body: response };
  }

  /**
   * Check if response is error
   */
  static isError(response: ApiResponse<unknown>): response is ErrorResponse {
    return !response.success;
  }

  /**
   * Transform Prisma errors to user-friendly format
   */
  static fromPrismaError(error: unknown, path?: string): ErrorResponse {
    // Handle Prisma known errors
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as { code: string; meta?: { target?: string[] } };

      switch (prismaError.code) {
        case 'P2002': // Unique constraint violation
          return this.conflict(
            'A record with this value already exists',
            { fields: prismaError.meta?.target },
            path
          );

        case 'P2025': // Record not found
          return this.notFound('Record', undefined, path);

        case 'P2003': // Foreign key constraint violation
          return this.badRequest(
            'Referenced record does not exist',
            { fields: prismaError.meta?.target },
            path
          );

        default:
          return this.internalError('Database operation failed', path);
      }
    }

    return this.internalError('An unexpected error occurred', path);
  }
}

export default ResponseFormatter;
