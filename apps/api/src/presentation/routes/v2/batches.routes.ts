/**
 * @file Batches V2 Routes
 * @description Enhanced batch endpoints with field selection, filtering, sorting, pagination
 *
 * Features:
 * - Field selection: ?fields=id,productName,producer.businessName
 * - Filtering: ?filter[status]=harvested&filter[weightKg][gte]=100
 * - Sorting: ?sort=-createdAt,productName
 * - Pagination: ?page=1&limit=20
 * - Search: ?search=organic
 *
 * @author AgroBridge Engineering Team
 */

import { Router, Request, Response, NextFunction } from "express";
import {
  QueryBuilder,
  QueryOptions,
} from "../../../infrastructure/http/QueryBuilder.js";
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

// Cache TTL for list queries (5 minutes)
const LIST_CACHE_TTL = 300;

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v2/batches - List batches with advanced filtering
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route GET /api/v2/batches
 * @description List batches with field selection, filtering, sorting, pagination
 * @access Private
 *
 * @query {string} fields - Comma-separated field names (e.g., id,productName,producer.businessName)
 * @query {object} filter - Filter conditions (e.g., filter[status]=harvested)
 * @query {string} sort - Sort fields with - prefix for desc (e.g., -createdAt,productName)
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 20, max: 100)
 * @query {string} search - Search term
 * @query {string} include - Relations to include (e.g., producer,events)
 */
router.get(
  "/",
  authenticate(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as AuthPayload;

      // Parse query parameters
      const queryOptions = QueryBuilder.parse(req.query);

      // Validate query options
      const validationErrors = QueryBuilder.validate(queryOptions, "Batch");
      if (validationErrors.length > 0) {
        return res.status(400).json(
          ResponseFormatter.validationError(
            validationErrors.map((msg) => ({ field: "query", message: msg })),
            req.path,
          ),
        );
      }

      // Build Prisma query
      const prismaQuery = QueryBuilder.applyToPrismaQuery(
        "Batch",
        queryOptions,
      );

      // Apply role-based filtering
      const roleFilter = await buildRoleBasedFilter(user);
      prismaQuery.where = {
        ...prismaQuery.where,
        ...roleFilter,
      };

      // Try cache for common queries
      const cacheKey = buildCacheKey("batches:list", queryOptions, user);
      const cached = await tryGetFromCache<{ data: unknown[]; total: number }>(
        cacheKey,
      );

      if (cached) {
        logger.debug("[BatchesV2] Cache hit", { cacheKey });
        return res.json(
          ResponseFormatter.paginated(
            cached.data,
            cached.total,
            queryOptions.page,
            queryOptions.limit,
            "/api/v2/batches",
            req.query as Record<string, unknown>,
          ),
        );
      }

      // Get total count (for pagination)
      const total = await prisma.batch.count({
        where: prismaQuery.where,
      });

      // Fetch data - use only select OR include, not both
      const batches = await prisma.batch.findMany({
        where: prismaQuery.where,
        ...(prismaQuery.select
          ? { select: prismaQuery.select }
          : prismaQuery.include
            ? { include: prismaQuery.include }
            : {}),
        orderBy: prismaQuery.orderBy,
        skip: prismaQuery.skip,
        take: prismaQuery.take,
      });

      // Cache the result
      await cacheResult(cacheKey, { data: batches, total }, LIST_CACHE_TTL);

      // Format response
      const response = ResponseFormatter.paginated(
        batches,
        total,
        queryOptions.page,
        queryOptions.limit,
        "/api/v2/batches",
        req.query as Record<string, unknown>,
      );

      logger.debug("[BatchesV2] List request", {
        query: QueryBuilder.getSummary(queryOptions),
        total,
        returned: batches.length,
      });

      res.json(response);
    } catch (error) {
      logger.error("[BatchesV2] List error:", error);
      next(error);
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v2/batches/:id - Get single batch
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route GET /api/v2/batches/:id
 * @description Get single batch with field selection
 * @access Private
 *
 * @param {string} id - Batch ID
 * @query {string} fields - Comma-separated field names
 * @query {string} include - Relations to include
 */
router.get(
  "/:id",
  authenticate(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user as AuthPayload;

      // Parse query parameters
      const queryOptions = QueryBuilder.parse(req.query);

      // Build Prisma query
      const prismaQuery = QueryBuilder.applyToPrismaQuery(
        "Batch",
        queryOptions,
      );

      // Fetch batch - use only select OR include, not both
      const batch = await prisma.batch.findUnique({
        where: { id },
        ...(prismaQuery.select
          ? { select: prismaQuery.select }
          : prismaQuery.include
            ? { include: prismaQuery.include }
            : {}),
      });

      if (!batch) {
        return res
          .status(404)
          .json(ResponseFormatter.notFound("Batch", id, req.path));
      }

      // Check access
      const hasAccess = await checkBatchAccess(user, batch);
      if (!hasAccess) {
        return res
          .status(403)
          .json(
            ResponseFormatter.forbidden(
              "Access denied to this batch",
              req.path,
            ),
          );
      }

      res.json(ResponseFormatter.success(batch));
    } catch (error) {
      logger.error("[BatchesV2] Get error:", error);
      next(error);
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v2/batches/:id/events - Get batch events
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route GET /api/v2/batches/:id/events
 * @description Get events for a specific batch
 * @access Private
 */
router.get(
  "/:id/events",
  authenticate(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user as AuthPayload;

      // Check batch exists and access
      const batch = await prisma.batch.findUnique({
        where: { id },
        select: { id: true, producerId: true },
      });

      if (!batch) {
        return res
          .status(404)
          .json(ResponseFormatter.notFound("Batch", id, req.path));
      }

      const hasAccess = await checkBatchAccess(user, batch);
      if (!hasAccess) {
        return res
          .status(403)
          .json(
            ResponseFormatter.forbidden(
              "Access denied to this batch",
              req.path,
            ),
          );
      }

      // Parse query options for events
      const queryOptions = QueryBuilder.parse(req.query);
      const prismaQuery = QueryBuilder.applyToPrismaQuery(
        "Event",
        queryOptions,
      );

      // Add batch filter
      prismaQuery.where = {
        ...prismaQuery.where,
        batchId: id,
      };

      // Get total count
      const total = await prisma.traceabilityEvent.count({
        where: prismaQuery.where,
      });

      // Fetch events
      const events = await prisma.traceabilityEvent.findMany({
        where: prismaQuery.where,
        select: prismaQuery.select,
        orderBy: prismaQuery.orderBy || [{ timestamp: "asc" }],
        skip: prismaQuery.skip,
        take: prismaQuery.take,
      });

      res.json(
        ResponseFormatter.paginated(
          events,
          total,
          queryOptions.page,
          queryOptions.limit,
          `/api/v2/batches/${id}/events`,
          req.query as Record<string, unknown>,
        ),
      );
    } catch (error) {
      logger.error("[BatchesV2] Get events error:", error);
      next(error);
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v2/batches/:id/timeline - Get batch event timeline
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route GET /api/v2/batches/:id/timeline
 * @description Get chronological timeline of batch events
 * @access Private
 */
router.get(
  "/:id/timeline",
  authenticate(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user as AuthPayload;

      // Check batch exists and access
      const batch = await prisma.batch.findUnique({
        where: { id },
        select: {
          id: true,
          origin: true,
          variety: true,
          status: true,
          producerId: true,
          createdAt: true,
        },
      });

      if (!batch) {
        return res
          .status(404)
          .json(ResponseFormatter.notFound("Batch", id, req.path));
      }

      const hasAccess = await checkBatchAccess(user, batch);
      if (!hasAccess) {
        return res
          .status(403)
          .json(
            ResponseFormatter.forbidden(
              "Access denied to this batch",
              req.path,
            ),
          );
      }

      // Get events ordered by timestamp
      const events = await prisma.traceabilityEvent.findMany({
        where: { batchId: id },
        select: {
          id: true,
          eventType: true,
          timestamp: true,
          locationName: true,
          latitude: true,
          longitude: true,
          temperature: true,
          humidity: true,
          notes: true,
          isVerified: true,
          blockchainTxHash: true,
        },
        orderBy: { timestamp: "asc" },
      });

      // Build timeline
      const timeline = {
        batch: {
          id: batch.id,
          origin: batch.origin,
          variety: batch.variety,
          status: batch.status,
          createdAt: batch.createdAt,
        },
        events: events.map((event, index) => ({
          ...event,
          order: index + 1,
          isFirst: index === 0,
          isLast: index === events.length - 1,
        })),
        summary: {
          totalEvents: events.length,
          verifiedEvents: events.filter((e) => e.isVerified).length,
          firstEvent: events[0]?.timestamp || null,
          lastEvent: events[events.length - 1]?.timestamp || null,
        },
      };

      res.json(ResponseFormatter.success(timeline));
    } catch (error) {
      logger.error("[BatchesV2] Get timeline error:", error);
      next(error);
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build role-based filter for queries
 */
async function buildRoleBasedFilter(
  user: AuthPayload,
): Promise<Record<string, unknown>> {
  // Admins and certifiers see all
  if (user.role === "ADMIN" || user.role === "CERTIFIER") {
    return {};
  }

  // Producers see their own batches
  if (user.role === "PRODUCER") {
    const producer = await prisma.producer.findUnique({
      where: { userId: user.userId },
      select: { id: true },
    });

    if (producer) {
      return { producerId: producer.id };
    }
  }

  // Regular users see batches they created
  return { createdById: user.userId };
}

/**
 * Check if user has access to batch
 */
async function checkBatchAccess(
  user: AuthPayload,
  batch: { producerId?: string },
): Promise<boolean> {
  // Admins and certifiers have access to all
  if (user.role === "ADMIN" || user.role === "CERTIFIER") {
    return true;
  }

  // Check if user is the producer
  if (user.role === "PRODUCER" && batch.producerId) {
    const producer = await prisma.producer.findUnique({
      where: { userId: user.userId },
      select: { id: true },
    });

    return producer?.id === batch.producerId;
  }

  return false;
}

/**
 * Build cache key for query
 */
function buildCacheKey(
  prefix: string,
  options: QueryOptions,
  user: AuthPayload,
): string {
  const parts = [
    prefix,
    `u:${user.userId}`,
    `r:${user.role}`,
    `p:${options.page}`,
    `l:${options.limit}`,
  ];

  if (options.filter) {
    parts.push(`f:${JSON.stringify(options.filter)}`);
  }
  if (options.sort) {
    parts.push(`s:${JSON.stringify(options.sort)}`);
  }
  if (options.search) {
    parts.push(`q:${options.search}`);
  }

  return parts.join(":");
}

/**
 * Try to get data from cache
 */
async function tryGetFromCache<T>(key: string): Promise<T | null> {
  try {
    const cached = await redisClient.client.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch (error) {
    logger.warn("[BatchesV2] Cache read error:", error);
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
    logger.warn("[BatchesV2] Cache write error:", error);
  }
}

export { router as batchesV2Router };
export default router;
