import 'dotenv/config';
import { app } from './app.js';
import { redisClient } from './infrastructure/cache/RedisClient.js';
import { prisma } from './infrastructure/database/prisma/client.js';
import logger from './shared/utils/logger.js';

const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    logger.info('[BOOTSTRAP] Starting server...');
    await prisma.$connect();
    logger.info('[BOOTSTRAP] PostgreSQL connected.');
    await redisClient.client.ping();
    logger.info('[BOOTSTRAP] Redis connected.');

    app.listen(PORT, () => {
      logger.info(`[AgroBridge] Backend is running on port ${PORT} - ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('[BOOTSTRAP] Failed to start server:', error);
    process.exit(1);
  }
}

startServer();