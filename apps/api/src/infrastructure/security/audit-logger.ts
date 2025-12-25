/**
 * Comprehensive Audit Logger
 * Tracks security events, user actions, and system changes for compliance
 */

import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { logger } from '../logging/logger.js';

// Database and Redis clients
let prisma: PrismaClient | null = null;
let redis: Redis | null = null;

/**
 * Initialize audit logger dependencies
 */
export function initAuditLogger(prismaClient: PrismaClient, redisClient?: Redis): void {
  prisma = prismaClient;
  redis = redisClient || null;
  logger.info('Audit logger initialized');
}

/**
 * Audit event types
 */
export enum AuditEventType {
  // Authentication events
  AUTH_LOGIN_SUCCESS = 'AUTH_LOGIN_SUCCESS',
  AUTH_LOGIN_FAILURE = 'AUTH_LOGIN_FAILURE',
  AUTH_LOGOUT = 'AUTH_LOGOUT',
  AUTH_TOKEN_REFRESH = 'AUTH_TOKEN_REFRESH',
  AUTH_PASSWORD_CHANGE = 'AUTH_PASSWORD_CHANGE',
  AUTH_PASSWORD_RESET_REQUEST = 'AUTH_PASSWORD_RESET_REQUEST',
  AUTH_PASSWORD_RESET_COMPLETE = 'AUTH_PASSWORD_RESET_COMPLETE',
  AUTH_2FA_ENABLED = 'AUTH_2FA_ENABLED',
  AUTH_2FA_DISABLED = 'AUTH_2FA_DISABLED',
  AUTH_2FA_VERIFIED = 'AUTH_2FA_VERIFIED',
  AUTH_SESSION_INVALIDATED = 'AUTH_SESSION_INVALIDATED',

  // User management events
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',
  USER_PERMISSIONS_CHANGED = 'USER_PERMISSIONS_CHANGED',
  USER_SUSPENDED = 'USER_SUSPENDED',
  USER_REACTIVATED = 'USER_REACTIVATED',

  // Data access events
  DATA_READ = 'DATA_READ',
  DATA_CREATED = 'DATA_CREATED',
  DATA_UPDATED = 'DATA_UPDATED',
  DATA_DELETED = 'DATA_DELETED',
  DATA_EXPORTED = 'DATA_EXPORTED',
  DATA_BULK_OPERATION = 'DATA_BULK_OPERATION',

  // Security events
  SECURITY_RATE_LIMIT_EXCEEDED = 'SECURITY_RATE_LIMIT_EXCEEDED',
  SECURITY_INVALID_TOKEN = 'SECURITY_INVALID_TOKEN',
  SECURITY_UNAUTHORIZED_ACCESS = 'SECURITY_UNAUTHORIZED_ACCESS',
  SECURITY_SUSPICIOUS_ACTIVITY = 'SECURITY_SUSPICIOUS_ACTIVITY',
  SECURITY_INJECTION_ATTEMPT = 'SECURITY_INJECTION_ATTEMPT',
  SECURITY_XSS_ATTEMPT = 'SECURITY_XSS_ATTEMPT',
  SECURITY_CSRF_ATTEMPT = 'SECURITY_CSRF_ATTEMPT',

  // API events
  API_REQUEST = 'API_REQUEST',
  API_ERROR = 'API_ERROR',
  API_KEY_CREATED = 'API_KEY_CREATED',
  API_KEY_REVOKED = 'API_KEY_REVOKED',

  // System events
  SYSTEM_CONFIG_CHANGED = 'SYSTEM_CONFIG_CHANGED',
  SYSTEM_MAINTENANCE_MODE = 'SYSTEM_MAINTENANCE_MODE',
  SYSTEM_BACKUP_CREATED = 'SYSTEM_BACKUP_CREATED',
  SYSTEM_BACKUP_RESTORED = 'SYSTEM_BACKUP_RESTORED',

  // GDPR/Compliance events
  GDPR_DATA_ACCESS_REQUEST = 'GDPR_DATA_ACCESS_REQUEST',
  GDPR_DATA_DELETION_REQUEST = 'GDPR_DATA_DELETION_REQUEST',
  GDPR_DATA_EXPORT_REQUEST = 'GDPR_DATA_EXPORT_REQUEST',
  GDPR_CONSENT_GIVEN = 'GDPR_CONSENT_GIVEN',
  GDPR_CONSENT_WITHDRAWN = 'GDPR_CONSENT_WITHDRAWN',
}

/**
 * Audit event severity levels
 */
export enum AuditSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * Audit log entry interface
 */
export interface AuditLogEntry {
  id?: string;
  timestamp: Date;
  eventType: AuditEventType;
  severity: AuditSeverity;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
  resourceType?: string;
  resourceId?: string;
  action: string;
  description: string;
  metadata?: Record<string, unknown>;
  requestId?: string;
  sessionId?: string;
  success: boolean;
  errorMessage?: string;
}

/**
 * Severity mapping for event types
 */
const EVENT_SEVERITY_MAP: Record<AuditEventType, AuditSeverity> = {
  [AuditEventType.AUTH_LOGIN_SUCCESS]: AuditSeverity.LOW,
  [AuditEventType.AUTH_LOGIN_FAILURE]: AuditSeverity.MEDIUM,
  [AuditEventType.AUTH_LOGOUT]: AuditSeverity.LOW,
  [AuditEventType.AUTH_TOKEN_REFRESH]: AuditSeverity.LOW,
  [AuditEventType.AUTH_PASSWORD_CHANGE]: AuditSeverity.HIGH,
  [AuditEventType.AUTH_PASSWORD_RESET_REQUEST]: AuditSeverity.MEDIUM,
  [AuditEventType.AUTH_PASSWORD_RESET_COMPLETE]: AuditSeverity.HIGH,
  [AuditEventType.AUTH_2FA_ENABLED]: AuditSeverity.HIGH,
  [AuditEventType.AUTH_2FA_DISABLED]: AuditSeverity.HIGH,
  [AuditEventType.AUTH_2FA_VERIFIED]: AuditSeverity.LOW,
  [AuditEventType.AUTH_SESSION_INVALIDATED]: AuditSeverity.MEDIUM,
  [AuditEventType.USER_CREATED]: AuditSeverity.MEDIUM,
  [AuditEventType.USER_UPDATED]: AuditSeverity.LOW,
  [AuditEventType.USER_DELETED]: AuditSeverity.HIGH,
  [AuditEventType.USER_ROLE_CHANGED]: AuditSeverity.HIGH,
  [AuditEventType.USER_PERMISSIONS_CHANGED]: AuditSeverity.HIGH,
  [AuditEventType.USER_SUSPENDED]: AuditSeverity.HIGH,
  [AuditEventType.USER_REACTIVATED]: AuditSeverity.MEDIUM,
  [AuditEventType.DATA_READ]: AuditSeverity.LOW,
  [AuditEventType.DATA_CREATED]: AuditSeverity.LOW,
  [AuditEventType.DATA_UPDATED]: AuditSeverity.LOW,
  [AuditEventType.DATA_DELETED]: AuditSeverity.MEDIUM,
  [AuditEventType.DATA_EXPORTED]: AuditSeverity.MEDIUM,
  [AuditEventType.DATA_BULK_OPERATION]: AuditSeverity.HIGH,
  [AuditEventType.SECURITY_RATE_LIMIT_EXCEEDED]: AuditSeverity.MEDIUM,
  [AuditEventType.SECURITY_INVALID_TOKEN]: AuditSeverity.MEDIUM,
  [AuditEventType.SECURITY_UNAUTHORIZED_ACCESS]: AuditSeverity.HIGH,
  [AuditEventType.SECURITY_SUSPICIOUS_ACTIVITY]: AuditSeverity.CRITICAL,
  [AuditEventType.SECURITY_INJECTION_ATTEMPT]: AuditSeverity.CRITICAL,
  [AuditEventType.SECURITY_XSS_ATTEMPT]: AuditSeverity.HIGH,
  [AuditEventType.SECURITY_CSRF_ATTEMPT]: AuditSeverity.HIGH,
  [AuditEventType.API_REQUEST]: AuditSeverity.LOW,
  [AuditEventType.API_ERROR]: AuditSeverity.MEDIUM,
  [AuditEventType.API_KEY_CREATED]: AuditSeverity.HIGH,
  [AuditEventType.API_KEY_REVOKED]: AuditSeverity.HIGH,
  [AuditEventType.SYSTEM_CONFIG_CHANGED]: AuditSeverity.CRITICAL,
  [AuditEventType.SYSTEM_MAINTENANCE_MODE]: AuditSeverity.HIGH,
  [AuditEventType.SYSTEM_BACKUP_CREATED]: AuditSeverity.MEDIUM,
  [AuditEventType.SYSTEM_BACKUP_RESTORED]: AuditSeverity.CRITICAL,
  [AuditEventType.GDPR_DATA_ACCESS_REQUEST]: AuditSeverity.HIGH,
  [AuditEventType.GDPR_DATA_DELETION_REQUEST]: AuditSeverity.CRITICAL,
  [AuditEventType.GDPR_DATA_EXPORT_REQUEST]: AuditSeverity.HIGH,
  [AuditEventType.GDPR_CONSENT_GIVEN]: AuditSeverity.MEDIUM,
  [AuditEventType.GDPR_CONSENT_WITHDRAWN]: AuditSeverity.HIGH,
};

/**
 * Create an audit log entry
 */
export async function createAuditLog(entry: Partial<AuditLogEntry>): Promise<void> {
  const timestamp = new Date();
  const severity = entry.eventType ? EVENT_SEVERITY_MAP[entry.eventType] : AuditSeverity.LOW;

  const fullEntry: AuditLogEntry = {
    timestamp,
    eventType: entry.eventType || AuditEventType.API_REQUEST,
    severity,
    action: entry.action || 'unknown',
    description: entry.description || '',
    success: entry.success ?? true,
    ...entry,
  };

  try {
    // Log to structured logger
    logger.info('Audit event', {
      audit: true,
      ...fullEntry,
      metadata: fullEntry.metadata ? JSON.stringify(fullEntry.metadata) : undefined,
    });

    // Store in Redis for real-time monitoring (if available)
    if (redis) {
      const key = `audit:${timestamp.toISOString().split('T')[0]}`;
      await redis.lpush(key, JSON.stringify(fullEntry));
      await redis.expire(key, 90 * 24 * 60 * 60); // 90 days retention
    }

    // Store in database for long-term retention
    if (prisma) {
      await (prisma as any).auditLog?.create({
        data: {
          eventType: fullEntry.eventType,
          severity: fullEntry.severity,
          userId: fullEntry.userId,
          userEmail: fullEntry.userEmail,
          userRole: fullEntry.userRole,
          ipAddress: fullEntry.ipAddress,
          userAgent: fullEntry.userAgent,
          resourceType: fullEntry.resourceType,
          resourceId: fullEntry.resourceId,
          action: fullEntry.action,
          description: fullEntry.description,
          metadata: fullEntry.metadata ? JSON.stringify(fullEntry.metadata) : null,
          requestId: fullEntry.requestId,
          sessionId: fullEntry.sessionId,
          success: fullEntry.success,
          errorMessage: fullEntry.errorMessage,
          timestamp: fullEntry.timestamp,
        },
      }).catch(() => {
        // Silently fail if AuditLog model doesn't exist
      });
    }
  } catch (error) {
    // Never let audit logging failure break the application
    logger.error('Failed to create audit log', { error, entry: fullEntry });
  }
}

/**
 * Audit logger class for chained logging
 */
export class AuditLogger {
  private entry: Partial<AuditLogEntry> = {};

  eventType(type: AuditEventType): this {
    this.entry.eventType = type;
    return this;
  }

  user(userId: string, email?: string, role?: string): this {
    this.entry.userId = userId;
    this.entry.userEmail = email;
    this.entry.userRole = role;
    return this;
  }

  request(req: Request): this {
    this.entry.ipAddress = req.ip || req.socket.remoteAddress;
    this.entry.userAgent = req.headers['user-agent'];
    this.entry.requestId = req.headers['x-request-id'] as string;
    if (req.user) {
      this.entry.userId = req.user.id || req.user.userId;
      this.entry.userEmail = req.user.email;
      this.entry.userRole = req.user.role;
    }
    return this;
  }

  resource(type: string, id: string): this {
    this.entry.resourceType = type;
    this.entry.resourceId = id;
    return this;
  }

  action(action: string): this {
    this.entry.action = action;
    return this;
  }

  description(desc: string): this {
    this.entry.description = desc;
    return this;
  }

  metadata(data: Record<string, unknown>): this {
    this.entry.metadata = { ...this.entry.metadata, ...data };
    return this;
  }

  session(sessionId: string): this {
    this.entry.sessionId = sessionId;
    return this;
  }

  success(): this {
    this.entry.success = true;
    return this;
  }

  failure(errorMessage?: string): this {
    this.entry.success = false;
    this.entry.errorMessage = errorMessage;
    return this;
  }

  async log(): Promise<void> {
    await createAuditLog(this.entry);
  }
}

/**
 * Create a new audit logger instance
 */
export function audit(): AuditLogger {
  return new AuditLogger();
}

/**
 * Audit middleware for automatic request logging
 */
export function auditMiddleware(
  options: {
    logAllRequests?: boolean;
    excludePaths?: string[];
    sensitiveFields?: string[];
  } = {}
): (req: Request, res: Response, next: NextFunction) => void {
  const {
    logAllRequests = false,
    excludePaths = ['/health', '/metrics', '/favicon.ico'],
    sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'refreshToken'],
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip excluded paths
    if (excludePaths.some((path) => req.path.startsWith(path))) {
      next();
      return;
    }

    const startTime = Date.now();

    // Capture original end function
    const originalEnd = res.end;

    res.end = function (chunk?: any, encoding?: any, callback?: any): Response {
      const duration = Date.now() - startTime;

      // Determine if we should log
      const shouldLog = logAllRequests ||
        res.statusCode >= 400 ||
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);

      if (shouldLog) {
        const entry: Partial<AuditLogEntry> = {
          eventType: res.statusCode >= 400 ? AuditEventType.API_ERROR : AuditEventType.API_REQUEST,
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
          requestId: req.headers['x-request-id'] as string,
          action: `${req.method} ${req.path}`,
          description: `${req.method} ${req.originalUrl}`,
          success: res.statusCode < 400,
          metadata: {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration,
            query: sanitizeMetadata(req.query, sensitiveFields),
            body: sanitizeMetadata(req.body, sensitiveFields),
          },
        };

        if (req.user) {
          entry.userId = req.user.id || req.user.userId;
          entry.userEmail = req.user.email;
          entry.userRole = req.user.role;
        }

        // Don't await - fire and forget
        createAuditLog(entry).catch(() => {});
      }

      return originalEnd.call(this, chunk, encoding, callback);
    };

    next();
  };
}

/**
 * Sanitize metadata by redacting sensitive fields
 */
function sanitizeMetadata(
  data: unknown,
  sensitiveFields: string[]
): Record<string, unknown> | undefined {
  if (!data || typeof data !== 'object') {
    return undefined;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (sensitiveFields.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeMetadata(value, sensitiveFields);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Query audit logs
 */
export async function queryAuditLogs(filters: {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  eventType?: AuditEventType;
  severity?: AuditSeverity;
  resourceType?: string;
  resourceId?: string;
  success?: boolean;
  limit?: number;
  offset?: number;
}): Promise<AuditLogEntry[]> {
  if (!prisma) {
    return [];
  }

  const {
    startDate,
    endDate,
    userId,
    eventType,
    severity,
    resourceType,
    resourceId,
    success,
    limit = 100,
    offset = 0,
  } = filters;

  try {
    const logs = await (prisma as any).auditLog?.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
        userId,
        eventType,
        severity,
        resourceType,
        resourceId,
        success,
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
    }) || [];

    return logs.map((log: any) => ({
      ...log,
      metadata: log.metadata ? JSON.parse(log.metadata) : undefined,
    }));
  } catch (error) {
    logger.error('Failed to query audit logs', { error, filters });
    return [];
  }
}

/**
 * Get audit statistics
 */
export async function getAuditStats(period: 'day' | 'week' | 'month' = 'day'): Promise<{
  totalEvents: number;
  byEventType: Record<string, number>;
  bySeverity: Record<string, number>;
  failureRate: number;
}> {
  const now = new Date();
  const startDate = new Date();

  switch (period) {
    case 'week':
      startDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(now.getMonth() - 1);
      break;
    default:
      startDate.setDate(now.getDate() - 1);
  }

  if (!prisma) {
    return {
      totalEvents: 0,
      byEventType: {},
      bySeverity: {},
      failureRate: 0,
    };
  }

  try {
    const logs = await (prisma as any).auditLog?.findMany({
      where: {
        timestamp: { gte: startDate },
      },
      select: {
        eventType: true,
        severity: true,
        success: true,
      },
    }) || [];

    const byEventType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    let failures = 0;

    for (const log of logs) {
      byEventType[log.eventType] = (byEventType[log.eventType] || 0) + 1;
      bySeverity[log.severity] = (bySeverity[log.severity] || 0) + 1;
      if (!log.success) failures++;
    }

    return {
      totalEvents: logs.length,
      byEventType,
      bySeverity,
      failureRate: logs.length > 0 ? failures / logs.length : 0,
    };
  } catch (error) {
    logger.error('Failed to get audit stats', { error });
    return {
      totalEvents: 0,
      byEventType: {},
      bySeverity: {},
      failureRate: 0,
    };
  }
}

export default {
  audit,
  createAuditLog,
  auditMiddleware,
  queryAuditLogs,
  getAuditStats,
  initAuditLogger,
  AuditEventType,
  AuditSeverity,
};
