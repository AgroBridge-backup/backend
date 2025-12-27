/**
 * @file Contextual Logger
 * @description Logger wrapper that automatically includes request context
 *
 * Extends the base Winston logger to automatically include:
 * - Correlation ID
 * - Request ID
 * - User ID (when authenticated)
 * - Request path and method
 *
 * @author AgroBridge Engineering Team
 */

import winston from "winston";
import baseLogger from "../../shared/utils/logger.js";
import {
  getLogContext,
  getRequestContext,
} from "../context/request-context.js";

/**
 * Log entry with context
 */
interface ContextualLogEntry {
  message: string;
  level?: string;
  [key: string]: unknown;
}

/**
 * Contextual logger interface
 */
interface ContextualLogger {
  error(message: string | object, meta?: object): void;
  warn(message: string | object, meta?: object): void;
  info(message: string | object, meta?: object): void;
  debug(message: string | object, meta?: object): void;
  log(level: string, message: string | object, meta?: object): void;
  child(defaultMeta: object): ContextualLogger;
  getBaseLogger(): winston.Logger;
  isLevelEnabled(level: string): boolean;
  timed(level: string, message: string, startTime: number, meta?: object): void;
  startTimer(operation: string): { end: (meta?: object) => void };
  audit(action: string, resource: string, details?: object): void;
  security(event: string, details?: object): void;
  metric(name: string, value: number, unit: string, tags?: object): void;
}

/**
 * Create a child logger with context
 */
function createContextualLogger(): ContextualLogger {
  const log = (
    level: string,
    message: string | object,
    meta?: object,
  ): void => {
    const context = getLogContext();

    // Handle object messages
    let logMessage: string;
    let logMeta: object;

    if (typeof message === "object") {
      logMessage = (message as any).message || JSON.stringify(message);
      logMeta = { ...context, ...message, ...meta };
    } else {
      logMessage = message;
      logMeta = { ...context, ...meta };
    }

    (baseLogger as any)[level](logMessage, logMeta);
  };

  return {
    /**
     * Log error level message
     */
    error(message: string | object, meta?: object): void {
      log("error", message, meta);
    },

    /**
     * Log warn level message
     */
    warn(message: string | object, meta?: object): void {
      log("warn", message, meta);
    },

    /**
     * Log info level message
     */
    info(message: string | object, meta?: object): void {
      log("info", message, meta);
    },

    /**
     * Log debug level message
     */
    debug(message: string | object, meta?: object): void {
      log("debug", message, meta);
    },

    /**
     * Log with explicit level
     */
    log(level: string, message: string | object, meta?: object): void {
      log(level, message, meta);
    },

    /**
     * Create a child logger with additional default metadata
     */
    child(defaultMeta: object): ContextualLogger {
      const childLog = (
        level: string,
        message: string | object,
        meta?: object,
      ): void => {
        log(level, message, { ...defaultMeta, ...meta });
      };

      // Create child logger with same interface
      const childLogger: ContextualLogger = {
        error: (message: string | object, meta?: object) =>
          childLog("error", message, meta),
        warn: (message: string | object, meta?: object) =>
          childLog("warn", message, meta),
        info: (message: string | object, meta?: object) =>
          childLog("info", message, meta),
        debug: (message: string | object, meta?: object) =>
          childLog("debug", message, meta),
        log: childLog,
        child: (nestedMeta: object) =>
          createContextualLogger().child({ ...defaultMeta, ...nestedMeta }),
        getBaseLogger: () => baseLogger,
        isLevelEnabled: (level: string) => baseLogger.isLevelEnabled(level),
        timed: (
          level: string,
          message: string,
          startTime: number,
          meta?: object,
        ) => {
          const duration = Date.now() - startTime;
          childLog(level, message, { ...meta, durationMs: duration });
        },
        startTimer: (operation: string) => {
          const start = Date.now();
          return {
            end: (meta?: object) => {
              const duration = Date.now() - start;
              childLog("debug", `${operation} completed`, {
                ...meta,
                durationMs: duration,
              });
            },
          };
        },
        audit: (action: string, resource: string, details?: object) => {
          const context = getRequestContext();
          childLog("info", `AUDIT: ${action} on ${resource}`, {
            audit: true,
            action,
            resource,
            userId: context?.userId,
            ...details,
          });
        },
        security: (event: string, details?: object) => {
          const context = getRequestContext();
          childLog("warn", `SECURITY: ${event}`, {
            security: true,
            event,
            userId: context?.userId,
            ip: context?.ip,
            ...details,
          });
        },
        metric: (name: string, value: number, unit: string, tags?: object) => {
          childLog("info", `METRIC: ${name}`, {
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

    /**
     * Get the underlying Winston logger
     */
    getBaseLogger(): winston.Logger {
      return baseLogger;
    },

    /**
     * Check if a level is enabled
     */
    isLevelEnabled(level: string): boolean {
      return baseLogger.isLevelEnabled(level);
    },

    /**
     * Log with timing information
     */
    timed(
      level: string,
      message: string,
      startTime: number,
      meta?: object,
    ): void {
      const duration = Date.now() - startTime;
      log(level, message, { ...meta, durationMs: duration });
    },

    /**
     * Create a timer for measuring operations
     */
    startTimer(operation: string): { end: (meta?: object) => void } {
      const start = Date.now();
      return {
        end: (meta?: object) => {
          const duration = Date.now() - start;
          log("debug", `${operation} completed`, {
            ...meta,
            durationMs: duration,
          });
        },
      };
    },

    /**
     * Log an audit event
     */
    audit(action: string, resource: string, details?: object): void {
      const context = getRequestContext();
      log("info", `AUDIT: ${action} on ${resource}`, {
        audit: true,
        action,
        resource,
        userId: context?.userId,
        ...details,
      });
    },

    /**
     * Log a security event
     */
    security(event: string, details?: object): void {
      const context = getRequestContext();
      log("warn", `SECURITY: ${event}`, {
        security: true,
        event,
        userId: context?.userId,
        ip: context?.ip,
        ...details,
      });
    },

    /**
     * Log a performance metric
     */
    metric(name: string, value: number, unit: string, tags?: object): void {
      log("info", `METRIC: ${name}`, {
        metric: true,
        name,
        value,
        unit,
        ...tags,
      });
    },
  };
}

/**
 * Singleton contextual logger instance
 */
export const logger = createContextualLogger();

/**
 * Create a module-specific logger
 * Adds module name to all log entries
 */
export function createModuleLogger(moduleName: string) {
  return logger.child({ module: moduleName });
}

/**
 * Create a service-specific logger
 */
export function createServiceLogger(serviceName: string) {
  return logger.child({ service: serviceName });
}

export default logger;
