import baseLogger from '../../shared/utils/logger.js';
import { getLogContext, getRequestContext } from '../context/request-context.js';
function createContextualLogger() {
    const log = (level, message, meta) => {
        const context = getLogContext();
        let logMessage;
        let logMeta;
        if (typeof message === 'object') {
            logMessage = message.message || JSON.stringify(message);
            logMeta = { ...context, ...message, ...meta };
        }
        else {
            logMessage = message;
            logMeta = { ...context, ...meta };
        }
        baseLogger[level](logMessage, logMeta);
    };
    return {
        error(message, meta) {
            log('error', message, meta);
        },
        warn(message, meta) {
            log('warn', message, meta);
        },
        info(message, meta) {
            log('info', message, meta);
        },
        debug(message, meta) {
            log('debug', message, meta);
        },
        log(level, message, meta) {
            log(level, message, meta);
        },
        child(defaultMeta) {
            const childLog = (level, message, meta) => {
                log(level, message, { ...defaultMeta, ...meta });
            };
            const childLogger = {
                error: (message, meta) => childLog('error', message, meta),
                warn: (message, meta) => childLog('warn', message, meta),
                info: (message, meta) => childLog('info', message, meta),
                debug: (message, meta) => childLog('debug', message, meta),
                log: childLog,
                child: (nestedMeta) => createContextualLogger().child({ ...defaultMeta, ...nestedMeta }),
                getBaseLogger: () => baseLogger,
                isLevelEnabled: (level) => baseLogger.isLevelEnabled(level),
                timed: (level, message, startTime, meta) => {
                    const duration = Date.now() - startTime;
                    childLog(level, message, { ...meta, durationMs: duration });
                },
                startTimer: (operation) => {
                    const start = Date.now();
                    return {
                        end: (meta) => {
                            const duration = Date.now() - start;
                            childLog('debug', `${operation} completed`, { ...meta, durationMs: duration });
                        },
                    };
                },
                audit: (action, resource, details) => {
                    const context = getRequestContext();
                    childLog('info', `AUDIT: ${action} on ${resource}`, {
                        audit: true,
                        action,
                        resource,
                        userId: context?.userId,
                        ...details,
                    });
                },
                security: (event, details) => {
                    const context = getRequestContext();
                    childLog('warn', `SECURITY: ${event}`, {
                        security: true,
                        event,
                        userId: context?.userId,
                        ip: context?.ip,
                        ...details,
                    });
                },
                metric: (name, value, unit, tags) => {
                    childLog('info', `METRIC: ${name}`, {
                        metric: true,
                        name,
                        value,
                        unit,
                        ...tags,
                    });
                },
            };
            return childLogger;
        },
        getBaseLogger() {
            return baseLogger;
        },
        isLevelEnabled(level) {
            return baseLogger.isLevelEnabled(level);
        },
        timed(level, message, startTime, meta) {
            const duration = Date.now() - startTime;
            log(level, message, { ...meta, durationMs: duration });
        },
        startTimer(operation) {
            const start = Date.now();
            return {
                end: (meta) => {
                    const duration = Date.now() - start;
                    log('debug', `${operation} completed`, { ...meta, durationMs: duration });
                },
            };
        },
        audit(action, resource, details) {
            const context = getRequestContext();
            log('info', `AUDIT: ${action} on ${resource}`, {
                audit: true,
                action,
                resource,
                userId: context?.userId,
                ...details,
            });
        },
        security(event, details) {
            const context = getRequestContext();
            log('warn', `SECURITY: ${event}`, {
                security: true,
                event,
                userId: context?.userId,
                ip: context?.ip,
                ...details,
            });
        },
        metric(name, value, unit, tags) {
            log('info', `METRIC: ${name}`, {
                metric: true,
                name,
                value,
                unit,
                ...tags,
            });
        },
    };
}
export const logger = createContextualLogger();
export function createModuleLogger(moduleName) {
    return logger.child({ module: moduleName });
}
export function createServiceLogger(serviceName) {
    return logger.child({ service: serviceName });
}
export default logger;
