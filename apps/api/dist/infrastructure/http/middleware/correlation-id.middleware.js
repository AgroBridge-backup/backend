import { randomUUID } from 'crypto';
export const correlationIdMiddleware = (req, res, next) => {
    const existingCorrelationId = req.headers['x-correlation-id'] ||
        req.headers['x-request-id'];
    const correlationId = existingCorrelationId || randomUUID();
    req.correlationId = correlationId;
    req.requestId = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);
    res.setHeader('X-Request-ID', correlationId);
    next();
};
export const getCorrelationId = (req) => {
    return req.correlationId || req.requestId || 'unknown';
};
