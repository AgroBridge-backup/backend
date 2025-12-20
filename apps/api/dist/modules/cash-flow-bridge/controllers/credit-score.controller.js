import { Router } from 'express';
import { z } from 'zod';
import { createCreditScoringService, } from '../../credit-scoring/services/credit-scoring.service.js';
import { createBlockchainVerifierService, } from '../../credit-scoring/services/blockchain-verifier.service.js';
const producerIdParamSchema = z.object({
    producerId: z.string().uuid('Invalid producer ID format'),
});
const calculateScoreQuerySchema = z.object({
    forceRecalculate: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
    includeDetails: z.enum(['true', 'false']).optional().transform((v) => v !== 'false'),
});
const historyQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(30),
});
const simulationBodySchema = z.object({
    additionalSuccessfulDeliveries: z.number().int().min(0).optional(),
    additionalDefaultedDeliveries: z.number().int().min(0).optional(),
    qualityImprovement: z.number().min(-100).max(100).optional(),
    completedAdvanceRepayments: z.number().int().min(0).optional(),
    additionalBlockchainVerifications: z.number().int().min(0).optional(),
});
const eligibilityQuerySchema = z.object({
    requestedAmount: z.coerce.number().positive('Amount must be positive'),
    orderId: z.string().uuid('Invalid order ID format'),
});
export class CreditScoreController {
    creditScoringService;
    blockchainVerifier;
    router;
    constructor(prisma, redis) {
        this.creditScoringService = createCreditScoringService(prisma, redis);
        this.blockchainVerifier = createBlockchainVerifierService(prisma);
        this.router = Router();
        this.initializeRoutes();
    }
    initializeRoutes() {
        this.router.get('/:producerId', this.validateProducerId, this.getCreditScore.bind(this));
        this.router.post('/:producerId/calculate', this.validateProducerId, this.calculateCreditScore.bind(this));
        this.router.get('/:producerId/history', this.validateProducerId, this.getScoreHistory.bind(this));
        this.router.post('/:producerId/simulate', this.validateProducerId, this.simulateScore.bind(this));
        this.router.get('/:producerId/eligibility', this.validateProducerId, this.checkEligibility.bind(this));
        this.router.post('/:producerId/sync', this.validateProducerId, this.syncBlockchainData.bind(this));
        this.router.get('/:producerId/summary', this.validateProducerId, this.getScoreSummary.bind(this));
    }
    validateProducerId = (req, res, next) => {
        const result = producerIdParamSchema.safeParse(req.params);
        if (!result.success) {
            res.status(400).json({
                success: false,
                error: 'Invalid producer ID',
                details: result.error.flatten().fieldErrors,
            });
            return;
        }
        next();
    };
    async getCreditScore(req, res) {
        try {
            const { producerId } = req.params;
            const queryResult = calculateScoreQuerySchema.safeParse(req.query);
            const forceRecalculate = queryResult.success ? (queryResult.data.forceRecalculate ?? false) : false;
            const includeDetails = queryResult.success ? (queryResult.data.includeDetails ?? true) : true;
            const result = await this.creditScoringService.calculateScore({
                producerId,
                forceRecalculate,
                includeDetails,
            });
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
                cached: result.cached,
                cacheTtl: result.cacheTtl,
            });
        }
        catch (error) {
            console.error('Error getting credit score:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
            });
        }
    }
    async calculateCreditScore(req, res) {
        try {
            const { producerId } = req.params;
            const result = await this.creditScoringService.calculateScore({
                producerId,
                forceRecalculate: true,
                includeDetails: true,
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
                message: 'Credit score recalculated successfully',
            });
        }
        catch (error) {
            console.error('Error calculating credit score:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
            });
        }
    }
    async getScoreHistory(req, res) {
        try {
            const { producerId } = req.params;
            const queryResult = historyQuerySchema.safeParse(req.query);
            if (!queryResult.success) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid query parameters',
                    details: queryResult.error.flatten().fieldErrors,
                });
                return;
            }
            const history = await this.creditScoringService.getScoreHistory(producerId, queryResult.data.limit);
            res.status(200).json({
                success: true,
                data: history,
                count: history.length,
            });
        }
        catch (error) {
            console.error('Error getting score history:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
            });
        }
    }
    async simulateScore(req, res) {
        try {
            const { producerId } = req.params;
            const bodyResult = simulationBodySchema.safeParse(req.body);
            if (!bodyResult.success) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid simulation parameters',
                    details: bodyResult.error.flatten().fieldErrors,
                });
                return;
            }
            const input = {
                producerId,
                changes: bodyResult.data,
            };
            const result = await this.creditScoringService.simulateScore(input);
            if (!result) {
                res.status(404).json({
                    success: false,
                    error: 'Could not simulate score. Producer may not have a credit score yet.',
                });
                return;
            }
            res.status(200).json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            console.error('Error simulating score:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
            });
        }
    }
    async checkEligibility(req, res) {
        try {
            const { producerId } = req.params;
            const queryResult = eligibilityQuerySchema.safeParse(req.query);
            if (!queryResult.success) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid eligibility check parameters',
                    details: queryResult.error.flatten().fieldErrors,
                });
                return;
            }
            const result = await this.creditScoringService.checkEligibility({
                producerId,
                requestedAmount: queryResult.data.requestedAmount,
                orderId: queryResult.data.orderId,
            });
            res.status(200).json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            console.error('Error checking eligibility:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
            });
        }
    }
    async syncBlockchainData(req, res) {
        try {
            const { producerId } = req.params;
            if (!this.blockchainVerifier.isAvailable()) {
                res.status(503).json({
                    success: false,
                    error: 'Blockchain verification service is not available',
                });
                return;
            }
            const result = await this.blockchainVerifier.syncBlockchainData(producerId);
            await this.creditScoringService.invalidateCache(producerId);
            res.status(200).json({
                success: true,
                data: {
                    recordsSynced: result.synced,
                    errors: result.errors,
                    message: `Synced ${result.synced} blockchain records`,
                },
            });
        }
        catch (error) {
            console.error('Error syncing blockchain data:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
            });
        }
    }
    async getScoreSummary(req, res) {
        try {
            const { producerId } = req.params;
            const summary = await this.creditScoringService.getScoreSummary(producerId);
            if (!summary) {
                res.status(404).json({
                    success: false,
                    error: 'Credit score not found for this producer',
                });
                return;
            }
            res.status(200).json({
                success: true,
                data: summary,
            });
        }
        catch (error) {
            console.error('Error getting score summary:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
            });
        }
    }
}
export function createCreditScoreRouter(prisma, redis) {
    const controller = new CreditScoreController(prisma, redis);
    return controller.router;
}
