import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../../shared/utils/logger.js';
import { redisCacheService, type CacheHealth, type CacheStats } from '../../infrastructure/cache/index.js';

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  latency?: number;
  error?: string;
}

/**
 * Health Check Controller
 * Provides Kubernetes-compatible health endpoints for probing and monitoring
 */
export class HealthController {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * GET /health
   * Basic liveness probe - responds quickly without external checks
   * Used by Kubernetes to determine if the container is alive
   */
  async liveness(_req: Request, res: Response): Promise<void> {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '2.0.0',
      service: 'agrobridge-api',
    });
  }

  /**
   * GET /health/ready
   * Readiness probe - verifies all external dependencies are available
   * Used by Kubernetes to determine if traffic should be routed to this instance
   */
  async readiness(_req: Request, res: Response): Promise<void> {
    const checks: Record<string, HealthCheckResult> = {};

    // Check database
    checks.database = await this.checkDatabase();

    // Check Redis connection with actual health check
    checks.redis = await this.checkRedis();

    // Determine overall status
    const isReady = Object.values(checks).every((check) => check.status === 'healthy');

    res.status(isReady ? 200 : 503).json({
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks,
    });
  }

  /**
   * GET /health/startup
   * Startup probe - verifies the application has fully initialized
   * Used by Kubernetes to know when the container has started
   */
  async startup(_req: Request, res: Response): Promise<void> {
    try {
      // Verify database is connected
      const dbCheck = await this.checkDatabase();

      if (dbCheck.status === 'healthy') {
        res.status(200).json({
          status: 'started',
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(503).json({
          status: 'starting',
          timestamp: new Date().toISOString(),
          error: 'Database not ready',
        });
      }
    } catch (error) {
      res.status(503).json({
        status: 'starting',
        timestamp: new Date().toISOString(),
        error: 'Initialization in progress',
      });
    }
  }

  /**
   * GET /health/metrics
   * Basic metrics endpoint for Prometheus/CloudWatch scraping
   * Returns memory, CPU, and event loop metrics
   */
  async metrics(_req: Request, res: Response): Promise<void> {
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

  /**
   * Check database connectivity with latency measurement
   */
  private async checkDatabase(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        latency: Date.now() - startTime,
      };
    } catch (error) {
      logger.error(`[HealthCheck] Database check failed: ${error}`);
      return {
        status: 'unhealthy',
        latency: Date.now() - startTime,
        error: 'Database connection failed',
      };
    }
  }

  /**
   * Check Redis connectivity with actual ping and latency measurement
   */
  private async checkRedis(): Promise<HealthCheckResult> {
    try {
      const health: CacheHealth = await redisCacheService.healthCheck();
      return {
        status: health.status === 'healthy' ? 'healthy' : health.status === 'degraded' ? 'degraded' : 'unhealthy',
        latency: health.latencyMs,
        error: health.errorMessage,
      };
    } catch (error) {
      logger.error(`[HealthCheck] Redis check failed: ${error}`);
      return {
        status: 'unhealthy',
        error: 'Redis connection failed',
      };
    }
  }

  /**
   * GET /health/cache
   * Cache-specific health endpoint with detailed statistics
   */
  async cacheStats(_req: Request, res: Response): Promise<void> {
    try {
      const health: CacheHealth = await redisCacheService.healthCheck();
      const stats: CacheStats = await redisCacheService.getStats();

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
    } catch (error) {
      logger.error(`[HealthCheck] Cache stats failed: ${error}`);
      res.status(503).json({
        status: 'unhealthy',
        error: 'Failed to retrieve cache statistics',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
