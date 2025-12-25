import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validator.middleware.js';
import { UserRole, TransitStatus } from '@prisma/client';
import { RateLimiterConfig } from '../../infrastructure/http/middleware/rate-limiter.middleware.js';
export function createTransitRouter(useCases) {
    const router = Router();
    const createSessionSchema = z.object({
        body: z.object({
            vehicleId: z.string().optional(),
            originName: z.string().min(1).max(255),
            originLat: z.number().min(-90).max(90),
            originLng: z.number().min(-180).max(180),
            destinationName: z.string().min(1).max(255),
            destinationLat: z.number().min(-90).max(90),
            destinationLng: z.number().min(-180).max(180),
            scheduledDeparture: z.string().datetime().optional(),
            scheduledArrival: z.string().datetime().optional(),
            totalDistanceKm: z.number().positive().optional(),
            maxDeviationKm: z.number().positive().max(50).optional(),
            alertOnDeviation: z.boolean().optional(),
        }),
        params: z.object({
            id: z.string().uuid(),
        }),
    });
    const updateStatusSchema = z.object({
        body: z.object({
            status: z.nativeEnum(TransitStatus),
        }),
        params: z.object({
            sessionId: z.string().uuid(),
        }),
    });
    const addLocationSchema = z.object({
        body: z.object({
            latitude: z.number().min(-90).max(90),
            longitude: z.number().min(-180).max(180),
            altitude: z.number().optional(),
            accuracy: z.number().positive().optional(),
            speed: z.number().min(0).optional(),
            heading: z.number().min(0).max(360).optional(),
            address: z.string().optional(),
        }),
        params: z.object({
            sessionId: z.string().uuid(),
        }),
    });
    const sessionIdSchema = z.object({
        params: z.object({
            sessionId: z.string().uuid(),
        }),
    });
    const batchIdSchema = z.object({
        params: z.object({
            id: z.string().uuid(),
        }),
    });
    router.post('/batches/:id/transit', authenticate([UserRole.DRIVER, UserRole.ADMIN]), RateLimiterConfig.creation(), validateRequest(createSessionSchema), async (req, res, next) => {
        try {
            const session = await useCases.createTransitSessionUseCase.execute({
                batchId: req.params.id,
                driverId: req.user.userId,
                vehicleId: req.body.vehicleId,
                originName: req.body.originName,
                originLat: req.body.originLat,
                originLng: req.body.originLng,
                destinationName: req.body.destinationName,
                destinationLat: req.body.destinationLat,
                destinationLng: req.body.destinationLng,
                scheduledDeparture: req.body.scheduledDeparture ? new Date(req.body.scheduledDeparture) : undefined,
                scheduledArrival: req.body.scheduledArrival ? new Date(req.body.scheduledArrival) : undefined,
                totalDistanceKm: req.body.totalDistanceKm,
                maxDeviationKm: req.body.maxDeviationKm,
                alertOnDeviation: req.body.alertOnDeviation,
            });
            res.status(201).json({
                success: true,
                data: session,
                message: 'Transit session created successfully.',
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/batches/:id/transit', authenticate(), validateRequest(batchIdSchema), async (req, res, next) => {
        try {
            const sessions = await useCases.transitService.getBatchSessions(req.params.id);
            res.status(200).json({
                success: true,
                data: {
                    sessions,
                    count: sessions.length,
                },
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/transit/:sessionId', authenticate(), validateRequest(sessionIdSchema), async (req, res, next) => {
        try {
            const session = await useCases.getTransitSessionUseCase.execute({
                sessionId: req.params.sessionId,
            });
            res.status(200).json({
                success: true,
                data: session,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.patch('/transit/:sessionId/status', authenticate([UserRole.DRIVER, UserRole.ADMIN]), validateRequest(updateStatusSchema), async (req, res, next) => {
        try {
            const session = await useCases.updateTransitStatusUseCase.execute({
                sessionId: req.params.sessionId,
                status: req.body.status,
                userId: req.user.userId,
            });
            res.status(200).json({
                success: true,
                data: session,
                message: `Transit status updated to ${req.body.status}.`,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.post('/transit/:sessionId/start', authenticate([UserRole.DRIVER, UserRole.ADMIN]), validateRequest(sessionIdSchema), async (req, res, next) => {
        try {
            const session = await useCases.transitService.startTransit(req.params.sessionId, req.user.userId);
            res.status(200).json({
                success: true,
                data: session,
                message: 'Transit started.',
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.post('/transit/:sessionId/complete', authenticate([UserRole.DRIVER, UserRole.ADMIN]), validateRequest(sessionIdSchema), async (req, res, next) => {
        try {
            const session = await useCases.transitService.completeTransit(req.params.sessionId, req.user.userId);
            res.status(200).json({
                success: true,
                data: session,
                message: 'Transit completed.',
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.post('/transit/:sessionId/location', authenticate([UserRole.DRIVER, UserRole.ADMIN]), RateLimiterConfig.api(), validateRequest(addLocationSchema), async (req, res, next) => {
        try {
            const result = await useCases.addLocationUpdateUseCase.execute({
                sessionId: req.params.sessionId,
                latitude: req.body.latitude,
                longitude: req.body.longitude,
                altitude: req.body.altitude,
                accuracy: req.body.accuracy,
                speed: req.body.speed,
                heading: req.body.heading,
                address: req.body.address,
            });
            res.status(201).json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/transit/:sessionId/locations', authenticate(), validateRequest(sessionIdSchema), async (req, res, next) => {
        try {
            const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
            const locations = await useCases.getLocationHistoryUseCase.execute({
                sessionId: req.params.sessionId,
                limit,
            });
            res.status(200).json({
                success: true,
                data: {
                    locations,
                    count: locations.length,
                },
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/transit/:sessionId/current-location', authenticate(), validateRequest(sessionIdSchema), async (req, res, next) => {
        try {
            const location = await useCases.transitService.getCurrentLocation(req.params.sessionId);
            res.status(200).json({
                success: true,
                data: location,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/drivers/me/transit', authenticate([UserRole.DRIVER, UserRole.ADMIN]), async (req, res, next) => {
        try {
            const sessions = await useCases.transitService.getDriverActiveSessions(req.user.userId);
            res.status(200).json({
                success: true,
                data: {
                    sessions,
                    count: sessions.length,
                },
            });
        }
        catch (error) {
            next(error);
        }
    });
    return router;
}
