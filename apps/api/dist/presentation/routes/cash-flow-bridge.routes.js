import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { createCreditScoreRouter } from '../../modules/cash-flow-bridge/controllers/credit-score.controller.js';
import { createAdvanceRouter } from '../../modules/cash-flow-bridge/controllers/advance.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import logger from '../../shared/utils/logger.js';
const advanceCalculationLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: {
        success: false,
        error: 'Rate limit exceeded for advance calculations. Try again in 1 minute.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const userId = req.user?.userId || req.ip;
        return `advance-calc:${userId}`;
    },
});
const advanceRequestLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: {
        success: false,
        error: 'Rate limit exceeded for advance requests. Maximum 5 per hour.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const userId = req.user?.userId || req.ip;
        return `advance-request:${userId}`;
    },
    handler: (req, res) => {
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
const financialOperationLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: {
        success: false,
        error: 'Rate limit exceeded for financial operations.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const userId = req.user?.userId || req.ip;
        return `financial-op:${userId}`;
    },
});
const requireAdminOrOperator = (req, res, next) => {
    const user = req.user;
    if (!user) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
    }
    const allowedRoles = [UserRole.ADMIN];
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
const requireFarmerOwnershipOrAdmin = (farmerIdParam = 'farmerId') => {
    return (req, res, next) => {
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
const paginationSchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});
function createOrdersRouter(prisma) {
    const router = Router();
    router.get('/farmer/:farmerId', async (req, res) => {
        try {
            const { farmerId } = req.params;
            const { advanceEligible, status } = req.query;
            const where = { producerId: farmerId };
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
        }
        catch (error) {
            console.error('Error fetching orders:', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    });
    router.get('/:orderId', async (req, res) => {
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
        }
        catch (error) {
            console.error('Error fetching order:', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    });
    router.patch('/:orderId/mark-advance-eligible', async (req, res) => {
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
        }
        catch (error) {
            console.error('Error updating order:', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    });
    return router;
}
function createLiquidityPoolRouter(prisma) {
    const router = Router();
    router.get('/', async (req, res) => {
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
        }
        catch (error) {
            console.error('Error fetching pools:', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    });
    router.get('/:poolId', async (req, res) => {
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
        }
        catch (error) {
            console.error('Error fetching pool:', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    });
    router.get('/:poolId/metrics', async (req, res) => {
        try {
            const { poolId } = req.params;
            const pool = await prisma.liquidityPool.findUnique({
                where: { id: poolId },
            });
            if (!pool) {
                res.status(404).json({ success: false, error: 'Pool not found' });
                return;
            }
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
        }
        catch (error) {
            console.error('Error fetching pool metrics:', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    });
    router.get('/:poolId/transactions', async (req, res) => {
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
        }
        catch (error) {
            console.error('Error fetching transactions:', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    });
    return router;
}
function createUsersRouter(prisma) {
    const router = Router();
    router.get('/me', async (req, res) => {
        try {
            const userId = req.user?.userId;
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
        }
        catch (error) {
            console.error('Error fetching current user:', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    });
    return router;
}
export function createCashFlowBridgeRouter(prisma, redis) {
    const router = Router();
    router.use(authenticate);
    router.use('/credit-scores', createCreditScoreRouter(prisma, redis));
    router.use('/advances', createAdvanceRouter(prisma, redis));
    router.use('/orders', createOrdersRouter(prisma));
    router.use('/liquidity-pools', createLiquidityPoolRouter(prisma));
    router.use('/users', createUsersRouter(prisma));
    return router;
}
export { advanceCalculationLimiter, advanceRequestLimiter, financialOperationLimiter, requireAdminOrOperator, requireFarmerOwnershipOrAdmin, };
