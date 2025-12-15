import { GraphQLError } from 'graphql';
export class AuthenticationError extends GraphQLError {
    constructor(message = 'Authentication required') {
        super(message, {
            extensions: {
                code: 'UNAUTHENTICATED',
                http: { status: 401 },
            },
        });
    }
}
export class ForbiddenError extends GraphQLError {
    constructor(message = 'Access denied') {
        super(message, {
            extensions: {
                code: 'FORBIDDEN',
                http: { status: 403 },
            },
        });
    }
}
export class ValidationError extends GraphQLError {
    constructor(message, fields) {
        super(message, {
            extensions: {
                code: 'VALIDATION_ERROR',
                fields,
                http: { status: 400 },
            },
        });
    }
}
export class NotFoundError extends GraphQLError {
    constructor(resource, id) {
        const message = id
            ? `${resource} with ID '${id}' not found`
            : `${resource} not found`;
        super(message, {
            extensions: {
                code: 'NOT_FOUND',
                resource,
                id,
                http: { status: 404 },
            },
        });
    }
}
export class ConflictError extends GraphQLError {
    constructor(message, details) {
        super(message, {
            extensions: {
                code: 'CONFLICT',
                details,
                http: { status: 409 },
            },
        });
    }
}
export class RateLimitError extends GraphQLError {
    constructor(retryAfter) {
        super('Too many requests. Please try again later.', {
            extensions: {
                code: 'RATE_LIMITED',
                retryAfter,
                http: { status: 429 },
            },
        });
    }
}
export class InternalError extends GraphQLError {
    constructor(message = 'An unexpected error occurred') {
        super(message, {
            extensions: {
                code: 'INTERNAL_ERROR',
                http: { status: 500 },
            },
        });
    }
}
export function formatGraphQLError(error) {
    if (error instanceof GraphQLError) {
        return error;
    }
    if (error instanceof Error) {
        return new InternalError(error.message);
    }
    return new InternalError('An unexpected error occurred');
}
export function isUserError(error) {
    const code = error.extensions?.code;
    return ['UNAUTHENTICATED', 'FORBIDDEN', 'VALIDATION_ERROR', 'NOT_FOUND', 'CONFLICT', 'RATE_LIMITED'].includes(code);
}
