import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validator.middleware.js';
import * as Prisma from '@prisma/client';
export function createEventsRouter(useCases) {
    const router = Router();
    // Schema Definitions
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
    // Route Definitions
    // List all events with filters
    router.get('/', authenticate(), async (req, res, next) => {
        try {
            const result = await useCases.listEventsUseCase.execute({
                eventType: req.query.eventType,
                batchId: req.query.batchId,
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 20,
            });
            res.status(200).json(result);
        }
        catch (error) {
            next(error);
        }
    });
    // Get events for specific batch
    router.get('/batch/:batchId', authenticate(), async (req, res, next) => {
        try {
            const result = await useCases.getBatchEventsUseCase.execute({
                batchId: req.params.batchId,
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 20,
            });
            res.status(200).json(result);
        }
        catch (error) {
            next(error);
        }
    });
    router.post('/', authenticate([Prisma.UserRole.ADMIN, Prisma.UserRole.PRODUCER, Prisma.UserRole.CERTIFIER]), validateRequest(registerEventSchema), async (req, res, next) => {
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
    // Update event
    router.put('/:eventId', authenticate([Prisma.UserRole.ADMIN, Prisma.UserRole.PRODUCER]), async (req, res, next) => {
        try {
            const result = await useCases.updateEventUseCase.execute({
                eventId: req.params.eventId,
                userId: req.user.userId,
                userRole: req.user.role,
                locationName: req.body.locationName,
                latitude: req.body.latitude,
                longitude: req.body.longitude,
                temperature: req.body.temperature,
                humidity: req.body.humidity,
                notes: req.body.notes,
            });
            res.status(200).json(result);
        }
        catch (error) {
            next(error);
        }
    });
    // Delete event
    router.delete('/:eventId', authenticate([Prisma.UserRole.ADMIN]), async (req, res, next) => {
        try {
            await useCases.deleteEventUseCase.execute({
                eventId: req.params.eventId,
                userId: req.user.userId,
                userRole: req.user.role,
            });
            res.status(200).json({ success: true, message: 'Event deleted successfully' });
        }
        catch (error) {
            next(error);
        }
    });
    return router;
}
