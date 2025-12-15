import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
const asyncLocalStorage = new AsyncLocalStorage();
export function getRequestContext() {
    return asyncLocalStorage.getStore();
}
export function getCorrelationId() {
    const context = asyncLocalStorage.getStore();
    return context?.correlationId || 'no-context';
}
export function getRequestId() {
    const context = asyncLocalStorage.getStore();
    return context?.requestId || 'no-context';
}
export function getUserId() {
    const context = asyncLocalStorage.getStore();
    return context?.userId;
}
export function setUserId(userId) {
    const context = asyncLocalStorage.getStore();
    if (context) {
        context.userId = userId;
    }
}
export function setUserRole(role) {
    const context = asyncLocalStorage.getStore();
    if (context) {
        context.userRole = role;
    }
}
export function runWithContext(context, fn) {
    const fullContext = {
        correlationId: context.correlationId || randomUUID(),
        requestId: context.requestId || randomUUID(),
        startTime: context.startTime || Date.now(),
        ...context,
    };
    return asyncLocalStorage.run(fullContext, fn);
}
export async function runWithContextAsync(context, fn) {
    const fullContext = {
        correlationId: context.correlationId || randomUUID(),
        requestId: context.requestId || randomUUID(),
        startTime: context.startTime || Date.now(),
        ...context,
    };
    return asyncLocalStorage.run(fullContext, fn);
}
export function requestContextMiddleware(req, res, next) {
    const existingCorrelationId = req.headers['x-correlation-id'] ||
        req.headers['x-request-id'];
    const correlationId = existingCorrelationId || randomUUID();
    const requestId = randomUUID();
    const context = {
        correlationId,
        requestId,
        startTime: Date.now(),
        path: req.path,
        method: req.method,
        ip: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent']?.substring(0, 200),
    };
    req.correlationId = correlationId;
    req.requestId = requestId;
    req.context = context;
    res.setHeader('X-Correlation-ID', correlationId);
    res.setHeader('X-Request-ID', requestId);
    asyncLocalStorage.run(context, () => {
        next();
    });
}
export function getLogContext() {
    const context = asyncLocalStorage.getStore();
    if (!context) {
        return {};
    }
    return {
        correlationId: context.correlationId,
        requestId: context.requestId,
        userId: context.userId,
        path: context.path,
        method: context.method,
    };
}
export function getRequestDuration() {
    const context = asyncLocalStorage.getStore();
    if (!context) {
        return 0;
    }
    return Date.now() - context.startTime;
}
export function withContext(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args) {
        const context = getRequestContext();
        if (context) {
            return originalMethod.apply(this, args);
        }
        return runWithContext({}, () => originalMethod.apply(this, args));
    };
    return descriptor;
}
export default {
    getRequestContext,
    getCorrelationId,
    getRequestId,
    getUserId,
    setUserId,
    setUserRole,
    runWithContext,
    runWithContextAsync,
    requestContextMiddleware,
    getLogContext,
    getRequestDuration,
    withContext,
};
