/**
 * @file Analytics V2 Routes
 * @description NEW - Analytics endpoints for usage tracking and statistics
 *
 * Endpoints:
 * - Dashboard statistics
 * - Batch statistics and timeline
 * - Producer statistics
 * - Event distribution
 * - API usage statistics
 *
 * @author AgroBridge Engineering Team
 */

import { Router, Request, Response, NextFunction } from "express";
import { ResponseFormatter } from "../../../infrastructure/http/ResponseFormatter.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { prisma } from "../../../infrastructure/database/prisma/client.js";
import { redisClient } from "../../../infrastructure/cache/RedisClient.js";
import logger from "../../../shared/utils/logger.js";

// Auth payload type matching the middleware
interface AuthPayload {
  userId: string;
  role: string;
  email: string;
  jti: string;
  exp: number;
  producerId?: string;
}

const router = Router();

// Cache TTL for analytics (10 minutes)
const ANALYTICS_CACHE_TTL = 600;

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v2/analytics/dashboard - Dashboard statistics
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route GET /api/v2/analytics/dashboard
 * @description Get overall dashboard statistics based on user role
 * @access Private
 */
router.get(
  "/dashboard",
  authenticate(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as AuthPayload;

      // Try cache
      const cacheKey = `analytics:dashboard:${user.userId}:${user.role}`;
      const cached = await tryGetFromCache(cacheKey);
      if (cached) {
        return res.json(ResponseFormatter.success(cached));
      }

      // Build where clause based on role
      const batchWhere = await buildBatchWhereClause(user);
      const eventWhere = batchWhere ? { batch: batchWhere } : {};

      // Fetch statistics in parallel
      const [
        totalBatches,
        batchesByStatus,
        totalEvents,
        verifiedEvents,
        recentBatches,
        recentEvents,
        producerStats,
      ] = await Promise.all([
        // Total batches
        prisma.batch.count({ where: batchWhere }),

        // Batches by status
        prisma.batch.groupBy({
          by: ["status"],
          where: batchWhere,
          _count: true,
        }),

        // Total events
        prisma.traceabilityEvent.count({ where: eventWhere }),

        // Verified events
        prisma.traceabilityEvent.count({
          where: { ...eventWhere, isVerified: true },
        }),

        // Recent batches
        prisma.batch.findMany({
          where: batchWhere,
          select: {
            id: true,
            origin: true,
            variety: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),

        // Recent events
        prisma.traceabilityEvent.findMany({
          where: eventWhere,
          select: {
            id: true,
            eventType: true,
            timestamp: true,
            batch: {
              select: { id: true, origin: true },
            },
          },
          orderBy: { timestamp: "desc" },
          take: 5,
        }),

        // Producer stats (admin/certifier only)
        user.role === "ADMIN" || user.role === "CERTIFIER"
          ? prisma.producer.count()
          : null,
      ]);

      const stats = {
        batches: {
          total: totalBatches,
          byStatus: batchesByStatus.reduce(
            (acc, item) => ({
              ...acc,
              [item.status]: item._count,
            }),
            {} as Record<string, number>,
          ),
          active: batchesByStatus
            .filter((s) =>
              ["REGISTERED", "IN_TRANSIT", "ARRIVED"].includes(s.status),
            )
            .reduce((sum, s) => sum + s._count, 0),
        },
        events: {
          total: totalEvents,
          verified: verifiedEvents,
          unverified: totalEvents - verifiedEvents,
          verificationRate:
            totalEvents > 0
              ? Math.round((verifiedEvents / totalEvents) * 100)
              : 0,
        },
        producers:
          producerStats !== null ? { total: producerStats } : undefined,
        recent: {
          batches: recentBatches,
          events: recentEvents,
        },
        generatedAt: new Date().toISOString(),
      };

      // Cache result
      await cacheResult(cacheKey, stats, ANALYTICS_CACHE_TTL);

      res.json(ResponseFormatter.success(stats));
    } catch (error) {
      logger.error("[AnalyticsV2] Dashboard error:", error);
      next(error);
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v2/analytics/batches/stats - Batch statistics
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route GET /api/v2/analytics/batches/stats
 * @description Get detailed batch statistics
 * @access Private
 */
router.get(
  "/batches/stats",
  authenticate(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as AuthPayload;
      const batchWhere = await buildBatchWhereClause(user);

      // Fetch statistics
      const [
        totalBatches,
        statusDistribution,
        varietyDistribution,
        weightStats,
        monthlyCreation,
      ] = await Promise.all([
        // Total count
        prisma.batch.count({ where: batchWhere }),

        // Status distribution
        prisma.batch.groupBy({
          by: ["status"],
          where: batchWhere,
          _count: true,
        }),

        // Variety distribution
        prisma.batch.groupBy({
          by: ["variety"],
          where: batchWhere,
          _count: true,
          orderBy: { _count: { variety: "desc" } },
          take: 10,
        }),

        // Weight statistics
        prisma.batch.aggregate({
          where: batchWhere,
          _sum: { weightKg: true },
          _avg: { weightKg: true },
          _min: { weightKg: true },
          _max: { weightKg: true },
        }),

        // Monthly creation (last 12 months)
        getMonthlyBatchCreation(batchWhere),
      ]);

      const stats = {
        total: totalBatches,
        status: {
          distribution: statusDistribution.map((s) => ({
            status: s.status,
            count: s._count,
            percentage:
              totalBatches > 0
                ? Math.round((s._count / totalBatches) * 100)
                : 0,
          })),
        },
        variety: {
          distribution: varietyDistribution.map((v) => ({
            variety: v.variety,
            count: v._count,
          })),
        },
        weight: {
          total: weightStats._sum.weightKg?.toNumber() || 0,
          average:
            Math.round((weightStats._avg.weightKg?.toNumber() || 0) * 100) /
            100,
          min: weightStats._min.weightKg?.toNumber() || 0,
          max: weightStats._max.weightKg?.toNumber() || 0,
        },
        timeline: {
          monthly: monthlyCreation,
        },
      };

      res.json(ResponseFormatter.success(stats));
    } catch (error) {
      logger.error("[AnalyticsV2] Batch stats error:", error);
      next(error);
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v2/analytics/batches/timeline - Batch creation timeline
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route GET /api/v2/analytics/batches/timeline
 * @description Get batch creation timeline for charts
 * @access Private
 *
 * @query {string} period - Time period (7d, 30d, 90d, 1y)
 * @query {string} granularity - Data granularity (day, week, month)
 */
router.get(
  "/batches/timeline",
  authenticate(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as AuthPayload;
      const { period = "30d", granularity = "day" } = req.query;

      // Calculate date range
      const { startDate, endDate } = calculateDateRange(period as string);

      const batchWhere = await buildBatchWhereClause(user);

      // Get batches in date range
      const batches = await prisma.batch.findMany({
        where: {
          ...batchWhere,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          id: true,
          createdAt: true,
          status: true,
        },
        orderBy: { createdAt: "asc" },
      });

      // Aggregate by granularity
      const timeline = aggregateByGranularity(
        batches,
        startDate,
        endDate,
        granularity as string,
      );

      res.json(
        ResponseFormatter.success({
          period,
          granularity,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          timeline,
          total: batches.length,
        }),
      );
    } catch (error) {
      logger.error("[AnalyticsV2] Batch timeline error:", error);
      next(error);
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v2/analytics/producers/stats - Producer statistics
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route GET /api/v2/analytics/producers/stats
 * @description Get producer statistics (Admin/Auditor only)
 * @access Private (Admin, Auditor)
 */
router.get(
  "/producers/stats",
  authenticate(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as AuthPayload;

      // Only admins and certifiers
      if (user.role !== "ADMIN" && user.role !== "CERTIFIER") {
        return res
          .status(403)
          .json(ResponseFormatter.forbidden("Access denied", req.path));
      }

      const [
        totalProducers,
        whitelistedCount,
        producersByBatches,
        newProducersThisMonth,
      ] = await Promise.all([
        // Total count
        prisma.producer.count(),

        // Whitelisted count
        prisma.producer.count({ where: { isWhitelisted: true } }),

        // Top producers by batch count
        prisma.producer.findMany({
          select: {
            id: true,
            businessName: true,
            _count: { select: { batches: true } },
          },
          orderBy: { batches: { _count: "desc" } },
          take: 10,
        }),

        // New producers this month
        prisma.producer.count({
          where: {
            createdAt: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
        }),
      ]);

      const stats = {
        total: totalProducers,
        whitelisted: whitelistedCount,
        notWhitelisted: totalProducers - whitelistedCount,
        whitelistRate:
          totalProducers > 0
            ? Math.round((whitelistedCount / totalProducers) * 100)
            : 0,
        newThisMonth: newProducersThisMonth,
        topByBatches: producersByBatches.map((p) => ({
          id: p.id,
          businessName: p.businessName,
          batchCount: p._count.batches,
        })),
      };

      res.json(ResponseFormatter.success(stats));
    } catch (error) {
      logger.error("[AnalyticsV2] Producer stats error:", error);
      next(error);
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v2/analytics/producers/top - Top producers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route GET /api/v2/analytics/producers/top
 * @description Get top producers by various metrics
 * @access Private (Admin, Auditor)
 */
router.get(
  "/producers/top",
  authenticate(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as AuthPayload;
      const { metric = "batches", limit = "10" } = req.query;

      // Only admins and certifiers
      if (user.role !== "ADMIN" && user.role !== "CERTIFIER") {
        return res
          .status(403)
          .json(ResponseFormatter.forbidden("Access denied", req.path));
      }

      const take = Math.min(parseInt(String(limit)), 50);

      let topProducers;

      switch (metric) {
        case "batches":
          topProducers = await prisma.producer.findMany({
            select: {
              id: true,
              businessName: true,
              isWhitelisted: true,
              _count: { select: { batches: true } },
            },
            orderBy: { batches: { _count: "desc" } },
            take,
          });
          break;

        case "events":
          // Get producers with most events across their batches
          const producersWithEvents = await prisma.producer.findMany({
            select: {
              id: true,
              businessName: true,
              isWhitelisted: true,
              batches: {
                select: {
                  _count: { select: { events: true } },
                },
              },
            },
          });

          topProducers = producersWithEvents
            .map((p) => ({
              id: p.id,
              businessName: p.businessName,
              isWhitelisted: p.isWhitelisted,
              eventCount: p.batches.reduce(
                (sum, b) => sum + b._count.events,
                0,
              ),
            }))
            .sort((a, b) => b.eventCount - a.eventCount)
            .slice(0, take);
          break;

        default:
          return res
            .status(400)
            .json(
              ResponseFormatter.badRequest(
                `Invalid metric: ${metric}. Valid options: batches, events`,
                undefined,
                req.path,
              ),
            );
      }

      res.json(
        ResponseFormatter.success({
          metric,
          producers: topProducers,
        }),
      );
    } catch (error) {
      logger.error("[AnalyticsV2] Top producers error:", error);
      next(error);
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v2/analytics/events/distribution - Event distribution
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route GET /api/v2/analytics/events/distribution
 * @description Get event type distribution
 * @access Private
 */
router.get(
  "/events/distribution",
  authenticate(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as AuthPayload;
      const batchWhere = await buildBatchWhereClause(user);
      const eventWhere = batchWhere ? { batch: batchWhere } : {};

      const [totalEvents, typeDistribution, verificationStats, locationStats] =
        await Promise.all([
          // Total
          prisma.traceabilityEvent.count({ where: eventWhere }),

          // By type
          prisma.traceabilityEvent.groupBy({
            by: ["eventType"],
            where: eventWhere,
            _count: true,
          }),

          // Verification stats
          prisma.traceabilityEvent.groupBy({
            by: ["isVerified"],
            where: eventWhere,
            _count: true,
          }),

          // Events with location - latitude/longitude are required, so just count all
          prisma.traceabilityEvent.count({ where: eventWhere }),
        ]);

      const verified = verificationStats.find((v) => v.isVerified)?._count || 0;
      const unverified =
        verificationStats.find((v) => !v.isVerified)?._count || 0;

      const stats = {
        total: totalEvents,
        byType: typeDistribution.map((t) => ({
          eventType: t.eventType,
          count: t._count,
          percentage:
            totalEvents > 0 ? Math.round((t._count / totalEvents) * 100) : 0,
        })),
        verification: {
          verified,
          unverified,
          rate:
            totalEvents > 0 ? Math.round((verified / totalEvents) * 100) : 0,
        },
        location: {
          withLocation: locationStats,
          withoutLocation: totalEvents - locationStats,
          locationRate:
            totalEvents > 0
              ? Math.round((locationStats / totalEvents) * 100)
              : 0,
        },
      };

      res.json(ResponseFormatter.success(stats));
    } catch (error) {
      logger.error("[AnalyticsV2] Events distribution error:", error);
      next(error);
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v2/analytics/overview - Quick overview stats
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route GET /api/v2/analytics/overview
 * @description Get quick overview statistics (lightweight)
 * @access Private
 */
router.get(
  "/overview",
  authenticate(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as AuthPayload;
      const batchWhere = await buildBatchWhereClause(user);

      const [batchCount, eventCount, producerCount] = await Promise.all([
        prisma.batch.count({ where: batchWhere }),
        prisma.traceabilityEvent.count({
          where: batchWhere ? { batch: batchWhere } : {},
        }),
        user.role === "ADMIN" || user.role === "CERTIFIER"
          ? prisma.producer.count()
          : null,
      ]);

      res.json(
        ResponseFormatter.success({
          batches: batchCount,
          events: eventCount,
          producers: producerCount,
        }),
      );
    } catch (error) {
      logger.error("[AnalyticsV2] Overview error:", error);
      next(error);
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build where clause based on user role
 */
async function buildBatchWhereClause(
  user: AuthPayload,
): Promise<Record<string, unknown> | undefined> {
  if (user.role === "ADMIN" || user.role === "CERTIFIER") {
    return undefined;
  }

  if (user.role === "PRODUCER") {
    const producer = await prisma.producer.findUnique({
      where: { userId: user.userId },
      select: { id: true },
    });
    if (producer) {
      return { producerId: producer.id };
    }
  }

  return { createdById: user.userId };
}

/**
 * Calculate date range from period string
 */
function calculateDateRange(period: string): {
  startDate: Date;
  endDate: Date;
} {
  const endDate = new Date();
  const startDate = new Date();

  switch (period) {
    case "7d":
      startDate.setDate(startDate.getDate() - 7);
      break;
    case "30d":
      startDate.setDate(startDate.getDate() - 30);
      break;
    case "90d":
      startDate.setDate(startDate.getDate() - 90);
      break;
    case "1y":
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    default:
      startDate.setDate(startDate.getDate() - 30);
  }

  return { startDate, endDate };
}

/**
 * Aggregate data by granularity
 */
function aggregateByGranularity(
  items: Array<{ createdAt: Date }>,
  startDate: Date,
  endDate: Date,
  granularity: string,
): Array<{ date: string; count: number }> {
  const dateMap = new Map<string, number>();

  // Initialize all dates with 0
  const current = new Date(startDate);
  while (current <= endDate) {
    const key = formatDateKey(current, granularity);
    dateMap.set(key, 0);

    switch (granularity) {
      case "day":
        current.setDate(current.getDate() + 1);
        break;
      case "week":
        current.setDate(current.getDate() + 7);
        break;
      case "month":
        current.setMonth(current.getMonth() + 1);
        break;
      default:
        current.setDate(current.getDate() + 1);
    }
  }

  // Count items
  items.forEach((item) => {
    const key = formatDateKey(item.createdAt, granularity);
    dateMap.set(key, (dateMap.get(key) || 0) + 1);
  });

  // Convert to array
  return Array.from(dateMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Format date key based on granularity
 */
function formatDateKey(date: Date, granularity: string): string {
  const d = new Date(date);

  switch (granularity) {
    case "day":
      return d.toISOString().split("T")[0];
    case "week":
      // Get Monday of the week
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      return d.toISOString().split("T")[0];
    case "month":
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    default:
      return d.toISOString().split("T")[0];
  }
}

/**
 * Get monthly batch creation for last 12 months
 */
async function getMonthlyBatchCreation(
  where?: Record<string, unknown>,
): Promise<Array<{ month: string; count: number }>> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 1);

  const batches = await prisma.batch.findMany({
    where: {
      ...where,
      createdAt: { gte: startDate, lte: endDate },
    },
    select: { createdAt: true },
  });

  return aggregateByGranularity(batches, startDate, endDate, "month").map(
    (item) => ({
      month: item.date,
      count: item.count,
    }),
  );
}

/**
 * Try to get data from cache
 */
async function tryGetFromCache(key: string): Promise<unknown | null> {
  try {
    const cached = await redisClient.client.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    logger.warn("[AnalyticsV2] Cache read error:", error);
  }
  return null;
}

/**
 * Cache result
 */
async function cacheResult(
  key: string,
  data: unknown,
  ttl: number,
): Promise<void> {
  try {
    await redisClient.client.set(key, JSON.stringify(data), "EX", ttl);
  } catch (error) {
    logger.warn("[AnalyticsV2] Cache write error:", error);
  }
}

export { router as analyticsV2Router };
export default router;
