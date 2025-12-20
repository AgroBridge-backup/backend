import { Request, Response, NextFunction } from 'express';
import logger from '../../../shared/utils/logger.js';
import { getCorrelationId } from './correlation-id.middleware.js';

// Slow request threshold in milliseconds
const SLOW_REQUEST_THRESHOLD = parseInt(process.env.SLOW_REQUEST_THRESHOLD || '1000', 10);

// Very slow request threshold (critical)
const CRITICAL_REQUEST_THRESHOLD = parseInt(process.env.CRITICAL_REQUEST_THRESHOLD || '5000', 10);

/**
 * Performance Monitoring Middleware
 * Tracks request duration and logs performance metrics
 *
 * Features:
 * - Measures request duration
 * - Adds X-Response-Time header
 * - Logs slow requests as warnings
 * - Logs critical slow requests as errors
 */
export const performanceMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Skip monitoring for health checks to reduce log noise
  if (req.path.startsWith('/health')) {
    return next();
  }

  const startTime = Date.now();
  const startHrTime = process.hrtime();

  // Store original end method
  const originalEnd = res.end;

  // Override res.end to capture when response is sent
  res.end = function (
    this: Response,
    chunk?: any,
    encodingOrCb?: BufferEncoding | (() => void),
    cb?: () => void
  ): Response {
    // Calculate duration
    const diff = process.hrtime(startHrTime);
    const durationMs = Math.round((diff[0] * 1e9 + diff[1]) / 1e6);

    // Add response time header
    res.setHeader('X-Response-Time', `${durationMs}ms`);

    // Log based on duration and status
    if (durationMs >= CRITICAL_REQUEST_THRESHOLD) {
      logger.error(`[Performance] CRITICAL: Very slow request - ${req.method} ${req.path} took ${durationMs}ms`);
    } else if (durationMs >= SLOW_REQUEST_THRESHOLD) {
      logger.warn(`[Performance] Slow request - ${req.method} ${req.path} took ${durationMs}ms`);
    } else if (res.statusCode >= 500) {
      logger.error(`[Performance] Server error - ${req.method} ${req.path} returned ${res.statusCode} in ${durationMs}ms`);
    } else if (res.statusCode >= 400) {
      logger.warn(`[Performance] Client error - ${req.method} ${req.path} returned ${res.statusCode} in ${durationMs}ms`);
    } else {
      logger.debug(`[Performance] ${req.method} ${req.path} completed in ${durationMs}ms`);
    }

    // Call original end method - use type assertion for Express compatibility
    return (originalEnd as Function).apply(this, [chunk, encodingOrCb, cb]);
  };

  next();
};

/**
 * Request Size Middleware
 * Tracks and limits request body size
 */
export const requestSizeMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);

  // Log large requests
  if (contentLength > 1024 * 1024) {
    // > 1MB
    logger.warn(`[Performance] Large request body: ${contentLength} bytes for ${req.method} ${req.path}`);
  }

  next();
};
