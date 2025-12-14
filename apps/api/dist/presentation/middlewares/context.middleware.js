import { v4 as uuidv4 } from 'uuid';
export const contextMiddleware = (req, res, next) => {
    req.context = {
        traceId: uuidv4(),
        startTime: Date.now(),
    };
    res.setHeader('X-Trace-ID', req.context.traceId);
    next();
};
