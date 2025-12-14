import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validator.middleware.js';
import * as Prisma from '@prisma/client';
import { InsufficientPermissionsError } from '../../shared/errors/InsufficientPermissionsError.js';
import { RateLimiterConfig } from '../../infrastructure/http/middleware/rate-limiter.middleware.js';
export function createProducersRouter(useCases) {
    const router = Router();
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
    router.get('/', authenticate([Prisma.UserRole.ADMIN]), validateRequest(listProducersSchema), async (req, res, next) => {
        try {
            const result = await useCases.listProducersUseCase.execute(req.query);
            if (!result || result.producers.length === 0) {
                return res.status(200).json({ producers: [], total: 0 });
            }
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
    router.post('/:producerId/whitelist', authenticate([Prisma.UserRole.ADMIN]), RateLimiterConfig.sensitive(), validateRequest(producerIdSchema), async (req, res, next) => {
        try {
            const result = await useCases.whitelistProducerUseCase.execute({ producerId: req.params.producerId });
            res.json(result);
        }
        catch (error) {
            next(error);
        }
    });
    router.post('/:producerId/certifications', authenticate([Prisma.UserRole.ADMIN, Prisma.UserRole.CERTIFIER]), async (req, res, next) => {
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
    return router;
}
