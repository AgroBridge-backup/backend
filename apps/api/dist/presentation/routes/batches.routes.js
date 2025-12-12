import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validator.middleware.js';
import * as Prisma from '@prisma/client';
export function createBatchesRouter(useCases) {
    const router = Router();
    // Schema Definitions
    const createBatchSchema = z.object({
        body: z.object({
            // producerId will come from the authenticated user, not the body
            cropType: z.string(),
            variety: z.string(),
            quantity: z.number().positive(),
            harvestDate: z.coerce.date(),
            parcelName: z.string(),
            latitude: z.number().min(-90).max(90),
            longitude: z.number().min(-180).max(180),
        }),
    });
    // Route Definitions
    router.post('/', authenticate([Prisma.UserRole.PRODUCER]), validateRequest(createBatchSchema), async (req, res, next) => {
        try {
            const producerId = req.user?.producerId;
            if (!producerId) {
                // This check is correct, if token is valid but has no producerId, it's a client error
                return res.status(403).json({ message: 'User is not a producer or producer ID is missing.' });
            }
            const result = await useCases.createBatchUseCase.execute({ ...req.body, producerId });
            if (!result || !result.id) {
                return res.status(400).json({ error: "Batch creation failed, use case returned invalid data." });
            }
            res.status(201).json(result);
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/:id', authenticate(), async (req, res, next) => {
        try {
            const result = await useCases.getBatchByIdUseCase.execute({ id: req.params.id });
            if (!result) {
                return res.status(404).json({ error: "Batch not found" });
            }
            res.status(200).json(result);
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/by-number/:batchNumber', authenticate(), async (req, res, next) => {
        try {
            const result = await useCases.getBatchByNumberUseCase.execute({ batchNumber: req.params.batchNumber });
            res.status(200).json(result);
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/:id/history', authenticate(), async (req, res, next) => {
        try {
            const result = await useCases.getBatchHistoryUseCase.execute({ id: req.params.id });
            res.status(200).json(result);
        }
        catch (error) {
            next(error);
        }
    });
    // Get batch timeline (all events for batch)
    router.get('/:id/timeline', async (req, res, next) => {
        try {
            const result = await useCases.getBatchTimelineUseCase.execute({ batchId: req.params.id });
            res.status(200).json(result);
        }
        catch (error) {
            next(error);
        }
    });
    // Update batch status
    router.put('/:id/status', authenticate([Prisma.UserRole.ADMIN, Prisma.UserRole.PRODUCER]), async (req, res, next) => {
        try {
            const result = await useCases.updateBatchStatusUseCase.execute({
                batchId: req.params.id,
                newStatus: req.body.status,
                userId: req.user.userId,
                reason: req.body.reason,
            });
            res.status(200).json(result);
        }
        catch (error) {
            next(error);
        }
    });
    // Generate QR code for batch
    router.post('/:id/qr-code', authenticate([Prisma.UserRole.ADMIN, Prisma.UserRole.PRODUCER]), async (req, res, next) => {
        try {
            const result = await useCases.generateQrCodeUseCase.execute({ batchId: req.params.id });
            res.status(200).json(result);
        }
        catch (error) {
            next(error);
        }
    });
    // Delete batch
    router.delete('/:id', authenticate([Prisma.UserRole.ADMIN, Prisma.UserRole.PRODUCER]), async (req, res, next) => {
        try {
            await useCases.deleteBatchUseCase.execute({
                batchId: req.params.id,
                userId: req.user.userId,
                userRole: req.user.role,
            });
            res.status(200).json({ success: true, message: 'Batch deleted successfully' });
        }
        catch (error) {
            next(error);
        }
    });
    return router;
}
