import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validator.middleware.js';
import * as Prisma from '@prisma/client';
import { InsufficientPermissionsError } from '../../shared/errors/InsufficientPermissionsError.js';
export function createProducersRouter(useCases) {
    const router = Router();
    // Schema Definitions
    const listProducersSchema = z.object({
        query: z.object({
            page: z.coerce.number().int().positive().optional().default(1),
            limit: z.coerce.number().int().positive().optional().default(10),
            state: z.string().optional(),
            isWhitelisted: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
        }),
    });
    const producerIdSchema = z.object({
        params: z.object({
            producerId: z.string().uuid(),
        }),
    });
    // Route Definitions
    router.get('/', authenticate([Prisma.UserRole.ADMIN]), validateRequest(listProducersSchema), async (req, res, next) => {
        try {
            const result = await useCases.listProducersUseCase.execute({
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 10,
                state: req.query.state,
                isWhitelisted: req.query.isWhitelisted === 'true' ? true : req.query.isWhitelisted === 'false' ? false : undefined,
            });
            if (!result || result.producers.length === 0) {
                return res.status(200).json({ producers: [], total: 0 });
            }
            res.status(200).json(result);
        }
        catch (error) {
            next(error);
        }
    });
    // Search producers (must be before /:producerId to avoid route conflict)
    router.get('/search', async (req, res, next) => {
        try {
            const result = await useCases.searchProducersUseCase.execute({
                searchQuery: req.query.q || '',
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 20,
                isWhitelisted: req.query.isWhitelisted === 'true' ? true : req.query.isWhitelisted === 'false' ? false : undefined,
                state: req.query.state,
            });
            res.status(200).json(result);
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/:producerId', authenticate([Prisma.UserRole.ADMIN, Prisma.UserRole.PRODUCER]), validateRequest(producerIdSchema), async (req, res, next) => {
        try {
            const { producerId } = req.params;
            if (req.user.role === Prisma.UserRole.PRODUCER && req.user.producerId !== producerId) {
                throw new InsufficientPermissionsError('Producers can only access their own data.');
            }
            const result = await useCases.getProducerByIdUseCase.execute({ producerId });
            res.json(result);
        }
        catch (error) {
            next(error);
        }
    });
    router.post('/:producerId/whitelist', authenticate([Prisma.UserRole.ADMIN]), validateRequest(producerIdSchema), async (req, res, next) => {
        try {
            const result = await useCases.whitelistProducerUseCase.execute({
                producerId: req.params.producerId,
                adminUserId: req.user.userId,
            });
            res.json(result);
        }
        catch (error) {
            next(error);
        }
    });
    router.post('/:producerId/certifications', authenticate([Prisma.UserRole.ADMIN, Prisma.UserRole.CERTIFIER]), 
    // TODO: Add validation schema for certification body
    async (req, res, next) => {
        try {
            const result = await useCases.addCertificationUseCase.execute({
                producerId: req.params.producerId,
                ...req.body
            });
            res.status(201).json(result);
        }
        catch (error) {
            next(error);
        }
    });
    // Get producer statistics
    router.get('/:producerId/stats', async (req, res, next) => {
        try {
            const result = await useCases.getProducerStatsUseCase.execute({
                producerId: req.params.producerId,
            });
            res.status(200).json(result);
        }
        catch (error) {
            next(error);
        }
    });
    // Get producer batches
    router.get('/:producerId/batches', async (req, res, next) => {
        try {
            const result = await useCases.getProducerBatchesUseCase.execute({
                producerId: req.params.producerId,
                status: req.query.status,
                variety: req.query.variety,
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 20,
            });
            res.status(200).json(result);
        }
        catch (error) {
            next(error);
        }
    });
    // Verify/whitelist producer (ADMIN only) - update existing whitelist route
    router.put('/:producerId/verify', authenticate([Prisma.UserRole.ADMIN]), validateRequest(producerIdSchema), async (req, res, next) => {
        try {
            const result = await useCases.verifyProducerUseCase.execute({
                producerId: req.params.producerId,
                verified: req.body.verified !== undefined ? req.body.verified : true,
                adminUserId: req.user.userId,
            });
            res.status(200).json(result);
        }
        catch (error) {
            next(error);
        }
    });
    // Delete producer
    router.delete('/:producerId', authenticate([Prisma.UserRole.ADMIN, Prisma.UserRole.PRODUCER]), validateRequest(producerIdSchema), async (req, res, next) => {
        try {
            await useCases.deleteProducerUseCase.execute({
                producerId: req.params.producerId,
                userId: req.user.userId,
                userRole: req.user.role,
            });
            res.status(200).json({ success: true, message: 'Producer deleted successfully' });
        }
        catch (error) {
            next(error);
        }
    });
    return router;
}
