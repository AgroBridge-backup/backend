/**
 * Sentry APM Integration
 *
 * Production-grade error tracking and performance monitoring.
 * Features:
 * - Error capturing with context
 * - Performance profiling
 * - Transaction tracing
 * - Custom instrumentation hooks
 *
 * @module SentryIntegration
 */

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import type { Express, Request, Response, NextFunction } from 'express';

const isProduction = process.env.NODE_ENV === 'production';
const isStaging = process.env.NODE_ENV === 'staging';
const isEnabled = isProduction || isStaging;

// ═══════════════════════════════════════════════════════════════════════════════
// SENTRY INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

export function initSentry(): void {
  if (!isEnabled) {
    console.log('[Sentry] Skipped initialization in development mode');
    return;
  }

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.warn('[Sentry] DSN not configured - error tracking disabled');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    release: `agrobridge-api@${process.env.API_VERSION || '2.0.0'}`,

    // Performance Monitoring
    tracesSampleRate: isProduction ? 0.2 : 1.0, // 20% of transactions in production
    profilesSampleRate: isProduction ? 0.1 : 1.0, // 10% of sampled transactions

    // Profiling integration
    integrations: [
      nodeProfilingIntegration(),
    ],

    // Filter out noise
    beforeSend(event, hint) {
      const error = hint?.originalException;

      // Don't send validation errors
      if (error instanceof Error && error.name === 'ValidationError') {
        return null;
      }

      // Don't send expected HTTP errors
      if (event.extra?.statusCode && [400, 401, 403, 404].includes(event.extra.statusCode as number)) {
        return null;
      }

      // Redact sensitive data
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['x-api-key'];
      }

      return event;
    },

    // Before send transaction - for performance data
    beforeSendTransaction(event) {
      // Filter out health checks and static files
      const transaction = event.transaction || '';
      if (
        transaction.includes('/health') ||
        transaction.includes('/favicon') ||
        transaction.includes('/static') ||
        transaction.includes('/assets')
      ) {
        return null;
      }
      return event;
    },

    ignoreErrors: [
      'Non-Error exception captured',
      'Request aborted',
      'ECONNRESET',
      'ENOTFOUND',
      'ETIMEDOUT',
      'socket hang up',
      'client disconnected',
      'write EPIPE',
    ],
  });

  // Set default tags
  Sentry.setTag('service', 'agrobridge-api');
  Sentry.setTag('version', process.env.API_VERSION || '2.0.0');
  Sentry.setTag('node_version', process.version);

  console.log('[Sentry] Initialized with profiling support');
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPRESS MIDDLEWARE (Sentry v10+ API)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Request handler middleware for Express
 * Captures request data and sets up isolation scope
 * Must be first middleware in chain
 */
export function sentryRequestHandler() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!isEnabled) {
      return next();
    }

    // Set request context for error tracking
    Sentry.setContext('request', {
      method: req.method,
      url: req.url,
      query: req.query,
      headers: {
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
        host: req.headers.host,
      },
    });

    // Capture IP address
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    Sentry.setTag('ip_address', ip);

    next();
  };
}

/**
 * Tracing handler middleware for Express
 * Creates transactions for performance monitoring
 * Must be after request handler, before routes
 */
export function sentryTracingHandler() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!isEnabled) {
      return next();
    }

    // Start a span for the request
    const transactionName = `${req.method} ${req.route?.path || req.path}`;

    Sentry.startSpan(
      {
        name: transactionName,
        op: 'http.server',
        attributes: {
          'http.method': req.method,
          'http.url': req.url,
        }
      },
      () => {
        // Continue with next middleware
        next();
      }
    );
  };
}

/**
 * Error handler middleware for Express
 * Must be after routes, before other error handlers
 */
export function sentryErrorHandler() {
  return (err: Error, req: Request, res: Response, next: NextFunction) => {
    if (!isEnabled) {
      return next(err);
    }

    // Get status code from error
    const statusCode = (err as any).statusCode || (err as any).status || 500;

    // Only report 5xx errors to Sentry
    if (statusCode >= 500) {
      Sentry.withScope((scope) => {
        // Add request context
        scope.setExtra('statusCode', statusCode);
        scope.setExtra('url', req.url);
        scope.setExtra('method', req.method);
        scope.setExtra('query', req.query);
        scope.setExtra('body', req.body);

        // Add user context if available
        if ((req as any).user) {
          scope.setUser({
            id: (req as any).user.id,
            email: (req as any).user.email,
            role: (req as any).user.role,
          });
        }

        // Capture the exception
        Sentry.captureException(err);
      });
    }

    // Pass error to next handler
    next(err);
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Capture exception with context
 */
export function captureException(error: Error, context?: Record<string, unknown>): void {
  if (!isEnabled) {
    console.error('[Sentry] Would capture exception:', error.message);
    return;
  }

  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureException(error);
  });
}

/**
 * Capture message with severity level
 */
export function captureMessage(message: string, level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info'): void {
  if (!isEnabled) {
    console.log(`[Sentry] Would capture message (${level}):`, message);
    return;
  }

  Sentry.captureMessage(message, level);
}

/**
 * Set user context for error tracking
 */
export function setUser(user: { id: string; email?: string; role?: string }): void {
  Sentry.setUser(user);
}

/**
 * Clear user context
 */
export function clearUser(): void {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info'
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Start a custom transaction for performance monitoring
 */
export function startTransaction(name: string, op: string) {
  return Sentry.startSpan({ name, op }, (span) => span);
}

/**
 * Set custom tag for filtering
 */
export function setTag(key: string, value: string): void {
  Sentry.setTag(key, value);
}

/**
 * Set context for grouping related data
 */
export function setContext(name: string, context: Record<string, unknown>): void {
  Sentry.setContext(name, context);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM INSTRUMENTATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Instrument async operation with span
 */
export async function instrumentAsync<T>(
  name: string,
  op: string,
  fn: () => Promise<T>
): Promise<T> {
  return Sentry.startSpan({ name, op }, async () => {
    return fn();
  });
}

/**
 * Instrument database query
 */
export async function instrumentDbQuery<T>(
  query: string,
  fn: () => Promise<T>
): Promise<T> {
  return instrumentAsync(query.slice(0, 100), 'db.query', fn);
}

/**
 * Instrument external HTTP request
 */
export async function instrumentHttpRequest<T>(
  url: string,
  method: string,
  fn: () => Promise<T>
): Promise<T> {
  return instrumentAsync(`${method} ${url}`, 'http.client', fn);
}

/**
 * Instrument blockchain operation
 */
export async function instrumentBlockchain<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  return instrumentAsync(operation, 'blockchain', fn);
}

/**
 * Instrument IPFS operation
 */
export async function instrumentIpfs<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  return instrumentAsync(operation, 'ipfs', fn);
}

/**
 * Instrument PDF generation
 */
export async function instrumentPdf<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  return instrumentAsync(operation, 'pdf.generate', fn);
}

// Export Sentry for direct access if needed
export { Sentry };
