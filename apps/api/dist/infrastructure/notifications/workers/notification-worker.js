import { notificationQueue } from '../queue/NotificationQueue.js';
import { metricsCollector } from '../monitoring/MetricsCollector.js';
import logger from '../../../shared/utils/logger.js';
const HEALTH_CHECK_INTERVAL = 60000;
const METRICS_COLLECTION_INTERVAL = 300000;
async function startWorker() {
    logger.info('[NotificationWorker] Starting notification worker...', {
        nodeEnv: process.env.NODE_ENV,
        redisHost: process.env.REDIS_HOST || 'localhost',
        pid: process.pid,
    });
    try {
        await notificationQueue.startProcessing();
        logger.info('[NotificationWorker] Worker started successfully', {
            pid: process.pid,
        });
        setInterval(async () => {
            try {
                const health = await metricsCollector.checkHealth();
                if (!health.healthy) {
                    logger.warn('[NotificationWorker] Health check warning', {
                        deliveryRate: health.deliveryRate,
                        queueDepth: health.queueDepth,
                    });
                }
            }
            catch (error) {
                const err = error;
                logger.error('[NotificationWorker] Health check failed', {
                    error: err.message,
                });
            }
        }, HEALTH_CHECK_INTERVAL);
        setInterval(async () => {
            try {
                const metrics = await metricsCollector.collectMetrics(1);
                logger.info('[NotificationWorker] Metrics snapshot', {
                    deliveryRate: `${metrics.deliveryRate}%`,
                    queueDepth: metrics.queueDepth,
                    totalSent: metrics.totalSent,
                    totalDelivered: metrics.totalDelivered,
                    totalFailed: metrics.totalFailed,
                    avgLatency: `${metrics.avgLatency}ms`,
                });
            }
            catch (error) {
                const err = error;
                logger.error('[NotificationWorker] Metrics collection failed', {
                    error: err.message,
                });
            }
        }, METRICS_COLLECTION_INTERVAL);
    }
    catch (error) {
        const err = error;
        logger.error('[NotificationWorker] Failed to start worker', {
            error: err.message,
            stack: err.stack,
        });
        process.exit(1);
    }
}
async function gracefulShutdown(signal) {
    logger.info(`[NotificationWorker] Received ${signal}, shutting down gracefully...`);
    try {
        await notificationQueue.shutdown();
        logger.info('[NotificationWorker] Worker shut down successfully');
        process.exit(0);
    }
    catch (error) {
        const err = error;
        logger.error('[NotificationWorker] Error during shutdown', {
            error: err.message,
        });
        process.exit(1);
    }
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (error) => {
    logger.error('[NotificationWorker] Uncaught exception', {
        error: error.message,
        stack: error.stack,
    });
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    logger.error('[NotificationWorker] Unhandled rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
    });
});
startWorker();
