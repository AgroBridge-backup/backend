import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Correlation ID Middleware
 * Adds a unique correlation ID to every request for end-to-end tracing
 *
 * The correlation ID can be:
 * 1. Passed from the client via X-Correlation-ID or X-Request-ID header
 * 2. Generated automatically if not provided
 *
 * This enables tracing requests across microservices and correlating logs
 */
export const correlationIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Check for existing correlation ID from client or upstream service
  const existingCorrelationId =
    (req.headers['x-correlation-id'] as string) ||
    (req.headers['x-request-id'] as string);

  // Generate new ID if not provided
  const correlationId = existingCorrelationId || randomUUID();

  // Attach to request for use in logging and downstream services
  req.correlationId = correlationId;

  // Also set on req.requestId for compatibility with existing code
  req.requestId = correlationId;

  // Add to response headers so client can track their request
  res.setHeader('X-Correlation-ID', correlationId);
  res.setHeader('X-Request-ID', correlationId);

  next();
};

/**
 * Helper function to extract correlation ID from request
 * Safe to use in any middleware or controller
 */
export const getCorrelationId = (req: Request): string => {
  return req.correlationId || req.requestId || 'unknown';
};
