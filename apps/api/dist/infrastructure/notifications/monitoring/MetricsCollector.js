import { PrismaClient } from '@prisma/client';
import { notificationQueue } from '../queue/NotificationQueue.js';
import logger from '../../../shared/utils/logger.js';
const prisma = new PrismaClient();
export class MetricsCollector {
    static instance = null;
    constructor() {
    }
    static getInstance() {
        if (!MetricsCollector.instance) {
            MetricsCollector.instance = new MetricsCollector();
        }
        return MetricsCollector.instance;
    }
    async collectMetrics(periodHours = 1) {
        const now = new Date();
        const since = new Date(now.getTime() - periodHours * 60 * 60 * 1000);
        try {
            const [totalSent, totalDelivered, totalFailed, avgLatencyResult] = await Promise.all([
                this.countNotifications('SENT', since),
                this.countNotifications('DELIVERED', since),
                this.countNotifications('FAILED', since),
                this.calculateAverageLatency(since),
            ]);
            const queueStats = await notificationQueue.getStats();
            const channelMetrics = await this.getChannelMetrics(since);
            const errorMetrics = await this.getErrorMetrics(since);
            const totalProcessed = totalDelivered + totalFailed;
            const deliveryRate = totalProcessed > 0 ? (totalDelivered / totalProcessed) * 100 : 100;
            const metrics = {
                timestamp: now,
                period: `${periodHours}h`,
                totalSent,
                totalDelivered,
                totalFailed,
                deliveryRate: Math.round(deliveryRate * 100) / 100,
                avgLatency: avgLatencyResult,
                queueDepth: queueStats.waiting + queueStats.active,
                queueStats,
                channelMetrics,
                errorMetrics,
            };
            logger.debug('[MetricsCollector] Metrics collected', {
                deliveryRate: metrics.deliveryRate,
                queueDepth: metrics.queueDepth,
                totalSent: metrics.totalSent,
            });
            return metrics;
        }
        catch (error) {
            const err = error;
            logger.error('[MetricsCollector] Failed to collect metrics', {
                error: err.message,
            });
            return {
                timestamp: now,
                period: `${periodHours}h`,
                totalSent: 0,
                totalDelivered: 0,
                totalFailed: 0,
                deliveryRate: 0,
                avgLatency: 0,
                queueDepth: 0,
                queueStats: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
                channelMetrics: [],
                errorMetrics: [],
            };
        }
    }
    async getDeliveryRate24h() {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const [delivered, failed] = await Promise.all([
            this.countNotifications('DELIVERED', since),
            this.countNotifications('FAILED', since),
        ]);
        const total = delivered + failed;
        return total > 0 ? (delivered / total) * 100 : 100;
    }
    async calculateAverageLatency(since) {
        const notifications = await prisma.notification.findMany({
            where: {
                status: 'DELIVERED',
                deliveredAt: { gte: since },
            },
            select: {
                createdAt: true,
                deliveredAt: true,
            },
            take: 1000,
        });
        if (notifications.length === 0)
            return 0;
        const totalLatency = notifications.reduce((sum, n) => {
            if (!n.deliveredAt)
                return sum;
            return sum + (n.deliveredAt.getTime() - n.createdAt.getTime());
        }, 0);
        return Math.round(totalLatency / notifications.length);
    }
    async countNotifications(status, since) {
        return await prisma.notification.count({
            where: {
                status: status,
                createdAt: { gte: since },
            },
        });
    }
    async getChannelMetrics(since) {
        const channels = ['PUSH', 'EMAIL', 'SMS', 'WHATSAPP'];
        const metrics = await Promise.all(channels.map(async (channel) => {
            const [total, delivered] = await Promise.all([
                prisma.notificationDeliveryLog.count({
                    where: {
                        channel,
                        attemptedAt: { gte: since },
                    },
                }),
                prisma.notificationDeliveryLog.count({
                    where: {
                        channel,
                        status: 'SUCCESS',
                        attemptedAt: { gte: since },
                    },
                }),
            ]);
            const latencyResult = await prisma.notificationDeliveryLog.aggregate({
                where: {
                    channel,
                    status: 'SUCCESS',
                    attemptedAt: { gte: since },
                    latencyMs: { not: null },
                },
                _avg: {
                    latencyMs: true,
                },
            });
            return {
                channel,
                total,
                delivered,
                deliveryRate: total > 0 ? Math.round((delivered / total) * 10000) / 100 : 100,
                avgLatency: Math.round(latencyResult._avg.latencyMs || 0),
            };
        }));
        return metrics.filter((m) => m.total > 0);
    }
    async getErrorMetrics(since) {
        const failedLogs = await prisma.notificationDeliveryLog.findMany({
            where: {
                status: 'FAILED',
                attemptedAt: { gte: since },
            },
            select: {
                providerError: true,
            },
        });
        const errorCounts = {};
        failedLogs.forEach((log) => {
            const errorType = this.categorizeError(log.providerError);
            errorCounts[errorType] = (errorCounts[errorType] || 0) + 1;
        });
        const totalErrors = failedLogs.length;
        return Object.entries(errorCounts).map(([errorType, count]) => ({
            errorType,
            count,
            percentage: totalErrors > 0 ? Math.round((count / totalErrors) * 10000) / 100 : 0,
        }));
    }
    categorizeError(errorMessage) {
        if (!errorMessage)
            return 'UNKNOWN';
        const message = errorMessage.toLowerCase();
        if (message.includes('invalid') && message.includes('token')) {
            return 'INVALID_TOKEN';
        }
        if (message.includes('unregistered')) {
            return 'UNREGISTERED_DEVICE';
        }
        if (message.includes('timeout')) {
            return 'TIMEOUT';
        }
        if (message.includes('rate limit') || message.includes('too many')) {
            return 'RATE_LIMIT';
        }
        if (message.includes('network') || message.includes('connection')) {
            return 'NETWORK_ERROR';
        }
        if (message.includes('auth') || message.includes('credential')) {
            return 'AUTH_ERROR';
        }
        if (message.includes('not found')) {
            return 'NOT_FOUND';
        }
        return 'OTHER';
    }
    async checkHealth() {
        try {
            const [deliveryRate, queueStats] = await Promise.all([
                this.getDeliveryRate24h(),
                notificationQueue.getStats(),
            ]);
            const queueDepth = queueStats.waiting + queueStats.active;
            const isDeliveryHealthy = deliveryRate > 95;
            const isQueueHealthy = queueDepth < 10000;
            const healthy = isDeliveryHealthy && isQueueHealthy;
            return {
                healthy,
                deliveryRate: Math.round(deliveryRate * 100) / 100,
                queueDepth,
                timestamp: new Date(),
                services: {
                    fcm: true,
                    apns: true,
                    email: true,
                    sms: true,
                    redis: true,
                    database: true,
                },
            };
        }
        catch (error) {
            const err = error;
            logger.error('[MetricsCollector] Health check failed', {
                error: err.message,
            });
            return {
                healthy: false,
                deliveryRate: 0,
                queueDepth: 0,
                timestamp: new Date(),
            };
        }
    }
    async getTopNotificationTypes(since, limit = 10) {
        const results = await prisma.notification.groupBy({
            by: ['type'],
            where: {
                createdAt: { gte: since },
            },
            _count: {
                type: true,
            },
            orderBy: {
                _count: {
                    type: 'desc',
                },
            },
            take: limit,
        });
        return results.map((r) => ({
            type: r.type,
            count: r._count.type,
        }));
    }
    async getVolumeOverTime(hoursBack = 24, intervalHours = 1) {
        const now = new Date();
        const results = [];
        for (let i = hoursBack; i >= 0; i -= intervalHours) {
            const start = new Date(now.getTime() - i * 60 * 60 * 1000);
            const end = new Date(now.getTime() - (i - intervalHours) * 60 * 60 * 1000);
            const count = await prisma.notification.count({
                where: {
                    createdAt: {
                        gte: start,
                        lt: end,
                    },
                },
            });
            results.push({ timestamp: start, count });
        }
        return results;
    }
}
export const metricsCollector = MetricsCollector.getInstance();
export default metricsCollector;
