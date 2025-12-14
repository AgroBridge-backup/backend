import logger from '../../../shared/utils/logger.js';
const SLOW_REQUEST_THRESHOLD = parseInt(process.env.SLOW_REQUEST_THRESHOLD || '1000', 10);
const CRITICAL_REQUEST_THRESHOLD = parseInt(process.env.CRITICAL_REQUEST_THRESHOLD || '5000', 10);
export const performanceMiddleware = (req, res, next) => {
    if (req.path.startsWith('/health')) {
        return next();
    }
    const startTime = Date.now();
    const startHrTime = process.hrtime();
    const originalEnd = res.end;
    res.end = function (chunk, encodingOrCb, cb) {
        const diff = process.hrtime(startHrTime);
        const durationMs = Math.round((diff[0] * 1e9 + diff[1]) / 1e6);
        res.setHeader('X-Response-Time', `${durationMs}ms`);
        if (durationMs >= CRITICAL_REQUEST_THRESHOLD) {
            logger.error(`[Performance] CRITICAL: Very slow request - ${req.method} ${req.path} took ${durationMs}ms`);
        }
        else if (durationMs >= SLOW_REQUEST_THRESHOLD) {
            logger.warn(`[Performance] Slow request - ${req.method} ${req.path} took ${durationMs}ms`);
        }
        else if (res.statusCode >= 500) {
            logger.error(`[Performance] Server error - ${req.method} ${req.path} returned ${res.statusCode} in ${durationMs}ms`);
        }
        else if (res.statusCode >= 400) {
            logger.warn(`[Performance] Client error - ${req.method} ${req.path} returned ${res.statusCode} in ${durationMs}ms`);
        }
        else {
            logger.debug(`[Performance] ${req.method} ${req.path} completed in ${durationMs}ms`);
        }
        return originalEnd.apply(this, [chunk, encodingOrCb, cb]);
    };
    next();
};
export const requestSizeMiddleware = (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > 1024 * 1024) {
        logger.warn(`[Performance] Large request body: ${contentLength} bytes for ${req.method} ${req.path}`);
    }
    next();
};
