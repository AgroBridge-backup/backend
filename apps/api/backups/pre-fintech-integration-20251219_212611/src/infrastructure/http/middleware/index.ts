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

// CSRF Protection
export {
  csrfProtection,
  csrfTokenEndpoint,
  clearCSRFToken,
  generateCSRFToken,
} from './csrf.middleware.js';

// ═══════════════════════════════════════════════════════════════════════════════
// OBSERVABILITY MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

// Correlation ID for request tracking (legacy - use requestContextMiddleware for new code)
export {
  correlationIdMiddleware,
  getCorrelationId,
} from './correlation-id.middleware.js';

// Request Context with AsyncLocalStorage (recommended)
export {
  requestContextMiddleware,
  getRequestContext,
  getCorrelationId as getContextCorrelationId,
  getRequestId,
  getUserId,
  setUserId,
  setUserRole,
  runWithContext,
  runWithContextAsync,
  getLogContext,
  getRequestDuration,
} from '../../context/request-context.js';

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

// ═══════════════════════════════════════════════════════════════════════════════
// FILE UPLOAD & SECURITY
// ═══════════════════════════════════════════════════════════════════════════════

// Virus scanning for uploads
export {
  virusScanner,
  virusScanMiddleware,
  VirusScanner,
} from '../../security/virus-scanner.js';

// Upload handlers
export {
  uploadImage,
  uploadAvatar,
  uploadDocument,
  uploadCertificate,
  uploadGeneral,
} from './upload.middleware.js';
