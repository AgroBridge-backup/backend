import { Request, Response, NextFunction } from 'express';
import { AuditLogger, AuditAction } from '../../logging/audit.logger.js';
import { prisma } from '../../database/prisma/client.js';
import logger from '../../../shared/utils/logger.js';

const auditLogger = new AuditLogger(prisma);

// Map HTTP methods to audit actions
const METHOD_TO_ACTION: Record<string, AuditAction> = {
  POST: AuditAction.CREATE,
  PUT: AuditAction.UPDATE,
  PATCH: AuditAction.UPDATE,
  DELETE: AuditAction.DELETE,
  GET: AuditAction.READ,
};

// Resource mapping from URL paths
const PATH_TO_RESOURCE: Record<string, string> = {
  '/auth': 'Auth',
  '/producers': 'Producer',
  '/batches': 'Batch',
  '/events': 'Event',
  '/certifications': 'Certification',
  '/certificates': 'Certificate',
  '/notifications': 'Notification',
};

// Paths that should not be audited (noise reduction)
const EXCLUDED_PATHS = [
  '/api/v1/status',
  '/health',
  '/health/ready',
  '/admin/queues',
];

// Paths that should only audit mutations (POST, PUT, DELETE)
const MUTATION_ONLY_PATHS = [
  '/batches',
  '/producers',
  '/events',
];

/**
 * Audit middleware for automatic request logging
 * Logs all mutations and critical operations for compliance
 */
export const auditMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Skip excluded paths
  if (EXCLUDED_PATHS.some((path) => req.path.includes(path))) {
    return next();
  }

  // Track request timing
  const startTime = Date.now();

  // Store original response methods
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  // Flag to prevent double logging
  let logged = false;

  const logAudit = (responseBody?: unknown) => {
    if (logged) return;
    logged = true;

    const durationMs = Date.now() - startTime;
    const method = req.method;
    const isSuccess = res.statusCode >= 200 && res.statusCode < 400;

    // Determine if we should audit this request
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const shouldAudit = isMutation || !MUTATION_ONLY_PATHS.some((p) => req.path.includes(p));

    if (!shouldAudit) return;

    // Extract info from request
    const requestInfo = AuditLogger.extractRequestInfo(req);
    const userId = (req as any).user?.userId;
    const action = determineAction(req, responseBody);
    const resource = extractResourceFromPath(req.path);
    const resourceId = extractResourceIdFromPath(req.path, responseBody);

    // Log asynchronously (non-blocking)
    auditLogger.log({
      userId,
      action,
      resource,
      resourceId,
      details: {
        method,
        path: req.path,
        statusCode: res.statusCode,
        query: sanitizeData(req.query),
        body: isMutation ? sanitizeBody(req.body) : undefined,
        responseId: typeof responseBody === 'object' && responseBody !== null
          ? (responseBody as any).id || (responseBody as any).data?.id
          : undefined,
      },
      success: isSuccess,
      errorMessage: !isSuccess ? extractErrorMessage(responseBody) : undefined,
      durationMs,
      ...requestInfo,
    }).catch((err) => {
      logger.error(`[AuditMiddleware] Failed to log audit entry: ${err}`);
    });
  };

  // Override res.json to capture response
  res.json = function (data: unknown) {
    logAudit(data);
    return originalJson(data);
  };

  // Override res.send for non-JSON responses
  res.send = function (data: unknown) {
    logAudit(data);
    return originalSend(data);
  };

  // Log on response finish (fallback)
  res.on('finish', () => {
    logAudit();
  });

  next();
};

/**
 * Determine the specific audit action based on request context
 */
function determineAction(req: Request, responseBody?: unknown): AuditAction {
  const method = req.method;
  const path = req.path.toLowerCase();

  // Auth-specific actions
  if (path.includes('/auth/login')) return AuditAction.LOGIN;
  if (path.includes('/auth/logout')) return AuditAction.LOGOUT;
  if (path.includes('/auth/register')) return AuditAction.REGISTER;
  if (path.includes('/auth/refresh')) return AuditAction.TOKEN_REFRESH;
  if (path.includes('/password-reset')) return AuditAction.PASSWORD_RESET;
  if (path.includes('/password') && method === 'PUT') return AuditAction.PASSWORD_CHANGE;

  // Business-specific actions
  if (path.includes('/whitelist')) return AuditAction.WHITELIST_PRODUCER;
  if (path.includes('/verify') && path.includes('/producer')) return AuditAction.VERIFY_PRODUCER;
  if (path.includes('/verify') && path.includes('/event')) return AuditAction.VERIFY_EVENT;
  if (path.includes('/suspend')) return AuditAction.SUSPEND_PRODUCER;
  if (path.includes('/qr')) return AuditAction.GENERATE_QR;
  if (path.includes('/status') && method === 'PUT') return AuditAction.UPDATE_BATCH_STATUS;
  if (path.includes('/events') && method === 'POST') return AuditAction.REGISTER_EVENT;
  if (path.includes('/certifications') && method === 'POST') return AuditAction.ADD_CERTIFICATION;
  if (path.includes('/export')) return AuditAction.EXPORT_DATA;

  // Default CRUD actions
  return METHOD_TO_ACTION[method] || AuditAction.READ;
}

/**
 * Extract resource type from URL path
 */
function extractResourceFromPath(path: string): string {
  for (const [pattern, resource] of Object.entries(PATH_TO_RESOURCE)) {
    if (path.includes(pattern)) {
      return resource;
    }
  }

  // Try to extract from path structure: /api/v1/{resource}/...
  const match = path.match(/\/api\/v\d+\/(\w+)/);
  if (match) {
    const resource = match[1];
    return resource.charAt(0).toUpperCase() + resource.slice(1);
  }

  return 'Unknown';
}

/**
 * Extract resource ID from URL path or response body
 */
function extractResourceIdFromPath(path: string, responseBody?: unknown): string | undefined {
  // UUID pattern
  const uuidMatch = path.match(/\/([a-f0-9-]{36})/i);
  if (uuidMatch) {
    return uuidMatch[1];
  }

  // Try to get from response body
  if (typeof responseBody === 'object' && responseBody !== null) {
    const body = responseBody as Record<string, unknown>;
    if (typeof body.id === 'string') return body.id;
    if (typeof body.data === 'object' && body.data !== null) {
      const data = body.data as Record<string, unknown>;
      if (typeof data.id === 'string') return data.id;
    }
  }

  return undefined;
}

/**
 * Sanitize request body to remove sensitive data
 */
function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return undefined;

  const sanitized = { ...body as Record<string, unknown> };

  // Remove sensitive fields
  const sensitiveFields = [
    'password',
    'passwordHash',
    'passwordConfirm',
    'newPassword',
    'currentPassword',
    'token',
    'refreshToken',
    'accessToken',
    'secret',
    'apiKey',
    'privateKey',
  ];

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Sanitize query parameters
 */
function sanitizeData(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;

  const sanitized = { ...data as Record<string, unknown> };

  // Remove potential sensitive query params
  const sensitiveParams = ['token', 'key', 'secret', 'password'];

  for (const param of sensitiveParams) {
    if (param in sanitized) {
      sanitized[param] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Extract error message from response body
 */
function extractErrorMessage(responseBody?: unknown): string | undefined {
  if (!responseBody || typeof responseBody !== 'object') return undefined;

  const body = responseBody as Record<string, unknown>;

  if (typeof body.error === 'string') return body.error;
  if (typeof body.message === 'string') return body.message;
  if (typeof body.error === 'object' && body.error !== null) {
    const error = body.error as Record<string, unknown>;
    if (typeof error.message === 'string') return error.message;
  }

  return undefined;
}

/**
 * Export the audit logger instance for manual logging in controllers
 */
export { auditLogger };
