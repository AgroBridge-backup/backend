// apps/api/src/shared/utils/logger.ts
import winston from 'winston';
// @ts-ignore
import DatadogTransport from 'winston-datadog';

/**
 * @file Centralized logger instance for the entire application.
 * @description This module provides a singleton Winston logger instance.
 * - In 'development', it logs to the console with colors and a simple format.
 * - In 'production', it logs in a structured JSON format, ready for ingestion by services like CloudWatch, Datadog, or Splunk.
 *
 * @levels
 * - error: For fatal errors, exceptions, and unexpected issues that require immediate attention.
 * - warn: For non-critical issues, deprecated usage, or potential problems.
 * - info: For high-level, lifecycle events (e.g., server start, DB connection).
 * - debug: For detailed, granular information useful during development and troubleshooting.
 */

const isProduction = process.env.NODE_ENV === 'production';
const level = isProduction ? 'info' : 'debug';

// Define different formats for development and production
const formats = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }), // Log the full stack trace
  winston.format.splat(),
  isProduction
    ? winston.format.json() // Structured JSON for production
    : winston.format.combine(
        // Human-readable for development
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, stack, traceId, userId, ...meta }) => {
          let msg = message;
          if (typeof message === 'object' && message !== null) {
             msg = JSON.stringify(message, null, 2);
          }
          
          let logMessage = `${timestamp} ${level}: ${msg}`;
          
          // Append Context IDs if present
          if (traceId) logMessage += ` [TraceID: ${traceId}]`;
          if (userId) logMessage += ` [UserID: ${userId}]`;

          if (stack) {
            logMessage += `\n${stack}`;
          }
          
          // Print metadata if it exists and isn't empty
          // We filter out splat-like numeric keys if they appear unexpectedly, 
          // though usually splat() puts them in a Symbol. 
          // ...meta captures remaining properties.
          if (Object.keys(meta).length > 0) {
             logMessage += `\n${JSON.stringify(meta, null, 2)}`;
          }
          
          return logMessage;
        })
      )
);

const transports: winston.transport[] = [
    new winston.transports.Console()
];

// Add Datadog transport if API key is present
if (process.env.DATADOG_API_KEY) {
    transports.push(
        new DatadogTransport({
            apiKey: process.env.DATADOG_API_KEY,
            ddsource: 'nodejs',
            tags: [`env:${process.env.NODE_ENV || 'development'}`, 'service:agrobridge'],
        })
    );
}

const logger = winston.createLogger({
  level,
  format: formats,
  transports,
});

// Stream interface for Morgan to pipe HTTP request logs through Winston
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

export default logger;