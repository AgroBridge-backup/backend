import "dotenv/config";
import { createServer } from "http";
import { app } from "./app.js";
import { redisClient } from "./infrastructure/cache/RedisClient.js";
import {
  prisma,
  disconnectPrisma,
} from "./infrastructure/database/prisma/client.js";
import { queueService } from "./infrastructure/queue/index.js";
import { bullBoardSetup } from "./infrastructure/notifications/monitoring/BullBoardSetup.js";
import { webSocketServer } from "./infrastructure/websocket/index.js";
import logger from "./shared/utils/logger.js";
// P1-6 FIX: Validate environment variables on startup
import { validateEnv, getEnv } from "./config/env.js";

// Validate env vars FIRST (exits process if invalid)
const env = validateEnv();
logger.info("✅ Environment variables validated");

const PORT = env.PORT || 4000;

async function startServer() {
  try {
    logger.info("[BOOTSTRAP] Starting server...");
    logger.info(`[BOOTSTRAP] Environment: ${env.NODE_ENV}`);

    // Connect to PostgreSQL
    await prisma.$connect();
    logger.info("[BOOTSTRAP] PostgreSQL connected.");

    // Connect to Redis
    await redisClient.client.ping();
    logger.info("[BOOTSTRAP] Redis connected.");

    // Initialize background job queues
    await queueService.initialize();
    logger.info("[BOOTSTRAP] Queue service initialized.");

    // Re-initialize Bull Board with all queues
    bullBoardSetup.reinitialize();
    logger.info("[BOOTSTRAP] Bull Board dashboard ready at /admin/queues");

    // Create HTTP server for both Express and Socket.IO
    const httpServer = createServer(app);

    // Initialize WebSocket server
    webSocketServer.initialize(httpServer);
    logger.info("[BOOTSTRAP] WebSocket server initialized.");

    httpServer.listen(PORT, () => {
      logger.info(
        `[AgroBridge] Backend is running on port ${PORT} - ${process.env.NODE_ENV || "development"}`,
      );
      logger.info(`[AgroBridge] WebSocket available at ws://localhost:${PORT}`);
    });

    // Graceful shutdown handlers
    const shutdown = async (signal: string) => {
      logger.info(`[SHUTDOWN] Received ${signal}, shutting down gracefully...`);

      // Stop accepting new connections
      httpServer.close(async () => {
        logger.info("[SHUTDOWN] HTTP server closed.");

        try {
          // Shutdown WebSocket server
          await webSocketServer.shutdown();
          logger.info("[SHUTDOWN] WebSocket server stopped.");

          // Shutdown queue service
          await queueService.shutdown();
          logger.info("[SHUTDOWN] Queue service stopped.");

          // Disconnect from database (using singleton cleanup)
          await disconnectPrisma();
          logger.info("[SHUTDOWN] PostgreSQL disconnected.");

          // Disconnect from Redis
          await redisClient.client.quit();
          logger.info("[SHUTDOWN] Redis disconnected.");

          logger.info("[SHUTDOWN] Graceful shutdown complete.");
          process.exit(0);
        } catch (error) {
          logger.error("[SHUTDOWN] Error during shutdown:", error);
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error("[SHUTDOWN] Forced shutdown after timeout.");
        process.exit(1);
      }, 30000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    logger.error("[BOOTSTRAP] Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
