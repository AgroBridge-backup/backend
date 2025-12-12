import { Router } from 'express';
import { z } from 'zod';
import { validateRequest } from '@/presentation/middlewares/validator.middleware';
import { authenticate } from '@/presentation/middlewares/auth.middleware';
import { UserRole } from '@prisma/client';
import { InsufficientPermissionsError } from '@/shared/errors/InsufficientPermissionsError';
export function createProducersRouter(useCases) {
    const producerRoutes = Router();
    producerRoutes.get('/', authenticate([UserRole.ADMIN]), async (req, res, next) => {
        try {
            const result = await useCases.listProducersUseCase.execute(req.query);
            res.json(result);
        }
        catch (error) {
            next(error);
        }
    });
    producerRoutes.get('/:producerId', authenticate([UserRole.ADMIN, UserRole.PRODUCER]), async (req, res, next) => {
        try {
            // Add logic to check if PRODUCER is accessing their own data
            if (req.user.role === UserRole.PRODUCER && req.user.userId !== req.params.producerId) {
                throw new InsufficientPermissionsError('Producers can only access their own data');
            }
            const result = await useCases.getProducerByIdUseCase.execute({ producerId: req.params.producerId });
            res.json(result);
        }
        catch (error) {
            next(error);
        }
    });
    producerRoutes.post('/:producerId/whitelist', authenticate([UserRole.ADMIN]), async (req, res, next) => {
        try {
            const result = await useCases.whitelistProducerUseCase.execute({ producerId: req.params.producerId });
            res.json(result);
        }
        catch (error) {
            next(error);
        }
    });
    const addCertificationSchema = z.object({
        body: z.object({
            type: z.string(),
            certifier: z.string(),
            certificateNumber: z.string(),
            issuedAt: z.string().datetime(),
            expiresAt: z.string().datetime(),
        })
    });
    producerRoutes.post('/:producerId/certifications', authenticate([UserRole.CERTIFIER]), validateRequest(addCertificationSchema), async (req, res, next) => {
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
    return producerRoutes;
}
//# sourceMappingURL=producers.routes.js.map