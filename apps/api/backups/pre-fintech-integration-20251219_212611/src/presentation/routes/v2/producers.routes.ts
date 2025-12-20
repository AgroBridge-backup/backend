/**
 * @file Producers V2 Routes
 * @description Enhanced producer endpoints with field selection, filtering, sorting, pagination
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
// GET /api/v2/producers - List producers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route GET /api/v2/producers
 * @description List producers with field selection, filtering, sorting, pagination
 * @access Private (Admin, Auditor)
 */
router.get(
  '/',
  authenticate(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as AuthPayload;

      // Only admins and certifiers can list all producers
      if (user.role !== 'ADMIN' && user.role !== 'CERTIFIER') {
        return res.status(403).json(
          ResponseFormatter.forbidden('Access denied', req.path)
        );
      }

      // Parse query parameters
      const queryOptions = QueryBuilder.parse(req.query);

      // Validate query options
      const validationErrors = QueryBuilder.validate(queryOptions, 'Producer');
      if (validationErrors.length > 0) {
        return res.status(400).json(
          ResponseFormatter.validationError(
            validationErrors.map((msg) => ({ field: 'query', message: msg })),
            req.path
          )
        );
      }

      // Build Prisma query
      const prismaQuery = QueryBuilder.applyToPrismaQuery('Producer', queryOptions);

      // Get total count
      const total = await prisma.producer.count({
        where: prismaQuery.where,
      });

      // Fetch data - use only select OR include, not both
      const producers = await prisma.producer.findMany({
        where: prismaQuery.where,
        ...(prismaQuery.select
          ? { select: prismaQuery.select }
          : prismaQuery.include
          ? { include: prismaQuery.include }
          : {}),
        orderBy: prismaQuery.orderBy || [{ createdAt: 'desc' }],
        skip: prismaQuery.skip,
        take: prismaQuery.take,
      });

      res.json(
        ResponseFormatter.paginated(
          producers,
          total,
          queryOptions.page,
          queryOptions.limit,
          '/api/v2/producers',
          req.query as Record<string, unknown>
        )
      );
    } catch (error) {
      logger.error('[ProducersV2] List error:', error);
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v2/producers/:id - Get single producer
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route GET /api/v2/producers/:id
 * @description Get single producer with field selection
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
      const prismaQuery = QueryBuilder.applyToPrismaQuery('Producer', queryOptions);

      // Fetch producer - use only select OR include, not both
      const producer = await prisma.producer.findUnique({
        where: { id },
        ...(prismaQuery.select
          ? { select: prismaQuery.select }
          : prismaQuery.include
          ? { include: prismaQuery.include }
          : {}),
      });

      if (!producer) {
        return res.status(404).json(
          ResponseFormatter.notFound('Producer', id, req.path)
        );
      }

      // Check access - only admin, auditor, or the producer themselves
      const hasAccess = await checkProducerAccess(user, producer);
      if (!hasAccess) {
        return res.status(403).json(
          ResponseFormatter.forbidden('Access denied to this producer', req.path)
        );
      }

      res.json(ResponseFormatter.success(producer));
    } catch (error) {
      logger.error('[ProducersV2] Get error:', error);
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v2/producers/:id/batches - Get producer's batches
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route GET /api/v2/producers/:id/batches
 * @description Get batches for a specific producer
 * @access Private
 */
router.get(
  '/:id/batches',
  authenticate(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user as AuthPayload;

      // Check producer exists
      const producer = await prisma.producer.findUnique({
        where: { id },
        select: { id: true, userId: true },
      });

      if (!producer) {
        return res.status(404).json(
          ResponseFormatter.notFound('Producer', id, req.path)
        );
      }

      // Check access
      const hasAccess = await checkProducerAccess(user, producer);
      if (!hasAccess) {
        return res.status(403).json(
          ResponseFormatter.forbidden('Access denied', req.path)
        );
      }

      // Parse query options for batches
      const queryOptions = QueryBuilder.parse(req.query);
      const prismaQuery = QueryBuilder.applyToPrismaQuery('Batch', queryOptions);

      // Add producer filter
      prismaQuery.where = {
        ...prismaQuery.where,
        producerId: id,
      };

      // Get total count
      const total = await prisma.batch.count({
        where: prismaQuery.where,
      });

      // Fetch batches
      const batches = await prisma.batch.findMany({
        where: prismaQuery.where,
        select: prismaQuery.select,
        orderBy: prismaQuery.orderBy || [{ createdAt: 'desc' }],
        skip: prismaQuery.skip,
        take: prismaQuery.take,
      });

      res.json(
        ResponseFormatter.paginated(
          batches,
          total,
          queryOptions.page,
          queryOptions.limit,
          `/api/v2/producers/${id}/batches`,
          req.query as Record<string, unknown>
        )
      );
    } catch (error) {
      logger.error('[ProducersV2] Get batches error:', error);
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v2/producers/:id/stats - Get producer statistics
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route GET /api/v2/producers/:id/stats
 * @description Get statistics for a specific producer
 * @access Private
 */
router.get(
  '/:id/stats',
  authenticate(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user as AuthPayload;

      // Check producer exists
      const producer = await prisma.producer.findUnique({
        where: { id },
        select: { id: true, userId: true, businessName: true },
      });

      if (!producer) {
        return res.status(404).json(
          ResponseFormatter.notFound('Producer', id, req.path)
        );
      }

      // Check access
      const hasAccess = await checkProducerAccess(user, producer);
      if (!hasAccess) {
        return res.status(403).json(
          ResponseFormatter.forbidden('Access denied', req.path)
        );
      }

      // Get statistics
      const [
        totalBatches,
        batchesByStatus,
        totalEvents,
        verifiedEvents,
        recentBatches,
      ] = await Promise.all([
        prisma.batch.count({ where: { producerId: id } }),
        prisma.batch.groupBy({
          by: ['status'],
          where: { producerId: id },
          _count: true,
        }),
        prisma.traceabilityEvent.count({
          where: { batch: { producerId: id } },
        }),
        prisma.traceabilityEvent.count({
          where: { batch: { producerId: id }, isVerified: true },
        }),
        prisma.batch.findMany({
          where: { producerId: id },
          select: {
            id: true,
            origin: true,
            variety: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      ]);

      const stats = {
        producer: {
          id: producer.id,
          businessName: producer.businessName,
        },
        batches: {
          total: totalBatches,
          byStatus: batchesByStatus.reduce(
            (acc, item) => ({
              ...acc,
              [item.status]: item._count,
            }),
            {} as Record<string, number>
          ),
        },
        events: {
          total: totalEvents,
          verified: verifiedEvents,
          verificationRate: totalEvents > 0
            ? Math.round((verifiedEvents / totalEvents) * 100)
            : 0,
        },
        recent: {
          batches: recentBatches,
        },
      };

      res.json(ResponseFormatter.success(stats));
    } catch (error) {
      logger.error('[ProducersV2] Get stats error:', error);
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if user has access to producer
 */
async function checkProducerAccess(
  user: AuthPayload,
  producer: { userId?: string }
): Promise<boolean> {
  // Admins and certifiers have access to all
  if (user.role === 'ADMIN' || user.role === 'CERTIFIER') {
    return true;
  }

  // Check if user is the producer
  return producer.userId === user.userId;
}

export { router as producersV2Router };
export default router;
