import { Router } from 'express';
import { z } from 'zod';
import { validateRequest } from '@/presentation/middlewares/validator.middleware';
import { authenticate } from '@/presentation/middlewares/auth.middleware';
import { UserRole } from '@prisma/client';
export function createEventsRouter(useCases) {
    const eventRoutes = Router();
    const registerEventSchema = z.object({
        body: z.object({
            batchId: z.string().uuid(),
            eventType: z.enum(['HARVEST', 'PROCESSING', 'QUALITY_INSPECTION', 'PACKAGING', 'TRANSPORT_START', 'TRANSPORT_ARRIVAL', 'CUSTOMS_CLEARANCE', 'DELIVERY']),
            latitude: z.number(),
            longitude: z.number(),
            locationName: z.string().optional(),
            temperature: z.number().optional(),
            humidity: z.number().optional(),
            notes: z.string().max(500).optional(),
            photos: z.array(z.instanceof(Buffer)).max(5).optional()
        })
    });
    eventRoutes.post('/', authenticate([UserRole.PRODUCER, UserRole.CERTIFIER]), validateRequest(registerEventSchema), async (req, res, next) => {
        try {
            const result = await useCases.registerEventUseCase.execute({ ...req.body, userId: req.user.userId });
            res.status(201).json(result);
        }
        catch (error) {
            next(error);
        }
    });
    eventRoutes.get('/:eventId', async (req, res, next) => {
        try {
            const result = await useCases.getEventByIdUseCase.execute({ eventId: req.params.eventId });
            res.json(result);
        }
        catch (error) {
            next(error);
        }
    });
    eventRoutes.get('/batch/:batchNumber', async (req, res, next) => {
        try {
            const result = await useCases.getBatchHistoryUseCase.execute({ batchNumber: req.params.batchNumber });
            res.json(result);
        }
        catch (error) {
            next(error);
        }
    });
    return eventRoutes;
}
//# sourceMappingURL=events.routes.js.map