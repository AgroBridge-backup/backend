import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

const isProduction = process.env.NODE_ENV === 'production';
const isStaging = process.env.NODE_ENV === 'staging';

export function initSentry(): void {
  if (!isProduction && !isStaging) {
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
    release: process.env.API_VERSION || '2.0.0',

    // Performance Monitoring
    tracesSampleRate: isProduction ? 0.1 : 1.0,

    // Profiling
    profilesSampleRate: isProduction ? 0.1 : 1.0,
    integrations: [
      nodeProfilingIntegration(),
    ],

    // Filter out known/expected errors
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

      return event;
    },

    // Ignore common noise
    ignoreErrors: [
      'Non-Error exception captured',
      'Request aborted',
      'ECONNRESET',
      'ENOTFOUND',
      'ETIMEDOUT',
      'socket hang up',
    ],

    // Add context
    initialScope: {
      tags: {
        service: 'agrobridge-api',
        version: process.env.API_VERSION || '2.0.0',
      },
    },
  });

  console.log('[Sentry] Initialized successfully');
}

// Helper to capture exceptions with context
export function captureException(error: Error, context?: Record<string, any>): void {
  if (!isProduction && !isStaging) {
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

// Helper to capture messages
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
  if (!isProduction && !isStaging) {
    console.log(`[Sentry] Would capture message (${level}):`, message);
    return;
  }

  Sentry.captureMessage(message, level);
}

// Helper to set user context
export function setUser(user: { id: string; email?: string; role?: string }): void {
  Sentry.setUser(user);
}

// Helper to clear user context
export function clearUser(): void {
  Sentry.setUser(null);
}

// Helper for transaction/span tracking
export function startTransaction(name: string, op: string): Sentry.Span | undefined {
  return Sentry.startInactiveSpan({ name, op });
}

export { Sentry };
