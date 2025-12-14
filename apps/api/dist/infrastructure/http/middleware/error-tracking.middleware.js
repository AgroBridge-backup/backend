import logger from '../../../shared/utils/logger.js';
import { getCorrelationId } from './correlation-id.middleware.js';
import { AppError } from '../../../shared/errors/AppError.js';
export const errorTrackingMiddleware = (err, req, res, _next) => {
    const correlationId = getCorrelationId(req);
    const isProduction = process.env.NODE_ENV === 'production';
    const statusCode = err instanceof AppError ? err.statusCode : 500;
    const errorCode = err.code || 'INTERNAL_ERROR';
    const errorContext = {
        correlationId,
        errorName: err.name,
        errorMessage: err.message,
        errorCode,
        statusCode,
        stack: err.stack,
        request: {
            method: req.method,
            path: req.path,
            query: sanitizeData(req.query),
            body: sanitizeBody(req.body),
            headers: sanitizeHeaders(req.headers),
            ip: req.ip,
            userAgent: req.headers['user-agent'],
        },
        user: {
            userId: req.user?.userId,
            role: req.user?.role,
            email: req.user?.email,
        },
        timestamp: new Date().toISOString(),
    };
    if (statusCode >= 500) {
        logger.error(`[ErrorTracking] Server Error (${statusCode}): ${err.message} [CID: ${correlationId}]`);
    }
    else if (statusCode >= 400) {
        logger.warn(`[ErrorTracking] Client Error (${statusCode}): ${err.message} [CID: ${correlationId}]`);
    }
    else {
        logger.info(`[ErrorTracking] Error (${statusCode}): ${err.message} [CID: ${correlationId}]`);
    }
    res.status(statusCode).json({
        success: false,
        error: {
            message: isProduction && statusCode >= 500 ? 'Internal server error' : err.message,
            code: errorCode,
            correlationId,
            ...(isProduction ? {} : { stack: err.stack }),
        },
        timestamp: new Date().toISOString(),
    });
};
function sanitizeBody(body) {
    if (!body || typeof body !== 'object')
        return undefined;
    const sanitized = { ...body };
    const sensitiveFields = [
        'password',
        'passwordHash',
        'passwordConfirm',
        'newPassword',
        'currentPassword',
        'token',
        'refreshToken',
        'accessToken',
        'secret',
        'apiKey',
        'privateKey',
        'creditCard',
        'cvv',
        'ssn',
    ];
    for (const field of sensitiveFields) {
        if (field in sanitized) {
            sanitized[field] = '[REDACTED]';
        }
    }
    return sanitized;
}
function sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    const sensitiveHeaders = [
        'authorization',
        'cookie',
        'x-api-key',
        'x-auth-token',
    ];
    for (const header of sensitiveHeaders) {
        if (header in sanitized) {
            sanitized[header] = '[REDACTED]';
        }
    }
    return sanitized;
}
function sanitizeData(data) {
    if (!data || typeof data !== 'object')
        return data;
    const sanitized = { ...data };
    const sensitiveParams = ['token', 'key', 'secret', 'password', 'apiKey'];
    for (const param of sensitiveParams) {
        if (param in sanitized) {
            sanitized[param] = '[REDACTED]';
        }
    }
    return sanitized;
}
export const setupUncaughtExceptionHandler = () => {
    process.on('uncaughtException', (error) => {
        logger.error(`[FATAL] Uncaught Exception: ${error.message}`);
        logger.error(error.stack || 'No stack trace available');
        process.exit(1);
    });
    process.on('unhandledRejection', (reason) => {
        logger.error(`[FATAL] Unhandled Rejection: ${reason}`);
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        }
    });
};
