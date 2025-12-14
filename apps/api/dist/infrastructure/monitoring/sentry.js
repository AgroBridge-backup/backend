import * as Sentry from '@sentry/node';
const isProduction = process.env.NODE_ENV === 'production';
const isStaging = process.env.NODE_ENV === 'staging';
export function initSentry() {
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
        tracesSampleRate: isProduction ? 0.1 : 1.0,
        beforeSend(event, hint) {
            const error = hint?.originalException;
            if (error instanceof Error && error.name === 'ValidationError') {
                return null;
            }
            if (event.extra?.statusCode && [400, 401, 403, 404].includes(event.extra.statusCode)) {
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
        ],
    });
    Sentry.setTag('service', 'agrobridge-api');
    Sentry.setTag('version', process.env.API_VERSION || '2.0.0');
    console.log('[Sentry] Initialized successfully');
}
export function captureException(error, context) {
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
export function captureMessage(message) {
    if (!isProduction && !isStaging) {
        console.log(`[Sentry] Would capture message:`, message);
        return;
    }
    Sentry.captureMessage(message);
}
export function setUser(user) {
    Sentry.setUser(user);
}
export function clearUser() {
    Sentry.setUser(null);
}
export { Sentry };
