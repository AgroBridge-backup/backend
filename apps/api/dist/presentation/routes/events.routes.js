import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validator.middleware.js';
import * as Prisma from '@prisma/client';
import { RateLimiterConfig } from '../../infrastructure/http/middleware/rate-limiter.middleware.js';
export function createEventsRouter(useCases) {
    const router = Router();
    const registerEventSchema = z.object({
        body: z.object({
            batchId: z.string().uuid(),
            eventType: z.nativeEnum(Prisma.EventType),
            latitude: z.number(),
            longitude: z.number(),
            locationName: z.string().optional(),
            temperature: z.number().optional(),
            humidity: z.number().optional(),
            notes: z.string().max(500).optional(),
        }),
    });
    router.post('/', authenticate([Prisma.UserRole.ADMIN, Prisma.UserRole.PRODUCER, Prisma.UserRole.CERTIFIER]), RateLimiterConfig.creation(), validateRequest(registerEventSchema), async (req, res, next) => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(403).json({ message: 'User ID is missing from token.' });
            }
            const result = await useCases.registerEventUseCase.execute({ ...req.body, userId });
            res.status(201).json(result);
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/:eventId', authenticate(), async (req, res, next) => {
        try {
            const result = await useCases.getEventByIdUseCase.execute({ eventId: req.params.eventId });
            res.status(200).json(result);
        }
        catch (error) {
            next(error);
        }
    });
    return router;
}
