import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validator.middleware.js';
import * as Prisma from '@prisma/client';
import { InsufficientPermissionsError } from '../../shared/errors/InsufficientPermissionsError.js';
import { ProducerUseCases } from '../../application/use-cases/producers/index.js';

export function createProducersRouter(useCases: ProducerUseCases) {
  const router = Router();

  // Schema Definitions
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

  // Route Definitions
  router.get(
    '/',
    authenticate([Prisma.UserRole.ADMIN]),
    validateRequest(listProducersSchema),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      console.log("[DEBUG] Producers GET start");
      try {
        console.log("[DEBUG] Request query:", req.query);
        const result = await useCases.listProducersUseCase.execute(req.query);
        console.log("[DEBUG] DB result:", result);

        if (!result || result.producers.length === 0) {
          console.log("[DEBUG] No producers found, returning 200 with empty array.");
          return res.status(200).json({ producers: [], total: 0 });
        }
        
        res.status(200).json(result);
      } catch (error) {
        console.error("[DEBUG] Error in GET /producers handler:", error);
        next(error);
      }
    }
  );

  router.get(
    '/:producerId',
    authenticate([Prisma.UserRole.ADMIN, Prisma.UserRole.PRODUCER]),
    validateRequest(producerIdSchema),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { producerId } = req.params;
        if (req.user!.role === Prisma.UserRole.PRODUCER && req.user!.producerId !== producerId) {
          throw new InsufficientPermissionsError('Producers can only access their own data.');
        }
        const result = await useCases.getProducerByIdUseCase.execute({ producerId });
        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/:producerId/whitelist',
    authenticate([Prisma.UserRole.ADMIN]),
    validateRequest(producerIdSchema),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const result = await useCases.whitelistProducerUseCase.execute({ producerId: req.params.producerId });
        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/:producerId/certifications',
    authenticate([Prisma.UserRole.ADMIN, Prisma.UserRole.CERTIFIER]),
    // TODO: Add validation schema for certification body
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const result = await useCases.addCertificationUseCase.execute({ 
          producerId: req.params.producerId, 
          ...req.body 
        });
        res.status(201).json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

