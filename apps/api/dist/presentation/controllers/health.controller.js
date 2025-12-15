import logger from '../../shared/utils/logger.js';
import { redisCacheService } from '../../infrastructure/cache/index.js';
import { queueService } from '../../infrastructure/queue/index.js';
export class HealthController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async liveness(_req, res) {
        res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
            version: process.env.npm_package_version || '2.0.0',
            service: 'agrobridge-api',
        });
    }
    async readiness(_req, res) {
        const checks = {};
        checks.database = await this.checkDatabase();
        checks.redis = await this.checkRedis();
        const isReady = Object.values(checks).every((check) => check.status === 'healthy');
        res.status(isReady ? 200 : 503).json({
            status: isReady ? 'ready' : 'not_ready',
            timestamp: new Date().toISOString(),
            checks,
        });
    }
    async startup(_req, res) {
        try {
            const dbCheck = await this.checkDatabase();
            if (dbCheck.status === 'healthy') {
                res.status(200).json({
                    status: 'started',
                    timestamp: new Date().toISOString(),
                });
            }
            else {
                res.status(503).json({
                    status: 'starting',
                    timestamp: new Date().toISOString(),
                    error: 'Database not ready',
                });
            }
        }
        catch (error) {
            res.status(503).json({
                status: 'starting',
                timestamp: new Date().toISOString(),
                error: 'Initialization in progress',
            });
        }
    }
    async metrics(_req, res) {
        const memoryUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        res.status(200).json({
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: {
                heapTotal: memoryUsage.heapTotal,
                heapUsed: memoryUsage.heapUsed,
                external: memoryUsage.external,
                rss: memoryUsage.rss,
                heapUsedPercent: ((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100).toFixed(2) + '%',
            },
            cpu: {
                user: cpuUsage.user,
                system: cpuUsage.system,
            },
            process: {
                pid: process.pid,
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
            },
        });
    }
    async checkDatabase() {
        const startTime = Date.now();
        try {
            await this.prisma.$queryRaw `SELECT 1`;
            return {
                status: 'healthy',
                latency: Date.now() - startTime,
            };
        }
        catch (error) {
            logger.error(`[HealthCheck] Database check failed: ${error}`);
            return {
                status: 'unhealthy',
                latency: Date.now() - startTime,
                error: 'Database connection failed',
            };
        }
    }
    async checkRedis() {
        try {
            const health = await redisCacheService.healthCheck();
            return {
                status: health.status === 'healthy' ? 'healthy' : health.status === 'degraded' ? 'degraded' : 'unhealthy',
                latency: health.latencyMs,
                error: health.errorMessage,
            };
        }
        catch (error) {
            logger.error(`[HealthCheck] Redis check failed: ${error}`);
            return {
                status: 'unhealthy',
                error: 'Redis connection failed',
            };
        }
    }
    async cacheStats(_req, res) {
        try {
            const health = await redisCacheService.healthCheck();
            const stats = await redisCacheService.getStats();
            res.status(health.status === 'healthy' ? 200 : 503).json({
                status: health.status,
                connected: health.connected,
                latencyMs: health.latencyMs,
                statistics: {
                    hits: stats.hits,
                    misses: stats.misses,
                    errors: stats.errors,
                    hitRate: stats.hits + stats.misses > 0
                        ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(2) + '%'
                        : '0%',
                    keys: stats.keys,
                    memoryUsage: stats.memoryUsage,
                    uptime: stats.uptime,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger.error(`[HealthCheck] Cache stats failed: ${error}`);
            res.status(503).json({
                status: 'unhealthy',
                error: 'Failed to retrieve cache statistics',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async queueStats(_req, res) {
        try {
            const health = await queueService.healthCheck();
            const isHealthy = health.connected && health.redis.status === 'connected';
            res.status(isHealthy ? 200 : 503).json({
                status: isHealthy ? 'healthy' : 'unhealthy',
                connected: health.connected,
                redis: health.redis,
                queues: {
                    qrGeneration: {
                        name: health.queues.qrGeneration.name,
                        waiting: health.queues.qrGeneration.waiting,
                        active: health.queues.qrGeneration.active,
                        completed: health.queues.qrGeneration.completed,
                        failed: health.queues.qrGeneration.failed,
                        delayed: health.queues.qrGeneration.delayed,
                        paused: health.queues.qrGeneration.paused,
                    },
                    blockchain: {
                        name: health.queues.blockchain.name,
                        waiting: health.queues.blockchain.waiting,
                        active: health.queues.blockchain.active,
                        completed: health.queues.blockchain.completed,
                        failed: health.queues.blockchain.failed,
                        delayed: health.queues.blockchain.delayed,
                        paused: health.queues.blockchain.paused,
                    },
                    email: {
                        name: health.queues.email.name,
                        waiting: health.queues.email.waiting,
                        active: health.queues.email.active,
                        completed: health.queues.email.completed,
                        failed: health.queues.email.failed,
                        delayed: health.queues.email.delayed,
                        paused: health.queues.email.paused,
                    },
                    reports: {
                        name: health.queues.reports.name,
                        waiting: health.queues.reports.waiting,
                        active: health.queues.reports.active,
                        completed: health.queues.reports.completed,
                        failed: health.queues.reports.failed,
                        delayed: health.queues.reports.delayed,
                        paused: health.queues.reports.paused,
                    },
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger.error(`[HealthCheck] Queue stats failed: ${error}`);
            res.status(503).json({
                status: 'unhealthy',
                error: 'Failed to retrieve queue statistics',
                timestamp: new Date().toISOString(),
            });
        }
    }
}
