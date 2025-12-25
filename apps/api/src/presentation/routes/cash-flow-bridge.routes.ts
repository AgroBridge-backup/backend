/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CASH FLOW BRIDGE - COMBINED ROUTES
 * All routes for the Cash Flow Bridge MVP
 *
 * SECURITY:
 * - All routes require authentication
 * - Admin operations require ADMIN/OPERATOR role
 * - Financial operations are rate-limited
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import type { Redis } from 'ioredis';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { createCreditScoreRouter } from '../../modules/cash-flow-bridge/controllers/credit-score.controller.js';
import { createAdvanceRouter } from '../../modules/cash-flow-bridge/controllers/advance.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import logger from '../../shared/utils/logger.js';

// ════════════════════════════════════════════════════════════════════════════════
// RATE LIMITERS FOR FINANCIAL OPERATIONS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Rate limiter for advance calculations
 * Prevents spam of expensive credit score calculations
 */
const advanceCalculationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 calculations per minute
  message: {
    success: false,
    error: 'Rate limit exceeded for advance calculations. Try again in 1 minute.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    const userId = req.user?.userId || req.ip;
    return `advance-calc:${userId}`;
  },
});

/**
 * Rate limiter for advance requests
 * Very strict to prevent duplicate advance creation
 */
const advanceRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 advance requests per hour
  message: {
    success: false,
    error: 'Rate limit exceeded for advance requests. Maximum 5 per hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    const userId = req.user?.userId || req.ip;
    return `advance-request:${userId}`;
  },
  handler: (req: Request, res: Response) => {
    logger.warn(`[RateLimiter] Advance request rate limit exceeded`, {
      ip: req.ip,
      userId: req.user?.userId,
      path: req.path,
    });
    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded for advance requests. Maximum 5 per hour.',
    });
  },
});

/**
 * Rate limiter for financial operations (repayment, disbursement)
 */
const financialOperationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 operations per minute
  message: {
    success: false,
    error: 'Rate limit exceeded for financial operations.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    const userId = req.user?.userId || req.ip;
    return `financial-op:${userId}`;
  },
});

// ════════════════════════════════════════════════════════════════════════════════
// AUTHORIZATION MIDDLEWARE
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Middleware to require admin or operator role
 */
const requireAdminOrOperator = (req: Request, res: Response, next: NextFunction): void => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  // Only ADMIN role exists in schema - use it for all admin operations
  const allowedRoles: UserRole[] = [UserRole.ADMIN];
  if (!allowedRoles.includes(user.role)) {
    logger.warn(`[Authorization] Insufficient permissions`, {
      userId: user.userId,
      role: user.role,
      requiredRoles: allowedRoles,
      path: req.path,
    });
    res.status(403).json({
      success: false,
      error: 'Insufficient permissions. Admin role required.'
    });
    return;
  }

  next();
};

/**
 * Middleware to verify farmer owns the resource or user is admin
 */
const requireFarmerOwnershipOrAdmin = (farmerIdParam: string = 'farmerId') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const farmerId = req.params[farmerIdParam] || req.body?.[farmerIdParam];
    const isAdmin = user.role === UserRole.ADMIN;
    const isOwner = user.producerId === farmerId;

    if (!isAdmin && !isOwner) {
      logger.warn(`[Authorization] Farmer ownership check failed`, {
        userId: user.userId,
        producerId: user.producerId,
        requestedFarmerId: farmerId,
        path: req.path,
      });
      res.status(403).json({
        success: false,
        error: 'You can only access your own resources'
      });
      return;
    }

    next();
  };
};

// ════════════════════════════════════════════════════════════════════════════════
// VALIDATION SCHEMAS
// ════════════════════════════════════════════════════════════════════════════════

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

// ════════════════════════════════════════════════════════════════════════════════
// ORDERS ROUTES
// ════════════════════════════════════════════════════════════════════════════════

function createOrdersRouter(prisma: PrismaClient): Router {
  const router = Router();

  /**
   * GET /orders/farmer/:farmerId
   * Get orders for a farmer with optional advance eligibility filter
   */
  router.get('/farmer/:farmerId', async (req: Request, res: Response) => {
    try {
      const { farmerId } = req.params;
      const { advanceEligible, status } = req.query;

      const where: Record<string, unknown> = { producerId: farmerId };

      if (advanceEligible === 'true') {
        where.advanceEligible = true;
      }

      if (status) {
        where.status = status;
      }

      const orders = await prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          advanceContract: {
            select: {
              id: true,
              status: true,
              advanceAmount: true,
            },
          },
        },
      });

      res.json({
        success: true,
        data: orders.map(order => ({
          ...order,
          totalAmount: Number(order.totalAmount),
          quantity: Number(order.quantity),
          unitPrice: Number(order.unitPrice),
        })),
      });
    } catch (error) {
      console.error('Error fetching orders:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  /**
   * GET /orders/:orderId
   * Get a single order by ID
   */
  router.get('/:orderId', async (req: Request, res: Response) => {
    try {
      const { orderId } = req.params;

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          producer: {
            include: {
              creditScore: true,
            },
          },
          advanceContract: true,
        },
      });

      if (!order) {
        res.status(404).json({ success: false, error: 'Order not found' });
        return;
      }

      res.json({
        success: true,
        data: {
          ...order,
          totalAmount: Number(order.totalAmount),
          quantity: Number(order.quantity),
          unitPrice: Number(order.unitPrice),
        },
      });
    } catch (error) {
      console.error('Error fetching order:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  /**
   * PATCH /orders/:orderId/mark-advance-eligible
   * Mark an order as eligible for advance
   */
  router.patch('/:orderId/mark-advance-eligible', async (req: Request, res: Response) => {
    try {
      const { orderId } = req.params;

      const order = await prisma.order.update({
        where: { id: orderId },
        data: { advanceEligible: true },
      });

      res.json({
        success: true,
        data: order,
        message: 'Order marked as advance eligible',
      });
    } catch (error) {
      console.error('Error updating order:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  return router;
}

// ════════════════════════════════════════════════════════════════════════════════
// LIQUIDITY POOL ROUTES
// ════════════════════════════════════════════════════════════════════════════════

function createLiquidityPoolRouter(prisma: PrismaClient): Router {
  const router = Router();

  /**
   * GET /liquidity-pools
   * List all liquidity pools
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const pools = await prisma.liquidityPool.findMany({
        orderBy: { createdAt: 'desc' },
      });

      res.json({
        success: true,
        data: pools.map(pool => ({
          ...pool,
          totalCapital: Number(pool.totalCapital),
          availableCapital: Number(pool.availableCapital),
          deployedCapital: Number(pool.deployedCapital),
          reservedCapital: Number(pool.reservedCapital),
          targetReturnRate: Number(pool.targetReturnRate),
          actualReturnRate: Number(pool.actualReturnRate),
          utilizationRate: Number(pool.totalCapital) > 0
            ? Number(((Number(pool.deployedCapital) / Number(pool.totalCapital)) * 100).toFixed(2))
            : 0,
        })),
      });
    } catch (error) {
      console.error('Error fetching pools:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  /**
   * GET /liquidity-pools/:poolId
   * Get a single pool by ID
   */
  router.get('/:poolId', async (req: Request, res: Response) => {
    try {
      const { poolId } = req.params;

      const pool = await prisma.liquidityPool.findUnique({
        where: { id: poolId },
        include: {
          advances: {
            select: {
              id: true,
              contractNumber: true,
              status: true,
              advanceAmount: true,
              remainingBalance: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
          _count: {
            select: { advances: true, investors: true },
          },
        },
      });

      if (!pool) {
        res.status(404).json({ success: false, error: 'Pool not found' });
        return;
      }

      res.json({
        success: true,
        data: {
          ...pool,
          totalCapital: Number(pool.totalCapital),
          availableCapital: Number(pool.availableCapital),
          deployedCapital: Number(pool.deployedCapital),
          reservedCapital: Number(pool.reservedCapital),
          targetReturnRate: Number(pool.targetReturnRate),
          actualReturnRate: Number(pool.actualReturnRate),
          utilizationRate: Number(pool.totalCapital) > 0
            ? Number(((Number(pool.deployedCapital) / Number(pool.totalCapital)) * 100).toFixed(2))
            : 0,
        },
      });
    } catch (error) {
      console.error('Error fetching pool:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  /**
   * GET /liquidity-pools/:poolId/metrics
   * Get pool performance metrics
   */
  router.get('/:poolId/metrics', async (req: Request, res: Response) => {
    try {
      const { poolId } = req.params;

      const pool = await prisma.liquidityPool.findUnique({
        where: { id: poolId },
      });

      if (!pool) {
        res.status(404).json({ success: false, error: 'Pool not found' });
        return;
      }

      // Calculate metrics
      const activeAdvances = await prisma.advanceContract.count({
        where: { poolId, status: { in: ['ACTIVE', 'DISBURSED', 'DELIVERY_IN_PROGRESS'] } },
      });

      const completedAdvances = await prisma.advanceContract.count({
        where: { poolId, status: 'COMPLETED' },
      });

      const defaultedAdvances = await prisma.advanceContract.count({
        where: { poolId, status: { in: ['DEFAULTED', 'IN_COLLECTIONS'] } },
      });

      const totalDisbursed = await prisma.advanceContract.aggregate({
        where: { poolId, disbursedAt: { not: null } },
        _sum: { advanceAmount: true },
      });

      const totalRepaid = await prisma.advanceContract.aggregate({
        where: { poolId },
        _sum: { amountRepaid: true },
      });

      res.json({
        success: true,
        data: {
          poolId,
          totalCapital: Number(pool.totalCapital),
          availableCapital: Number(pool.availableCapital),
          deployedCapital: Number(pool.deployedCapital),
          utilizationRate: Number(pool.totalCapital) > 0
            ? Number(((Number(pool.deployedCapital) / Number(pool.totalCapital)) * 100).toFixed(2))
            : 0,
          activeAdvances,
          completedAdvances,
          defaultedAdvances,
          defaultRate: (activeAdvances + completedAdvances + defaultedAdvances) > 0
            ? Number(((defaultedAdvances / (activeAdvances + completedAdvances + defaultedAdvances)) * 100).toFixed(2))
            : 0,
          totalDisbursed: Number(totalDisbursed._sum.advanceAmount || 0),
          totalRepaid: Number(totalRepaid._sum.amountRepaid || 0),
          targetReturnRate: Number(pool.targetReturnRate),
          actualReturnRate: Number(pool.actualReturnRate),
        },
      });
    } catch (error) {
      console.error('Error fetching pool metrics:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  /**
   * GET /liquidity-pools/:poolId/transactions
   * Get pool transaction history
   */
  router.get('/:poolId/transactions', async (req: Request, res: Response) => {
    try {
      const { poolId } = req.params;
      const paginationResult = paginationSchema.safeParse(req.query);

      const { page, limit } = paginationResult.success
        ? paginationResult.data
        : { page: 1, limit: 20 };

      const transactions = await prisma.poolTransaction.findMany({
        where: { poolId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      });

      const total = await prisma.poolTransaction.count({ where: { poolId } });

      res.json({
        success: true,
        data: transactions.map(tx => ({
          ...tx,
          amount: Number(tx.amount),
          balanceBefore: Number(tx.balanceBefore),
          balanceAfter: Number(tx.balanceAfter),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  return router;
}

// ════════════════════════════════════════════════════════════════════════════════
// USERS ROUTE EXTENSION (for getting current user with producer)
// ════════════════════════════════════════════════════════════════════════════════

function createUsersRouter(prisma: PrismaClient): Router {
  const router = Router();

  /**
   * GET /users/me
   * Get current user with producer profile
   */
  router.get('/me', async (req: Request, res: Response) => {
    try {
      // Get user ID from JWT (assumes auth middleware sets req.user)
      const userId = (req as Request & { user?: { userId: string } }).user?.userId;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          producer: {
            include: {
              creditScore: true,
            },
          },
        },
      });

      if (!user) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }

      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          producer: user.producer ? {
            id: user.producer.id,
            businessName: user.producer.businessName,
            state: user.producer.state,
            municipality: user.producer.municipality,
            isWhitelisted: user.producer.isWhitelisted,
            creditScore: user.producer.creditScore ? {
              overallScore: Number(user.producer.creditScore.overallScore),
              riskTier: user.producer.creditScore.riskTier,
              maxAdvanceAmount: Number(user.producer.creditScore.maxAdvanceAmount),
              availableCredit: Number(user.producer.creditScore.availableCredit),
            } : null,
          } : null,
        },
      });
    } catch (error) {
      console.error('Error fetching current user:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  return router;
}

// ════════════════════════════════════════════════════════════════════════════════
// MAIN ROUTER FACTORY
// ════════════════════════════════════════════════════════════════════════════════

export function createCashFlowBridgeRouter(
  prisma: PrismaClient,
  redis?: Redis,
): Router {
  const router = Router();

  // ┌─────────────────────────────────────────────────────────────────────────────┐
  // │ SECURITY: All Cash Flow Bridge routes require authentication               │
  // └─────────────────────────────────────────────────────────────────────────────┘
  router.use(authenticate);

  // Credit Scores - with ownership verification
  router.use('/credit-scores', createCreditScoreRouter(prisma, redis));

  // Advances - with rate limiting and ownership verification
  router.use('/advances', createAdvanceRouter(prisma, redis));

  // Orders - farmers can only access their own orders
  router.use('/orders', createOrdersRouter(prisma));

  // Liquidity Pools - admin only for write operations
  router.use('/liquidity-pools', createLiquidityPoolRouter(prisma));

  // Users extension
  router.use('/users', createUsersRouter(prisma));

  return router;
}

// Export middleware for use in sub-routers
export {
  advanceCalculationLimiter,
  advanceRequestLimiter,
  financialOperationLimiter,
  requireAdminOrOperator,
  requireFarmerOwnershipOrAdmin,
};
