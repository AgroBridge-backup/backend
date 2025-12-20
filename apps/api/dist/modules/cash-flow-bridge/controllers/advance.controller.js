import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient, UserRole } from '@prisma/client';
import { createAdvanceContractService, AdvanceStatus, PaymentMethod, } from '../services/AdvanceContractService.js';
import { advanceCalculationLimiter, advanceRequestLimiter, financialOperationLimiter, requireAdminOrOperator, requireFarmerOwnershipOrAdmin, } from '../../../presentation/routes/cash-flow-bridge.routes.js';
import logger from '../../../shared/utils/logger.js';
const uuidSchema = z.string().uuid('Invalid UUID format');
const advanceIdParamSchema = z.object({
    advanceId: uuidSchema,
});
const farmerIdParamSchema = z.object({
    farmerId: uuidSchema,
});
const calculateAdvanceSchema = z.object({
    farmerId: uuidSchema,
    orderId: uuidSchema,
    requestedAmount: z.number().positive().optional(),
});
const requestAdvanceSchema = z.object({
    farmerId: uuidSchema,
    orderId: uuidSchema,
    requestedAmount: z.number().positive().optional(),
    disbursementMethod: z.nativeEnum(PaymentMethod).optional(),
    bankAccountId: z.string().optional(),
    notes: z.string().max(1000).optional(),
});
const approveAdvanceSchema = z.object({
    approvedBy: z.string().min(1),
    notes: z.string().max(1000).optional(),
});
const rejectAdvanceSchema = z.object({
    rejectedBy: z.string().min(1),
    reason: z.string().min(1).max(1000),
});
const disburseAdvanceSchema = z.object({
    disbursementReference: z.string().min(1),
    disbursementFee: z.number().min(0).optional(),
});
const repaymentSchema = z.object({
    amount: z.number().positive('Amount must be positive'),
    paymentMethod: z.nativeEnum(PaymentMethod),
    paymentReference: z.string().min(1),
    source: z.enum(['BUYER_PAYMENT', 'FARMER_PAYMENT', 'INSURANCE', 'COLLECTIONS', 'OTHER']),
    notes: z.string().max(1000).optional(),
});
const statusUpdateSchema = z.object({
    status: z.nativeEnum(AdvanceStatus),
    userId: z.string().min(1),
    reason: z.string().max(1000).optional(),
});
const listAdvancesQuerySchema = z.object({
    status: z.string().optional().transform((val) => val ? val.split(',').filter((s) => Object.values(AdvanceStatus).includes(s)) : undefined),
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});
export class AdvanceController {
    advanceService;
    router;
    constructor(prisma, redis) {
        this.advanceService = createAdvanceContractService(prisma, redis);
        this.router = Router();
        this.initializeRoutes();
    }
    initializeRoutes() {
        this.router.post('/calculate', advanceCalculationLimiter, this.validateFarmerOwnership.bind(this), this.calculateAdvance.bind(this));
        this.router.post('/', advanceRequestLimiter, this.validateFarmerOwnership.bind(this), this.requestAdvance.bind(this));
        this.router.get('/:advanceId', this.validateAdvanceId, this.getAdvance.bind(this));
        this.router.get('/farmer/:farmerId', this.validateFarmerId, requireFarmerOwnershipOrAdmin('farmerId'), this.getFarmerAdvances.bind(this));
        this.router.post('/:advanceId/approve', requireAdminOrOperator, financialOperationLimiter, this.validateAdvanceId, this.approveAdvance.bind(this));
        this.router.post('/:advanceId/reject', requireAdminOrOperator, this.validateAdvanceId, this.rejectAdvance.bind(this));
        this.router.post('/:advanceId/disburse', requireAdminOrOperator, financialOperationLimiter, this.validateAdvanceId, this.disburseAdvance.bind(this));
        this.router.post('/:advanceId/repay', financialOperationLimiter, this.validateAdvanceId, this.processRepayment.bind(this));
        this.router.post('/:advanceId/status', requireAdminOrOperator, this.validateAdvanceId, this.updateStatus.bind(this));
        this.router.get('/:advanceId/history', this.validateAdvanceId, this.getStatusHistory.bind(this));
        this.router.post('/:advanceId/default', requireAdminOrOperator, this.validateAdvanceId, this.markAsDefaulted.bind(this));
    }
    validateFarmerOwnership = (req, res, next) => {
        const user = req.user;
        if (!user) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }
        const farmerId = req.body?.farmerId || req.params?.farmerId;
        const isAdmin = user.role === UserRole.ADMIN;
        const isOwner = user.producerId === farmerId;
        if (!isAdmin && !isOwner) {
            logger.warn(`[Authorization] Farmer ownership check failed in advance controller`, {
                userId: user.userId,
                producerId: user.producerId,
                requestedFarmerId: farmerId,
                path: req.path,
            });
            res.status(403).json({
                success: false,
                error: 'You can only request advances for your own account',
            });
            return;
        }
        next();
    };
    validateAdvanceId = (req, res, next) => {
        const result = advanceIdParamSchema.safeParse(req.params);
        if (!result.success) {
            res.status(400).json({
                success: false,
                error: 'Invalid advance ID',
                details: result.error.flatten().fieldErrors,
            });
            return;
        }
        next();
    };
    validateFarmerId = (req, res, next) => {
        const result = farmerIdParamSchema.safeParse(req.params);
        if (!result.success) {
            res.status(400).json({
                success: false,
                error: 'Invalid farmer ID',
                details: result.error.flatten().fieldErrors,
            });
            return;
        }
        next();
    };
    async calculateAdvance(req, res) {
        try {
            const bodyResult = calculateAdvanceSchema.safeParse(req.body);
            if (!bodyResult.success) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid request body',
                    details: bodyResult.error.flatten().fieldErrors,
                });
                return;
            }
            const { farmerId, orderId, requestedAmount } = bodyResult.data;
            const result = await this.advanceService.calculateAdvanceTerms(farmerId, orderId, requestedAmount);
            if (!result.success) {
                res.status(400).json({
                    success: false,
                    error: result.error,
                });
                return;
            }
            res.status(200).json({
                success: true,
                data: result.data,
            });
        }
        catch (error) {
            console.error('Error calculating advance:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
            });
        }
    }
    async requestAdvance(req, res) {
        try {
            const bodyResult = requestAdvanceSchema.safeParse(req.body);
            if (!bodyResult.success) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid request body',
                    details: bodyResult.error.flatten().fieldErrors,
                });
                return;
            }
            const result = await this.advanceService.requestAdvance(bodyResult.data);
            if (!result.success) {
                res.status(400).json({
                    success: false,
                    error: result.error,
                });
                return;
            }
            res.status(201).json({
                success: true,
                data: result.data,
                message: 'Advance request created successfully',
            });
        }
        catch (error) {
            console.error('Error requesting advance:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
            });
        }
    }
    async getAdvance(req, res) {
        try {
            const { advanceId } = req.params;
            const result = await this.advanceService.getAdvanceDetails(advanceId);
            if (!result.success) {
                res.status(404).json({
                    success: false,
                    error: result.error,
                });
                return;
            }
            res.status(200).json({
                success: true,
                data: result.data,
            });
        }
        catch (error) {
            console.error('Error getting advance:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
            });
        }
    }
    async getFarmerAdvances(req, res) {
        try {
            const { farmerId } = req.params;
            const queryResult = listAdvancesQuerySchema.safeParse(req.query);
            const status = queryResult.success ? queryResult.data.status : undefined;
            const result = await this.advanceService.getFarmerAdvances(farmerId, status);
            if (!result.success) {
                res.status(400).json({
                    success: false,
                    error: result.error,
                });
                return;
            }
            res.status(200).json({
                success: true,
                data: result.data,
                count: result.data?.length || 0,
            });
        }
        catch (error) {
            console.error('Error getting farmer advances:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
            });
        }
    }
    async approveAdvance(req, res) {
        try {
            const { advanceId } = req.params;
            const bodyResult = approveAdvanceSchema.safeParse(req.body);
            if (!bodyResult.success) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid request body',
                    details: bodyResult.error.flatten().fieldErrors,
                });
                return;
            }
            const result = await this.advanceService.transitionStatus(advanceId, AdvanceStatus.APPROVED, bodyResult.data.approvedBy, bodyResult.data.notes || 'Manually approved');
            if (!result.success) {
                res.status(400).json({
                    success: false,
                    error: result.error,
                });
                return;
            }
            res.status(200).json({
                success: true,
                data: result.data,
                message: 'Advance approved successfully',
            });
        }
        catch (error) {
            console.error('Error approving advance:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
            });
        }
    }
    async rejectAdvance(req, res) {
        try {
            const { advanceId } = req.params;
            const bodyResult = rejectAdvanceSchema.safeParse(req.body);
            if (!bodyResult.success) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid request body',
                    details: bodyResult.error.flatten().fieldErrors,
                });
                return;
            }
            const result = await this.advanceService.transitionStatus(advanceId, AdvanceStatus.REJECTED, bodyResult.data.rejectedBy, bodyResult.data.reason);
            if (!result.success) {
                res.status(400).json({
                    success: false,
                    error: result.error,
                });
                return;
            }
            res.status(200).json({
                success: true,
                data: result.data,
                message: 'Advance rejected',
            });
        }
        catch (error) {
            console.error('Error rejecting advance:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
            });
        }
    }
    async disburseAdvance(req, res) {
        try {
            const { advanceId } = req.params;
            const bodyResult = disburseAdvanceSchema.safeParse(req.body);
            if (!bodyResult.success) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid request body',
                    details: bodyResult.error.flatten().fieldErrors,
                });
                return;
            }
            const result = await this.advanceService.disburseAdvance(advanceId, bodyResult.data.disbursementReference, bodyResult.data.disbursementFee);
            if (!result.success) {
                res.status(400).json({
                    success: false,
                    error: result.error,
                });
                return;
            }
            res.status(200).json({
                success: true,
                data: result.data,
                message: 'Advance disbursed successfully',
            });
        }
        catch (error) {
            console.error('Error disbursing advance:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
            });
        }
    }
    async processRepayment(req, res) {
        try {
            const { advanceId } = req.params;
            const bodyResult = repaymentSchema.safeParse(req.body);
            if (!bodyResult.success) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid request body',
                    details: bodyResult.error.flatten().fieldErrors,
                });
                return;
            }
            const result = await this.advanceService.processRepayment({
                advanceId,
                ...bodyResult.data,
            });
            if (!result.success) {
                res.status(400).json({
                    success: false,
                    error: result.error,
                });
                return;
            }
            res.status(200).json({
                success: true,
                data: result.data,
                message: result.data?.isFullyRepaid
                    ? 'Advance fully repaid'
                    : 'Partial repayment processed',
            });
        }
        catch (error) {
            console.error('Error processing repayment:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
            });
        }
    }
    async updateStatus(req, res) {
        try {
            const { advanceId } = req.params;
            const bodyResult = statusUpdateSchema.safeParse(req.body);
            if (!bodyResult.success) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid request body',
                    details: bodyResult.error.flatten().fieldErrors,
                });
                return;
            }
            const result = await this.advanceService.transitionStatus(advanceId, bodyResult.data.status, bodyResult.data.userId, bodyResult.data.reason);
            if (!result.success) {
                res.status(400).json({
                    success: false,
                    error: result.error,
                });
                return;
            }
            res.status(200).json({
                success: true,
                data: result.data,
                message: 'Status updated successfully',
            });
        }
        catch (error) {
            console.error('Error updating status:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
            });
        }
    }
    async getStatusHistory(req, res) {
        try {
            const { advanceId } = req.params;
            const prisma = new PrismaClient();
            const history = await prisma.advanceStatusHistory.findMany({
                where: { advanceId },
                orderBy: { createdAt: 'desc' },
            });
            await prisma.$disconnect();
            res.status(200).json({
                success: true,
                data: history,
                count: history.length,
            });
        }
        catch (error) {
            console.error('Error getting status history:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
            });
        }
    }
    async markAsDefaulted(req, res) {
        try {
            const { advanceId } = req.params;
            const { reason, recoveredAmount } = req.body;
            if (!reason || typeof reason !== 'string') {
                res.status(400).json({
                    success: false,
                    error: 'Reason is required',
                });
                return;
            }
            const result = await this.advanceService.markAsDefaulted(advanceId, reason, recoveredAmount || 0);
            if (!result.success) {
                res.status(400).json({
                    success: false,
                    error: result.error,
                });
                return;
            }
            res.status(200).json({
                success: true,
                data: result.data,
                message: 'Advance marked as defaulted',
            });
        }
        catch (error) {
            console.error('Error marking as defaulted:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
            });
        }
    }
}
export function createAdvanceRouter(prisma, redis) {
    const controller = new AdvanceController(prisma, redis);
    return controller.router;
}
