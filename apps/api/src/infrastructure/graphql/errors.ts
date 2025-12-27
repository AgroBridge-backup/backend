/**
 * @file GraphQL Errors
 * @description Custom GraphQL error classes
 *
 * @author AgroBridge Engineering Team
 */

import { GraphQLError } from "graphql";

// ═══════════════════════════════════════════════════════════════════════════════
// AUTHENTICATION ERROR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Authentication required error
 */
export class AuthenticationError extends GraphQLError {
  constructor(message: string = "Authentication required") {
    super(message, {
      extensions: {
        code: "UNAUTHENTICATED",
        http: { status: 401 },
      },
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORBIDDEN ERROR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Access forbidden error
 */
export class ForbiddenError extends GraphQLError {
  constructor(message: string = "Access denied") {
    super(message, {
      extensions: {
        code: "FORBIDDEN",
        http: { status: 403 },
      },
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION ERROR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Input validation error
 */
export class ValidationError extends GraphQLError {
  constructor(message: string, fields?: Record<string, string>) {
    super(message, {
      extensions: {
        code: "VALIDATION_ERROR",
        fields,
        http: { status: 400 },
      },
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOT FOUND ERROR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Resource not found error
 */
export class NotFoundError extends GraphQLError {
  constructor(resource: string, id?: string) {
    const message = id
      ? `${resource} with ID '${id}' not found`
      : `${resource} not found`;

    super(message, {
      extensions: {
        code: "NOT_FOUND",
        resource,
        id,
        http: { status: 404 },
      },
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFLICT ERROR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Resource conflict error
 */
export class ConflictError extends GraphQLError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, {
      extensions: {
        code: "CONFLICT",
        details,
        http: { status: 409 },
      },
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMIT ERROR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Rate limit exceeded error
 */
export class RateLimitError extends GraphQLError {
  constructor(retryAfter?: number) {
    super("Too many requests. Please try again later.", {
      extensions: {
        code: "RATE_LIMITED",
        retryAfter,
        http: { status: 429 },
      },
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL ERROR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Internal server error
 */
export class InternalError extends GraphQLError {
  constructor(message: string = "An unexpected error occurred") {
    super(message, {
      extensions: {
        code: "INTERNAL_ERROR",
        http: { status: 500 },
      },
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR FORMATTER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format error for GraphQL response
 */
export function formatGraphQLError(error: unknown): GraphQLError {
  // Already a GraphQL error
  if (error instanceof GraphQLError) {
    return error;
  }

  // Standard Error
  if (error instanceof Error) {
    return new InternalError(error.message);
  }

  // Unknown error
  return new InternalError("An unexpected error occurred");
}

/**
 * Check if error is a user error (not internal)
 */
export function isUserError(error: GraphQLError): boolean {
  const code = error.extensions?.code;
  return [
    "UNAUTHENTICATED",
    "FORBIDDEN",
    "VALIDATION_ERROR",
    "NOT_FOUND",
    "CONFLICT",
    "RATE_LIMITED",
  ].includes(code as string);
}
