/**
 * @file Events V2 Routes
 * @description Enhanced event endpoints with field selection, filtering, sorting, pagination
 *
 * @author AgroBridge Engineering Team
 */

import { Router, Request, Response, NextFunction } from 'express';
import { QueryBuilder } from '../../../infrastructure/http/QueryBuilder.js';
import { ResponseFormatter } from '../../../infrastructure/http/ResponseFormatter.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { prisma } from '../../../infrastructure/database/prisma/client.js';
import logger from '../../../shared/utils/logger.js';

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

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v2/events - List events
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route GET /api/v2/events
 * @description List events with field selection, filtering, sorting, pagination
 * @access Private
 */
router.get(
  '/',
  authenticate(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as AuthPayload;

      // Parse query parameters
      const queryOptions = QueryBuilder.parse(req.query);

      // Validate query options
      const validationErrors = QueryBuilder.validate(queryOptions, 'Event');
      if (validationErrors.length > 0) {
        return res.status(400).json(
          ResponseFormatter.validationError(
            validationErrors.map((msg) => ({ field: 'query', message: msg })),
            req.path
          )
        );
      }

      // Build Prisma query
      const prismaQuery = QueryBuilder.applyToPrismaQuery('Event', queryOptions);

      // Apply role-based filtering
      const roleFilter = await buildRoleBasedFilter(user);
      if (roleFilter) {
        prismaQuery.where = {
          ...prismaQuery.where,
          batch: roleFilter,
        };
      }

      // Get total count
      const total = await prisma.traceabilityEvent.count({
        where: prismaQuery.where,
      });

      // Fetch data - use only select OR include, not both
      const events = await prisma.traceabilityEvent.findMany({
        where: prismaQuery.where,
        ...(prismaQuery.select
          ? { select: prismaQuery.select }
          : prismaQuery.include
          ? { include: prismaQuery.include }
          : {}),
        orderBy: prismaQuery.orderBy || [{ timestamp: 'desc' }],
        skip: prismaQuery.skip,
        take: prismaQuery.take,
      });

      res.json(
        ResponseFormatter.paginated(
          events,
          total,
          queryOptions.page,
          queryOptions.limit,
          '/api/v2/events',
          req.query as Record<string, unknown>
        )
      );
    } catch (error) {
      logger.error('[EventsV2] List error:', error);
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v2/events/:id - Get single event
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route GET /api/v2/events/:id
 * @description Get single event with field selection
 * @access Private
 */
router.get(
  '/:id',
  authenticate(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user as AuthPayload;

      // Parse query parameters
      const queryOptions = QueryBuilder.parse(req.query);
      const prismaQuery = QueryBuilder.applyToPrismaQuery('Event', queryOptions);

      // Fetch event with batch for access check - use only select OR include, not both
      const event = await prisma.traceabilityEvent.findUnique({
        where: { id },
        include: {
          batch: {
            select: {
              id: true,
              producerId: true,
            },
          },
        },
      });

      if (!event) {
        return res.status(404).json(
          ResponseFormatter.notFound('Event', id, req.path)
        );
      }

      // Check access
      const hasAccess = await checkEventAccess(user, event);
      if (!hasAccess) {
        return res.status(403).json(
          ResponseFormatter.forbidden('Access denied to this event', req.path)
        );
      }

      res.json(ResponseFormatter.success(event));
    } catch (error) {
      logger.error('[EventsV2] Get error:', error);
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v2/events/types - Get event type distribution
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route GET /api/v2/events/types
 * @description Get distribution of events by type
 * @access Private
 */
router.get(
  '/types/distribution',
  authenticate(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as AuthPayload;

      // Build where clause based on role
      let whereClause: Record<string, unknown> = {};

      if (user.role === 'PRODUCER') {
        const producer = await prisma.producer.findUnique({
          where: { userId: user.userId },
          select: { id: true },
        });
        if (producer) {
          whereClause = { batch: { producerId: producer.id } };
        }
      } else if (user.role !== 'ADMIN' && user.role !== 'CERTIFIER') {
        whereClause = { createdById: user.userId };
      }

      // Get distribution
      const distribution = await prisma.traceabilityEvent.groupBy({
        by: ['eventType'],
        where: whereClause,
        _count: true,
      });

      const result = {
        distribution: distribution.map((item) => ({
          eventType: item.eventType,
          count: item._count,
        })),
        total: distribution.reduce((sum, item) => sum + item._count, 0),
      };

      res.json(ResponseFormatter.success(result));
    } catch (error) {
      logger.error('[EventsV2] Get types distribution error:', error);
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v2/events/recent - Get recent events
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route GET /api/v2/events/recent
 * @description Get most recent events
 * @access Private
 */
router.get(
  '/recent/list',
  authenticate(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as AuthPayload;
      const limit = Math.min(parseInt(String(req.query.limit)) || 10, 50);

      // Build where clause based on role
      let whereClause: Record<string, unknown> = {};

      if (user.role === 'PRODUCER') {
        const producer = await prisma.producer.findUnique({
          where: { userId: user.userId },
          select: { id: true },
        });
        if (producer) {
          whereClause = { batch: { producerId: producer.id } };
        }
      } else if (user.role !== 'ADMIN' && user.role !== 'CERTIFIER') {
        whereClause = { createdById: user.userId };
      }

      // Get recent events
      const events = await prisma.traceabilityEvent.findMany({
        where: whereClause,
        select: {
          id: true,
          eventType: true,
          timestamp: true,
          locationName: true,
          isVerified: true,
          batch: {
            select: {
              id: true,
              origin: true,
              variety: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });

      res.json(ResponseFormatter.success({ events, count: events.length }));
    } catch (error) {
      logger.error('[EventsV2] Get recent events error:', error);
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build role-based filter for event queries
 */
async function buildRoleBasedFilter(
  user: AuthPayload
): Promise<Record<string, unknown> | null> {
  // Admins and certifiers see all
  if (user.role === 'ADMIN' || user.role === 'CERTIFIER') {
    return null;
  }

  // Producers see events for their batches
  if (user.role === 'PRODUCER') {
    const producer = await prisma.producer.findUnique({
      where: { userId: user.userId },
      select: { id: true },
    });

    if (producer) {
      return { producerId: producer.id };
    }
  }

  // Regular users see events they created
  return { createdById: user.userId };
}

/**
 * Check if user has access to event
 */
async function checkEventAccess(
  user: AuthPayload,
  event: { createdById?: string; batch?: { producerId?: string; createdById?: string } }
): Promise<boolean> {
  // Admins and certifiers have access to all
  if (user.role === 'ADMIN' || user.role === 'CERTIFIER') {
    return true;
  }

  // Check if user created the event
  if (event.createdById === user.userId) {
    return true;
  }

  // Check if user owns the batch
  if (event.batch) {
    if (event.batch.createdById === user.userId) {
      return true;
    }

    // Check if user is the producer
    if (user.role === 'PRODUCER' && event.batch.producerId) {
      const producer = await prisma.producer.findUnique({
        where: { userId: user.userId },
        select: { id: true },
      });

      return producer?.id === event.batch.producerId;
    }
  }

  return false;
}

export { router as eventsV2Router };
export default router;
