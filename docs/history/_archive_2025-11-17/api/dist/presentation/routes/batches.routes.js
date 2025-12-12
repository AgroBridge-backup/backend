import { Router } from 'express';
import { z } from 'zod';
import { validateRequest } from '@/presentation/middlewares/validator.middleware';
import { authenticate } from '@/presentation/middlewares/auth.middleware';
import { UserRole } from '@prisma/client';
export function createBatchesRouter(useCases) {
    const batchRoutes = Router();
    const createBatchSchema = z.object({
        body: z.object({
            producerId: z.string().uuid(),
            cropType: z.enum(['AGUACATE_HASS', 'ZARZAMORA', 'FRAMBUESA', 'ARANDANO']),
            variety: z.string(),
            quantity: z.number().positive(),
            harvestDate: z.string().datetime(),
            parcelName: z.string(),
            latitude: z.number().min(-90).max(90),
            longitude: z.number().min(-180).max(180),
        })
    });
    batchRoutes.post('/', authenticate([UserRole.PRODUCER]), validateRequest(createBatchSchema), async (req, res, next) => {
        try {
            const result = await useCases.createBatchUseCase.execute({ ...req.body, userId: req.user.userId });
            res.status(201).json(result);
        }
        catch (error) {
            next(error);
        }
    });
    batchRoutes.get('/:batchNumber', async (req, res, next) => {
        try {
            const result = await useCases.getBatchByNumberUseCase.execute({ batchNumber: req.params.batchNumber });
            res.json(result);
        }
        catch (error) {
            next(error);
        }
    });
    batchRoutes.get('/:batchNumber/qr', async (req, res, next) => {
        try {
            // In a real app, this would fetch the QR from the use case/repo
            const batch = await useCases.getBatchByNumberUseCase.execute({ batchNumber: req.params.batchNumber });
            res.json({ qrCode: batch.qrCode || 'not-generated' });
        }
        catch (error) {
            next(error);
        }
    });
    batchRoutes.get('/:batchNumber/history', async (req, res, next) => {
        try {
            const result = await useCases.getBatchHistoryUseCase.execute({ batchNumber: req.params.batchNumber });
            res.json(result);
        }
        catch (error) {
            next(error);
        }
    });
    return batchRoutes;
}
//# sourceMappingURL=batches.routes.js.map