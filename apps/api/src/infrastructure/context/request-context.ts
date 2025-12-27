/**
 * @file Request Context
 * @description AsyncLocalStorage-based request context for correlation ID propagation
 *
 * Provides automatic correlation ID propagation across async boundaries
 * without needing to pass the request object through every function call.
 *
 * Usage:
 * - Middleware sets the context at request start
 * - Any code can access the context via getRequestContext()
 * - Logger automatically includes correlation ID when available
 *
 * @author AgroBridge Engineering Team
 */

import { AsyncLocalStorage } from "async_hooks";
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

/**
 * Request context data structure
 */
export interface RequestContext {
  correlationId: string;
  requestId: string;
  userId?: string;
  userRole?: string;
  startTime: number;
  path?: string;
  method?: string;
  ip?: string;
  userAgent?: string;
}

/**
 * AsyncLocalStorage instance for request context
 */
const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Get the current request context
 * Returns undefined if called outside of a request context
 */
export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Get correlation ID from current context
 * Returns 'no-context' if called outside of a request context
 */
export function getCorrelationId(): string {
  const context = asyncLocalStorage.getStore();
  return context?.correlationId || "no-context";
}

/**
 * Get request ID from current context
 */
export function getRequestId(): string {
  const context = asyncLocalStorage.getStore();
  return context?.requestId || "no-context";
}

/**
 * Get user ID from current context
 */
export function getUserId(): string | undefined {
  const context = asyncLocalStorage.getStore();
  return context?.userId;
}

/**
 * Set user ID in current context
 * Called after authentication middleware identifies the user
 */
export function setUserId(userId: string): void {
  const context = asyncLocalStorage.getStore();
  if (context) {
    context.userId = userId;
  }
}

/**
 * Set user role in current context
 */
export function setUserRole(role: string): void {
  const context = asyncLocalStorage.getStore();
  if (context) {
    context.userRole = role;
  }
}

/**
 * Run a function within a request context
 * Useful for background jobs that need correlation tracking
 */
export function runWithContext<T>(
  context: Partial<RequestContext>,
  fn: () => T,
): T {
  const fullContext: RequestContext = {
    correlationId: context.correlationId || randomUUID(),
    requestId: context.requestId || randomUUID(),
    startTime: context.startTime || Date.now(),
    ...context,
  };

  return asyncLocalStorage.run(fullContext, fn);
}

/**
 * Run an async function within a request context
 */
export async function runWithContextAsync<T>(
  context: Partial<RequestContext>,
  fn: () => Promise<T>,
): Promise<T> {
  const fullContext: RequestContext = {
    correlationId: context.correlationId || randomUUID(),
    requestId: context.requestId || randomUUID(),
    startTime: context.startTime || Date.now(),
    ...context,
  };

  return asyncLocalStorage.run(fullContext, fn);
}

/**
 * Express middleware that establishes request context
 * Should be one of the first middlewares in the chain
 */
export function requestContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Check for existing correlation ID from client or upstream service
  const existingCorrelationId =
    (req.headers["x-correlation-id"] as string) ||
    (req.headers["x-request-id"] as string);

  // Generate new ID if not provided
  const correlationId = existingCorrelationId || randomUUID();
  const requestId = randomUUID(); // Always generate unique request ID

  // Create request context
  const context: RequestContext = {
    correlationId,
    requestId,
    startTime: Date.now(),
    path: req.path,
    method: req.method,
    ip: req.ip || req.socket?.remoteAddress,
    userAgent: req.headers["user-agent"]?.substring(0, 200),
  };

  // Attach to request object for backwards compatibility
  req.correlationId = correlationId;
  req.requestId = requestId;
  req.context = context;

  // Add to response headers so client can track their request
  res.setHeader("X-Correlation-ID", correlationId);
  res.setHeader("X-Request-ID", requestId);

  // Run the rest of the request within the context
  asyncLocalStorage.run(context, () => {
    next();
  });
}

/**
 * Get context metadata for logging
 * Returns an object suitable for spreading into log entries
 */
export function getLogContext(): Record<string, string | undefined> {
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

/**
 * Calculate request duration from context
 */
export function getRequestDuration(): number {
  const context = asyncLocalStorage.getStore();
  if (!context) {
    return 0;
  }
  return Date.now() - context.startTime;
}

/**
 * Decorator for class methods to automatically run with context
 * Usage: @withContext
 */
export function withContext(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor,
): PropertyDescriptor {
  const originalMethod = descriptor.value;

  descriptor.value = function (...args: any[]) {
    const context = getRequestContext();
    if (context) {
      return originalMethod.apply(this, args);
    }

    // If no context exists, run with a new one
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
