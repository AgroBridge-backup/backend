import { v4 as uuidv4 } from 'uuid';
export const contextMiddleware = (req, res, next) => {
    const traceId = uuidv4();
    req.context = {
        correlationId: traceId,
        requestId: traceId,
        traceId: traceId,
        startTime: Date.now(),
        path: req.path,
        method: req.method,
    };
    res.setHeader('X-Trace-ID', traceId);
    res.setHeader('X-Correlation-ID', traceId);
    next();
};
