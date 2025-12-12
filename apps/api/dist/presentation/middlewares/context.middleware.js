import { v4 as uuidv4 } from 'uuid';
/**
 * Middleware to initialize the request context.
 * - Generates a unique traceId for the request.
 * - Captures the start time for performance monitoring.
 */
export const contextMiddleware = (req, res, next) => {
    req.context = {
        traceId: uuidv4(),
        startTime: Date.now(),
    };
    // Ensure traceId is also sent back in response headers for debugging
    res.setHeader('X-Trace-ID', req.context.traceId);
    next();
};
