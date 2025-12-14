import { AuditAction } from '@prisma/client';
import logger from '../../shared/utils/logger.js';
export { AuditAction };
export class AuditLogger {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async log(entry) {
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
        }
        catch (error) {
            logger.error(`[AuditLogger] Failed to create audit log entry: ${error}`);
        }
    }
    async logSync(entry) {
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
        }
        catch (error) {
            logger.error(`[AuditLogger] Failed to create audit log entry (sync): ${error}`);
            return null;
        }
    }
    static extractRequestInfo(req) {
        return {
            ipAddress: req.ip || req.socket?.remoteAddress || undefined,
            userAgent: req.headers['user-agent']?.substring(0, 500),
            correlationId: req.headers['x-correlation-id']?.substring(0, 100),
            requestId: req.requestId?.substring(0, 100),
        };
    }
    async findLogs(filters) {
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
    async countLogs(filters) {
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
    async exportLogs(startDate, endDate) {
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
    async getUserActivitySummary(userId, days = 30) {
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
    async detectSuspiciousActivity(userId) {
        const oneHourAgo = new Date();
        oneHourAgo.setHours(oneHourAgo.getHours() - 1);
        const failedCount = await this.prisma.auditLog.count({
            where: {
                userId,
                success: false,
                timestamp: { gte: oneHourAgo },
            },
        });
        const loginAttempts = await this.prisma.auditLog.count({
            where: {
                userId,
                action: AuditAction.LOGIN,
                timestamp: { gte: oneHourAgo },
            },
        });
        return failedCount > 10 || loginAttempts > 20;
    }
    async cleanupOldLogs(olderThanDays) {
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
