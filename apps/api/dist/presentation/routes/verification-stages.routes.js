import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validator.middleware.js';
import { UserRole, StageType, StageStatus } from '@prisma/client';
import { RateLimiterConfig } from '../../infrastructure/http/middleware/rate-limiter.middleware.js';
export function createVerificationStagesRouter(useCases) {
    const router = Router();
    const createStageSchema = z.object({
        body: z.object({
            stageType: z.nativeEnum(StageType).optional(),
            location: z.string().optional(),
            latitude: z.number().min(-90).max(90).optional(),
            longitude: z.number().min(-180).max(180).optional(),
            notes: z.string().max(1000).optional(),
            evidenceUrl: z.string().url().optional(),
        }),
        params: z.object({
            id: z.string().uuid(),
        }),
    });
    const updateStageSchema = z.object({
        body: z.object({
            status: z.nativeEnum(StageStatus).optional(),
            notes: z.string().max(1000).optional(),
            location: z.string().optional(),
            latitude: z.number().min(-90).max(90).optional(),
            longitude: z.number().min(-180).max(180).optional(),
            evidenceUrl: z.string().url().optional(),
        }),
        params: z.object({
            id: z.string().uuid(),
            stageId: z.string().uuid(),
        }),
    });
    router.get('/:id/stages', authenticate(), async (req, res, next) => {
        try {
            const result = await useCases.getBatchStagesUseCase.execute({
                batchId: req.params.id,
            });
            res.status(200).json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.post('/:id/stages', authenticate([
        UserRole.PRODUCER,
        UserRole.QA,
        UserRole.EXPORTER,
        UserRole.DRIVER,
        UserRole.CERTIFIER,
        UserRole.ADMIN,
    ]), RateLimiterConfig.creation(), validateRequest(createStageSchema), async (req, res, next) => {
        try {
            const result = await useCases.createBatchStageUseCase.execute({
                batchId: req.params.id,
                userId: req.user.userId,
                userRole: req.user.role,
                stageType: req.body.stageType,
                location: req.body.location,
                latitude: req.body.latitude,
                longitude: req.body.longitude,
                notes: req.body.notes,
                evidenceUrl: req.body.evidenceUrl,
            });
            res.status(201).json({
                success: true,
                data: result,
                message: result.isComplete
                    ? 'All stages complete. Batch ready for blockchain finalization.'
                    : 'Stage created successfully.',
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.patch('/:id/stages/:stageId', authenticate([
        UserRole.PRODUCER,
        UserRole.QA,
        UserRole.EXPORTER,
        UserRole.DRIVER,
        UserRole.CERTIFIER,
        UserRole.ADMIN,
    ]), validateRequest(updateStageSchema), async (req, res, next) => {
        try {
            const result = await useCases.updateBatchStageUseCase.execute({
                stageId: req.params.stageId,
                userId: req.user.userId,
                userRole: req.user.role,
                status: req.body.status,
                notes: req.body.notes,
                location: req.body.location,
                latitude: req.body.latitude,
                longitude: req.body.longitude,
                evidenceUrl: req.body.evidenceUrl,
            });
            res.status(200).json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    });
    if (useCases.finalizeBatchStagesUseCase) {
        router.post('/:id/stages/finalize', authenticate([UserRole.CERTIFIER, UserRole.ADMIN]), async (req, res, next) => {
            try {
                const result = await useCases.finalizeBatchStagesUseCase.execute({
                    batchId: req.params.id,
                });
                res.status(200).json({
                    success: true,
                    data: result,
                    message: 'Batch stages finalized and stored on blockchain.',
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    return router;
}
