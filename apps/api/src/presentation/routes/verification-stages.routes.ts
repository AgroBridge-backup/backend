/**
 * Traceability 2.0 - Multi-Stage Verification
 * API Routes for Verification Stages
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validator.middleware.js';
import { UserRole, StageType, StageStatus } from '@prisma/client';
import { VerificationStagesUseCases } from '../../application/use-cases/verification-stages/index.js';
import { RateLimiterConfig } from '../../infrastructure/http/middleware/rate-limiter.middleware.js';
import { FinalizeBatchStagesUseCase } from '../../application/use-cases/verification-stages/FinalizeBatchStagesUseCase.js';

export function createVerificationStagesRouter(
  useCases?: VerificationStagesUseCases & { finalizeBatchStagesUseCase?: FinalizeBatchStagesUseCase }
): Router {
  const router = Router();

  // Guard: Return empty router if use cases not provided
  if (!useCases) {
    return router;
  }

  // Schema Definitions
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

  /**
   * GET /api/v1/batches/:id/stages
   * Get all verification stages for a batch
   * Returns ordered list with current/next stage info and completion progress
   */
  router.get(
    '/:id/stages',
    authenticate(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await useCases.getBatchStagesUseCase.execute({
          batchId: req.params.id,
        });

        res.status(200).json({
          success: true,
          data: result,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/v1/batches/:id/stages
   * Create the next verification stage for a batch
   * If stageType is provided, creates that specific stage (requires proper order or admin role)
   * If stageType is not provided, creates the next stage in sequence
   */
  router.post(
    '/:id/stages',
    authenticate([
      UserRole.PRODUCER,
      UserRole.QA,
      UserRole.EXPORTER,
      UserRole.DRIVER,
      UserRole.CERTIFIER,
      UserRole.ADMIN,
    ]),
    RateLimiterConfig.creation(),
    validateRequest(createStageSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await useCases.createBatchStageUseCase.execute({
          batchId: req.params.id,
          userId: req.user!.userId,
          userRole: req.user!.role as UserRole,
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
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * PATCH /api/v1/batches/:id/stages/:stageId
   * Update a verification stage (status, notes, location, evidence)
   * Status transitions are validated by the service
   */
  router.patch(
    '/:id/stages/:stageId',
    authenticate([
      UserRole.PRODUCER,
      UserRole.QA,
      UserRole.EXPORTER,
      UserRole.DRIVER,
      UserRole.CERTIFIER,
      UserRole.ADMIN,
    ]),
    validateRequest(updateStageSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await useCases.updateBatchStageUseCase.execute({
          stageId: req.params.stageId,
          userId: req.user!.userId,
          userRole: req.user!.role as UserRole,
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
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/v1/batches/:id/stages/finalize
   * Finalize all stages for a batch and store hash on blockchain
   * Only available when all stages are approved
   * Requires CERTIFIER or ADMIN role
   */
  if (useCases.finalizeBatchStagesUseCase) {
    router.post(
      '/:id/stages/finalize',
      authenticate([UserRole.CERTIFIER, UserRole.ADMIN]),
      async (req: Request, res: Response, next: NextFunction) => {
        try {
          const result = await useCases.finalizeBatchStagesUseCase!.execute({
            batchId: req.params.id,
          });

          res.status(200).json({
            success: true,
            data: result,
            message: 'Batch stages finalized and stored on blockchain.',
          });
        } catch (error) {
          next(error);
        }
      }
    );
  }

  return router;
}
