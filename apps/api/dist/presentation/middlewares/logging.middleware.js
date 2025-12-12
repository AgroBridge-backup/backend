/**
 * Logging Middleware with Correlation IDs and Performance Monitoring
 * - Logs all incoming requests with trace IDs
 * - Monitors request duration
 * - Detects slow requests
 * - Structured logging for production
 */
import logger from '../../shared/utils/logger.js';
/**
 * Request logging middleware
 * Logs incoming requests with correlation IDs
 */
export const requestLogger = (req, res, next) => {
    const traceId = req.context?.traceId || 'unknown';
    const startTime = req.context?.startTime || Date.now();
    // Log incoming request
    logger.info('Incoming request', {
        traceId,
        method: req.method,
        url: req.url,
        path: req.path,
        query: req.query,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        contentType: req.get('content-type'),
        userId: req.user?.userId,
    });
    // Log response when finished
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const level = res.statusCode >= 400 ? 'warn' : 'info';
        logger[level]('Request completed', {
            traceId,
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            contentLength: res.get('content-length'),
            userId: req.user?.userId,
        });
    });
    next();
};
/**
 * Performance monitoring middleware
 * Warns on slow requests
 */
export const performanceMonitor = (req, res, next) => {
    const startTime = req.context?.startTime || Date.now();
    const traceId = req.context?.traceId || 'unknown';
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        // Warn on slow requests (>1000ms)
        if (duration > 1000) {
            logger.warn('Slow request detected', {
                traceId,
                method: req.method,
                url: req.url,
                duration: `${duration}ms`,
                statusCode: res.statusCode,
                threshold: '1000ms',
            });
        }
        // Error on very slow requests (>5000ms)
        if (duration > 5000) {
            logger.error('Very slow request detected', {
                traceId,
                method: req.method,
                url: req.url,
                duration: `${duration}ms`,
                statusCode: res.statusCode,
                threshold: '5000ms',
            });
        }
        // Performance metrics for monitoring
        if (process.env.NODE_ENV === 'production') {
            // This can be sent to monitoring services like DataDog, New Relic, etc.
            logger.debug('Request performance', {
                traceId,
                method: req.method,
                url: req.url,
                duration,
                statusCode: res.statusCode,
                memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
            });
        }
    });
    next();
};
/**
 * Error logging middleware
 * Logs errors with full context
 */
export const errorLogger = (error, req, res, next) => {
    const traceId = req.context?.traceId || 'unknown';
    logger.error('Error occurred', {
        traceId,
        error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
        },
        request: {
            method: req.method,
            url: req.url,
            path: req.path,
            query: req.query,
            body: req.body,
            ip: req.ip,
            userAgent: req.get('user-agent'),
            userId: req.user?.userId,
        },
    });
    // Pass to error handler
    next(error);
};
/**
 * Access log middleware (combined format)
 * Logs in a format suitable for access logs
 */
export const accessLogger = (req, res, next) => {
    const startTime = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const traceId = req.context?.traceId || '-';
        // Combined log format with trace ID
        const logLine = [
            req.ip || '-',
            '-', // remote user (not applicable)
            `[${new Date().toISOString()}]`,
            `"${req.method} ${req.url} HTTP/${req.httpVersion}"`,
            res.statusCode,
            res.get('content-length') || '-',
            `"${req.get('referer') || '-'}"`,
            `"${req.get('user-agent') || '-'}"`,
            `${duration}ms`,
            traceId,
        ].join(' ');
        logger.http(logLine);
    });
    next();
};
