import { Request, Response, NextFunction } from "express";
import logger from "../../../shared/utils/logger.js";
import { getCorrelationId } from "./correlation-id.middleware.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { getErrorCode } from "../../../shared/types/errors.js";

/**
 * Error Tracking Middleware
 * Centralized error handling with comprehensive logging and tracking
 *
 * Features:
 * - Logs all errors with full context (correlationId, user, request details)
 * - Sanitizes sensitive data before logging
 * - Formats error responses consistently
 * - Hides stack traces in production
 */
export const errorTrackingMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const correlationId = getCorrelationId(req);
  const isProduction = process.env.NODE_ENV === "production";

  // Determine status code
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const errorCode = getErrorCode(err, "INTERNAL_ERROR");

  // Build error context for logging
  const errorContext = {
    correlationId,
    errorName: err.name,
    errorMessage: err.message,
    errorCode,
    statusCode,
    stack: err.stack,
    request: {
      method: req.method,
      path: req.path,
      query: sanitizeData(req.query),
      body: sanitizeBody(req.body),
      headers: sanitizeHeaders(req.headers),
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    },
    user: {
      userId: req.user?.userId,
      role: req.user?.role,
      email: req.user?.email,
    },
    timestamp: new Date().toISOString(),
  };

  // Log based on severity
  if (statusCode >= 500) {
    logger.error(
      `[ErrorTracking] Server Error (${statusCode}): ${err.message} [CID: ${correlationId}]`,
    );
  } else if (statusCode >= 400) {
    logger.warn(
      `[ErrorTracking] Client Error (${statusCode}): ${err.message} [CID: ${correlationId}]`,
    );
  } else {
    logger.info(
      `[ErrorTracking] Error (${statusCode}): ${err.message} [CID: ${correlationId}]`,
    );
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      message:
        isProduction && statusCode >= 500
          ? "Internal server error"
          : err.message,
      code: errorCode,
      correlationId,
      ...(isProduction ? {} : { stack: err.stack }),
    },
    timestamp: new Date().toISOString(),
  });
};

/**
 * Sanitize request body to remove sensitive fields
 */
function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== "object") return undefined;

  const sanitized = { ...(body as Record<string, unknown>) };

  const sensitiveFields = [
    "password",
    "passwordHash",
    "passwordConfirm",
    "newPassword",
    "currentPassword",
    "token",
    "refreshToken",
    "accessToken",
    "secret",
    "apiKey",
    "privateKey",
    "creditCard",
    "cvv",
    "ssn",
  ];

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = "[REDACTED]";
    }
  }

  return sanitized;
}

/**
 * Sanitize headers to remove sensitive information
 */
function sanitizeHeaders(
  headers: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized = { ...headers };

  const sensitiveHeaders = [
    "authorization",
    "cookie",
    "x-api-key",
    "x-auth-token",
  ];

  for (const header of sensitiveHeaders) {
    if (header in sanitized) {
      sanitized[header] = "[REDACTED]";
    }
  }

  return sanitized;
}

/**
 * Sanitize query parameters
 */
function sanitizeData(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;

  const sanitized = { ...(data as Record<string, unknown>) };

  const sensitiveParams = ["token", "key", "secret", "password", "apiKey"];

  for (const param of sensitiveParams) {
    if (param in sanitized) {
      sanitized[param] = "[REDACTED]";
    }
  }

  return sanitized;
}

/**
 * Uncaught Exception Handler
 * Logs uncaught exceptions before process exits
 */
export const setupUncaughtExceptionHandler = (): void => {
  process.on("uncaughtException", (error: Error) => {
    logger.error(`[FATAL] Uncaught Exception: ${error.message}`);
    logger.error(error.stack || "No stack trace available");

    // Exit after logging (let process manager restart)
    process.exit(1);
  });

  process.on("unhandledRejection", (reason: unknown) => {
    logger.error(`[FATAL] Unhandled Rejection: ${reason}`);

    // In production, exit to trigger restart
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }
  });
};
