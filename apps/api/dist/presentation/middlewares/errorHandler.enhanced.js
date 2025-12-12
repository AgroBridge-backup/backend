/**
 * Enhanced Global Error Handler Middleware
 * - Handles all custom error types
 * - Maps Prisma errors to HTTP responses
 * - Maps JWT errors
 * - Provides detailed errors in development, sanitized in production
 */
import { Prisma } from '@prisma/client';
import { AppError, TooManyRequestsError, ServiceUnavailableError, } from '../../shared/errors/index.js';
import logger from '../../shared/utils/logger.js';
/**
 * Enhanced error handler with comprehensive error mapping
 */
export const errorHandler = (error, req, res, next) => {
    // Log error with context
    const errorContext = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        // Include traceId if context middleware is used
        traceId: req.traceId,
    };
    logger.error('Error occurred', errorContext);
    // ═══════════════════════════════════════════════════════════════════════════
    // Handle Custom Application Errors
    // ═══════════════════════════════════════════════════════════════════════════
    if (error instanceof AppError) {
        const response = {
            success: false,
            error: error.message,
        };
        // Add details if available
        if (error.details) {
            response.details = error.details;
        }
        // Add retry-after for rate limiting errors
        if (error instanceof TooManyRequestsError || error instanceof ServiceUnavailableError) {
            if (error.retryAfter) {
                response.retryAfter = error.retryAfter;
                res.setHeader('Retry-After', error.retryAfter);
            }
        }
        // Include stack trace in development
        if (process.env.NODE_ENV === 'development') {
            response.stack = error.stack;
        }
        return res.status(error.statusCode).json(response);
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // Handle Prisma Errors
    // ═══════════════════════════════════════════════════════════════════════════
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // P2002: Unique constraint violation
        if (error.code === 'P2002') {
            const target = error.meta?.target || [];
            return res.status(409).json({
                success: false,
                error: 'Duplicate entry',
                details: {
                    field: target[0],
                    message: `${target[0]} already exists`,
                },
            });
        }
        // P2025: Record not found
        if (error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                error: 'Record not found',
                message: 'The requested resource does not exist',
            });
        }
        // P2003: Foreign key constraint failed
        if (error.code === 'P2003') {
            return res.status(400).json({
                success: false,
                error: 'Invalid reference',
                details: {
                    field: error.meta?.field_name,
                    message: 'Referenced record does not exist',
                },
            });
        }
        // P2014: Relation violation
        if (error.code === 'P2014') {
            return res.status(409).json({
                success: false,
                error: 'Cannot delete resource',
                message: 'Resource has dependent records that must be deleted first',
            });
        }
        // Generic Prisma error
        return res.status(400).json({
            success: false,
            error: 'Database error',
            message: process.env.NODE_ENV === 'development' ? error.message : 'A database error occurred',
        });
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // Handle JWT Errors
    // ═══════════════════════════════════════════════════════════════════════════
    if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            error: 'Invalid token',
            message: 'Authentication token is invalid',
        });
    }
    if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            error: 'Token expired',
            message: 'Authentication token has expired',
        });
    }
    if (error.name === 'NotBeforeError') {
        return res.status(401).json({
            success: false,
            error: 'Token not active',
            message: 'Authentication token is not yet valid',
        });
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // Handle Validation Errors
    // ═══════════════════════════════════════════════════════════════════════════
    if (error.name === 'ValidationError' || error.name === 'ZodError') {
        return res.status(400).json({
            success: false,
            error: 'Validation error',
            details: error.details || error.errors || error.message,
        });
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // Handle Syntax Errors (malformed JSON)
    // ═══════════════════════════════════════════════════════════════════════════
    if (error instanceof SyntaxError && 'body' in error) {
        return res.status(400).json({
            success: false,
            error: 'Invalid JSON',
            message: 'Request body contains invalid JSON',
        });
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // Handle Unknown/Unexpected Errors
    // ═══════════════════════════════════════════════════════════════════════════
    logger.error('Unexpected error', {
        error: error.message,
        stack: error.stack,
        name: error.name,
    });
    return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred',
        ...(process.env.NODE_ENV === 'development' && {
            details: {
                message: error.message,
                stack: error.stack,
                name: error.name,
            },
        }),
    });
};
/**
 * Handle 404 - Not Found
 */
export const notFoundHandler = (req, res, next) => {
    res.status(404).json({
        success: false,
        error: 'Route not found',
        message: `Cannot ${req.method} ${req.url}`,
    });
};
/**
 * Async handler wrapper
 * Wraps async route handlers to catch errors
 */
export const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
