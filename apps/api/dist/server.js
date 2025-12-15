import 'dotenv/config';
import { app } from './app.js';
import { redisClient } from './infrastructure/cache/RedisClient.js';
import { prisma } from './infrastructure/database/prisma/client.js';
import { queueService } from './infrastructure/queue/index.js';
import { bullBoardSetup } from './infrastructure/notifications/monitoring/BullBoardSetup.js';
import logger from './shared/utils/logger.js';
const PORT = process.env.PORT || 4000;
async function startServer() {
    try {
        logger.info('[BOOTSTRAP] Starting server...');
        await prisma.$connect();
        logger.info('[BOOTSTRAP] PostgreSQL connected.');
        await redisClient.client.ping();
        logger.info('[BOOTSTRAP] Redis connected.');
        await queueService.initialize();
        logger.info('[BOOTSTRAP] Queue service initialized.');
        bullBoardSetup.reinitialize();
        logger.info('[BOOTSTRAP] Bull Board dashboard ready at /admin/queues');
        const server = app.listen(PORT, () => {
            logger.info(`[AgroBridge] Backend is running on port ${PORT} - ${process.env.NODE_ENV || 'development'}`);
        });
        const shutdown = async (signal) => {
            logger.info(`[SHUTDOWN] Received ${signal}, shutting down gracefully...`);
            server.close(async () => {
                logger.info('[SHUTDOWN] HTTP server closed.');
                try {
                    await queueService.shutdown();
                    logger.info('[SHUTDOWN] Queue service stopped.');
                    await prisma.$disconnect();
                    logger.info('[SHUTDOWN] PostgreSQL disconnected.');
                    await redisClient.client.quit();
                    logger.info('[SHUTDOWN] Redis disconnected.');
                    logger.info('[SHUTDOWN] Graceful shutdown complete.');
                    process.exit(0);
                }
                catch (error) {
                    logger.error('[SHUTDOWN] Error during shutdown:', error);
                    process.exit(1);
                }
            });
            setTimeout(() => {
                logger.error('[SHUTDOWN] Forced shutdown after timeout.');
                process.exit(1);
            }, 30000);
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }
    catch (error) {
        logger.error('[BOOTSTRAP] Failed to start server:', error);
        process.exit(1);
    }
}
startServer();
