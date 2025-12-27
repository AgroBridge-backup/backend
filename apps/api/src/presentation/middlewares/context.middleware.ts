import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

/**
 * Middleware to initialize the request context.
 * - Generates a unique traceId/correlationId for the request.
 * - Captures the start time for performance monitoring.
 *
 * Note: This is a legacy middleware. For new code, prefer using
 * requestContextMiddleware from infrastructure/context/request-context.ts
 * which provides AsyncLocalStorage-based context propagation.
 */
export const contextMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const traceId = uuidv4();

  req.context = {
    correlationId: traceId,
    requestId: traceId,
    traceId: traceId,
    startTime: Date.now(),
    path: req.path,
    method: req.method,
  };

  // Ensure traceId is also sent back in response headers for debugging
  res.setHeader("X-Trace-ID", traceId);
  res.setHeader("X-Correlation-ID", traceId);

  next();
};
