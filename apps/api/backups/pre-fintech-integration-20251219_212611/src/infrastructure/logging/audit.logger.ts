import { PrismaClient, AuditAction } from '@prisma/client';
import { Request } from 'express';
import logger from '../../shared/utils/logger.js';

export { AuditAction };

export interface AuditLogEntry {
  userId?: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
  requestId?: string;
  success?: boolean;
  errorMessage?: string;
  durationMs?: number;
}

export interface AuditLogFilters {
  userId?: string;
  action?: AuditAction;
  resource?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  success?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Audit Logger Service
 * Provides enterprise-grade audit logging for compliance requirements
 * Supports 7-year retention for FSMA, SENASICA, and EU regulations
 */
export class AuditLogger {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Log an audit event asynchronously
   * Non-blocking to prevent impacting request performance
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId,
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId,
          details: entry.details ? JSON.parse(JSON.stringify(entry.details)) : undefined,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          correlationId: entry.correlationId,
          requestId: entry.requestId,
          success: entry.success ?? true,
          errorMessage: entry.errorMessage,
          durationMs: entry.durationMs,
        },
      });
    } catch (error) {
      // Log the error but don't fail the request
      logger.error(`[AuditLogger] Failed to create audit log entry: ${error}`);
    }
  }

  /**
   * Log an audit event synchronously (blocking)
   * Use only when audit log creation is critical
   */
  async logSync(entry: AuditLogEntry): Promise<string | null> {
    try {
      const result = await this.prisma.auditLog.create({
        data: {
          userId: entry.userId,
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId,
          details: entry.details ? JSON.parse(JSON.stringify(entry.details)) : undefined,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          correlationId: entry.correlationId,
          requestId: entry.requestId,
          success: entry.success ?? true,
          errorMessage: entry.errorMessage,
          durationMs: entry.durationMs,
        },
      });
      return result.id;
    } catch (error) {
      logger.error(`[AuditLogger] Failed to create audit log entry (sync): ${error}`);
      return null;
    }
  }

  /**
   * Extract request information from Express request
   */
  static extractRequestInfo(req: Request): Pick<AuditLogEntry, 'ipAddress' | 'userAgent' | 'correlationId' | 'requestId'> {
    return {
      ipAddress: req.ip || req.socket?.remoteAddress || undefined,
      userAgent: req.headers['user-agent']?.substring(0, 500),
      correlationId: (req.headers['x-correlation-id'] as string)?.substring(0, 100),
      requestId: (req as any).requestId?.substring(0, 100),
    };
  }

  /**
   * Query audit logs with filters (for compliance and admin dashboards)
   */
  async findLogs(filters: AuditLogFilters) {
    return this.prisma.auditLog.findMany({
      where: {
        userId: filters.userId,
        action: filters.action,
        resource: filters.resource,
        resourceId: filters.resourceId,
        success: filters.success,
        timestamp: {
          gte: filters.startDate,
          lte: filters.endDate,
        },
      },
      orderBy: { timestamp: 'desc' },
      take: filters.limit || 100,
      skip: filters.offset || 0,
    });
  }

  /**
   * Count audit logs matching filters
   */
  async countLogs(filters: AuditLogFilters): Promise<number> {
    return this.prisma.auditLog.count({
      where: {
        userId: filters.userId,
        action: filters.action,
        resource: filters.resource,
        resourceId: filters.resourceId,
        success: filters.success,
        timestamp: {
          gte: filters.startDate,
          lte: filters.endDate,
        },
      },
    });
  }

  /**
   * Export audit logs for compliance reports
   * Returns all logs within date range for regulatory export
   */
  async exportLogs(startDate: Date, endDate: Date) {
    return this.prisma.auditLog.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { timestamp: 'asc' },
    });
  }

  /**
   * Get user activity summary for security monitoring
   */
  async getUserActivitySummary(userId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await this.prisma.auditLog.groupBy({
      by: ['action'],
      where: {
        userId,
        timestamp: { gte: startDate },
      },
      _count: { action: true },
    });

    return logs.map((log) => ({
      action: log.action,
      count: log._count.action,
    }));
  }

  /**
   * Detect suspicious activity patterns
   * Returns true if activity exceeds normal thresholds
   */
  async detectSuspiciousActivity(userId: string): Promise<boolean> {
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    // Check for excessive failed operations
    const failedCount = await this.prisma.auditLog.count({
      where: {
        userId,
        success: false,
        timestamp: { gte: oneHourAgo },
      },
    });

    // Check for unusual login attempts
    const loginAttempts = await this.prisma.auditLog.count({
      where: {
        userId,
        action: AuditAction.LOGIN,
        timestamp: { gte: oneHourAgo },
      },
    });

    // Thresholds for suspicious activity
    return failedCount > 10 || loginAttempts > 20;
  }

  /**
   * Cleanup old audit logs (for environments that don't require 7-year retention)
   * CAUTION: This should only be used in development/testing
   */
  async cleanupOldLogs(olderThanDays: number): Promise<number> {
    if (process.env.NODE_ENV === 'production') {
      logger.warn('[AuditLogger] Attempted to cleanup audit logs in production - operation denied');
      return 0;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.prisma.auditLog.deleteMany({
      where: {
        timestamp: { lt: cutoffDate },
      },
    });

    logger.info(`[AuditLogger] Cleaned up old audit logs: ${result.count} deleted`);
    return result.count;
  }
}
