/**
 * @file Notification Worker
 * @description Standalone worker process for notification queue processing
 *
 * This worker runs independently from the main API server and handles:
 * 1. Processing notification jobs from Redis queue
 * 2. Sending push notifications (FCM/APNs)
 * 3. Sending emails (SendGrid)
 * 4. Sending SMS/WhatsApp (Twilio)
 * 5. Updating delivery status in database
 *
 * Deployment:
 * - Run as separate ECS task/container
 * - Scale horizontally based on queue depth
 * - Auto-restart on failure
 *
 * Usage:
 *   npm run workers        # Development
 *   npm run workers:prod   # Production
 *
 * @author AgroBridge Engineering Team
 */

import { notificationQueue } from '../queue/NotificationQueue.js';
import { metricsCollector } from '../monitoring/MetricsCollector.js';
import logger from '../../../shared/utils/logger.js';

// Constants
const HEALTH_CHECK_INTERVAL = 60000; // 1 minute
const METRICS_COLLECTION_INTERVAL = 300000; // 5 minutes

/**
 * Start the notification worker
 */
async function startWorker(): Promise<void> {
  logger.info('[NotificationWorker] Starting notification worker...', {
    nodeEnv: process.env.NODE_ENV,
    redisHost: process.env.REDIS_HOST || 'localhost',
    pid: process.pid,
  });

  try {
    // Start queue processing
    await notificationQueue.startProcessing();

    logger.info('[NotificationWorker] Worker started successfully', {
      pid: process.pid,
    });

    // Start health check interval
    setInterval(async () => {
      try {
        const health = await metricsCollector.checkHealth();

        if (!health.healthy) {
          logger.warn('[NotificationWorker] Health check warning', {
            deliveryRate: health.deliveryRate,
            queueDepth: health.queueDepth,
          });
        }
      } catch (error) {
        const err = error as Error;
        logger.error('[NotificationWorker] Health check failed', {
          error: err.message,
        });
      }
    }, HEALTH_CHECK_INTERVAL);

    // Start metrics collection interval
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
      } catch (error) {
        const err = error as Error;
        logger.error('[NotificationWorker] Metrics collection failed', {
          error: err.message,
        });
      }
    }, METRICS_COLLECTION_INTERVAL);
  } catch (error) {
    const err = error as Error;
    logger.error('[NotificationWorker] Failed to start worker', {
      error: err.message,
      stack: err.stack,
    });
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`[NotificationWorker] Received ${signal}, shutting down gracefully...`);

  try {
    // Stop accepting new jobs and wait for current jobs to complete
    await notificationQueue.shutdown();

    logger.info('[NotificationWorker] Worker shut down successfully');
    process.exit(0);
  } catch (error) {
    const err = error as Error;
    logger.error('[NotificationWorker] Error during shutdown', {
      error: err.message,
    });
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('[NotificationWorker] Uncaught exception', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('[NotificationWorker] Unhandled rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
  });
  // Don't exit - let the worker continue processing
});

// Start the worker
startWorker();
