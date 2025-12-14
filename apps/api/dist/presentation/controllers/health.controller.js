import logger from '../../shared/utils/logger.js';
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
        checks.redis = await this.checkRedisEnv();
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
    async checkRedisEnv() {
        const redisUrl = process.env.REDIS_URL || process.env.REDIS_HOST;
        if (redisUrl) {
            return {
                status: 'healthy',
            };
        }
        return {
            status: 'unhealthy',
            error: 'Redis not configured',
        };
    }
}
