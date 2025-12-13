/**
 * Middleware Exports
 * Enterprise-grade security and observability for AgroBridge Backend
 */

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

// Security Headers (Helmet.js + CSP)
export {
  securityHeadersMiddleware,
  additionalSecurityHeaders,
  securityMiddleware,
} from './security.middleware.js';

// CORS with Whitelist
export {
  corsMiddleware,
  healthCheckCors,
} from './cors.middleware.js';

// Rate Limiting
export { RateLimiterConfig } from './rate-limiter.middleware.js';

// Audit Logging
export { auditMiddleware, auditLogger } from './audit.middleware.js';

// ═══════════════════════════════════════════════════════════════════════════════
// OBSERVABILITY MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

// Correlation ID for request tracking
export {
  correlationIdMiddleware,
  getCorrelationId,
} from './correlation-id.middleware.js';

// Performance monitoring
export {
  performanceMiddleware,
  requestSizeMiddleware,
} from './performance.middleware.js';

// Error tracking
export {
  errorTrackingMiddleware,
  setupUncaughtExceptionHandler,
} from './error-tracking.middleware.js';
