/**
 * Organic Fields Routes
 * RESTful API endpoints for organic field management
 * Supports field registration, status tracking, and GPS verification
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { PrismaOrganicFieldRepository } from '../../infrastructure/database/prisma/repositories/PrismaOrganicFieldRepository.js';
import { OrganicFieldService } from '../../domain/services/OrganicFieldService.js';
import {
  RegisterOrganicFieldUseCase,
  GetOrganicFieldUseCase,
  ListProducerFieldsUseCase,
  UpdateOrganicFieldUseCase,
  CertifyFieldUseCase,
  VerifyLocationUseCase,
  GetProducerFieldStatsUseCase,
} from '../../application/use-cases/organic-fields/index.js';
import { OrganicFieldStatus, SUPPORTED_CROP_TYPES, WATER_SOURCES, IRRIGATION_TYPES } from '../../domain/entities/OrganicField.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { RateLimiterConfig } from '../../infrastructure/http/middleware/rate-limiter.middleware.js';
import { logger } from '../../infrastructure/logging/logger.js';

// Validation schemas
const registerFieldSchema = z.object({
  baseFieldId: z.string().uuid().optional(),
  name: z.string().min(2).max(255),
  localIdentifier: z.string().max(100).optional(),
  cropType: z.enum(SUPPORTED_CROP_TYPES as unknown as [string, ...string[]]),
  variety: z.string().max(100).optional(),
  areaHectares: z.number().positive(),
  boundaryGeoJson: z.string(),
  centerLat: z.number().min(-90).max(90),
  centerLng: z.number().min(-180).max(180),
  altitude: z.number().optional(),
  organicSince: z.string().datetime().optional(),
  lastConventional: z.string().datetime().optional(),
  waterSources: z.array(z.enum(WATER_SOURCES as unknown as [string, ...string[]])).optional(),
  irrigationType: z.enum(IRRIGATION_TYPES as unknown as [string, ...string[]]).optional(),
  soilType: z.string().max(100).optional(),
  lastSoilTestDate: z.string().datetime().optional(),
  certifiedStandards: z.array(z.string()).optional(),
});

const updateFieldSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  localIdentifier: z.string().max(100).optional(),
  cropType: z.enum(SUPPORTED_CROP_TYPES as unknown as [string, ...string[]]).optional(),
  variety: z.string().max(100).optional(),
  areaHectares: z.number().positive().optional(),
  boundaryGeoJson: z.string().optional(),
  centerLat: z.number().min(-90).max(90).optional(),
  centerLng: z.number().min(-180).max(180).optional(),
  altitude: z.number().optional(),
  waterSources: z.array(z.string()).optional(),
  irrigationType: z.string().optional(),
  soilType: z.string().max(100).optional(),
  lastSoilTestDate: z.string().datetime().optional(),
});

const listFieldsSchema = z.object({
  certificationStatus: z.nativeEnum(OrganicFieldStatus).optional(),
  cropType: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

const certifyFieldSchema = z.object({
  standards: z.array(z.enum(['ORGANIC_USDA', 'ORGANIC_EU', 'SENASICA'])).min(1),
});

const verifyLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

/**
 * Factory function to create organic fields router with dependencies
 */
export function createOrganicFieldsRouter(prisma: PrismaClient): Router {
  const router = Router();

  // Initialize repository and service
  const fieldRepository = new PrismaOrganicFieldRepository(prisma);
  const fieldService = new OrganicFieldService(fieldRepository);

  // Initialize use cases
  const registerFieldUseCase = new RegisterOrganicFieldUseCase(fieldService);
  const getFieldUseCase = new GetOrganicFieldUseCase(fieldService);
  const listFieldsUseCase = new ListProducerFieldsUseCase(fieldService);
  const updateFieldUseCase = new UpdateOrganicFieldUseCase(fieldService);
  const certifyFieldUseCase = new CertifyFieldUseCase(fieldService);
  const verifyLocationUseCase = new VerifyLocationUseCase(fieldService);
  const getStatsUseCase = new GetProducerFieldStatsUseCase(fieldService);

  /**
   * POST /api/v1/producers/:producerId/organic-fields
   * Register a new organic field for a producer
   */
  router.post(
    '/:producerId/organic-fields',
    authenticate(['PRODUCER', 'ADMIN']),
    RateLimiterConfig.creation(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { producerId } = req.params;
        const validation = registerFieldSchema.safeParse(req.body);

        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: 'Validation error',
            details: validation.error.errors,
          });
        }

        const result = await registerFieldUseCase.execute({
          producerId,
          ...validation.data,
          organicSince: validation.data.organicSince ? new Date(validation.data.organicSince) : undefined,
          lastConventional: validation.data.lastConventional ? new Date(validation.data.lastConventional) : undefined,
          lastSoilTestDate: validation.data.lastSoilTestDate ? new Date(validation.data.lastSoilTestDate) : undefined,
        });

        logger.info('Organic field registered via API', {
          fieldId: result.field.id,
          producerId,
        });

        res.status(201).json({
          success: true,
          data: result.field,
          transitionEndDate: result.transitionEndDate,
          message: result.message,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/producers/:producerId/organic-fields
   * List organic fields for a producer
   */
  router.get(
    '/:producerId/organic-fields',
    authenticate(['PRODUCER', 'ADMIN', 'CERTIFIER']),
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { producerId } = req.params;
        const validation = listFieldsSchema.safeParse(req.query);

        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: 'Validation error',
            details: validation.error.errors,
          });
        }

        const result = await listFieldsUseCase.execute({
          producerId,
          ...validation.data,
        });

        res.json({
          success: true,
          data: result.fields,
          meta: {
            total: result.total,
            limit: result.limit,
            offset: result.offset,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/producers/:producerId/organic-fields/stats
   * Get field statistics for a producer
   */
  router.get(
    '/:producerId/organic-fields/stats',
    authenticate(['PRODUCER', 'ADMIN']),
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { producerId } = req.params;

        const result = await getStatsUseCase.execute({ producerId });

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/organic-fields/:id
   * Get organic field by ID with statistics
   */
  router.get(
    '/:id',
    authenticate(['PRODUCER', 'ADMIN', 'CERTIFIER', 'QA']),
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;

        const result = await getFieldUseCase.execute({ fieldId: id });

        res.json({
          success: true,
          data: result.field,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * PATCH /api/v1/organic-fields/:id
   * Update organic field details
   */
  router.patch(
    '/:id',
    authenticate(['PRODUCER', 'ADMIN']),
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const validation = updateFieldSchema.safeParse(req.body);

        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: 'Validation error',
            details: validation.error.errors,
          });
        }

        const result = await updateFieldUseCase.execute({
          fieldId: id,
          ...validation.data,
          lastSoilTestDate: validation.data.lastSoilTestDate ? new Date(validation.data.lastSoilTestDate) : undefined,
        });

        logger.info('Organic field updated via API', { fieldId: id });

        res.json({
          success: true,
          data: result.field,
          message: result.message,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/v1/organic-fields/:id/certify
   * Certify an organic field with standards
   */
  router.post(
    '/:id/certify',
    authenticate(['CERTIFIER', 'ADMIN']),
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const validation = certifyFieldSchema.safeParse(req.body);

        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: 'Validation error',
            details: validation.error.errors,
          });
        }

        const result = await certifyFieldUseCase.execute({
          fieldId: id,
          standards: validation.data.standards,
        });

        logger.info('Organic field certified via API', {
          fieldId: id,
          standards: validation.data.standards,
        });

        res.json({
          success: true,
          data: result.field,
          message: result.message,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/v1/organic-fields/:id/verify-location
   * Verify if GPS coordinates are within field boundary
   */
  router.post(
    '/:id/verify-location',
    authenticate(['PRODUCER', 'ADMIN', 'QA', 'CERTIFIER']),
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const validation = verifyLocationSchema.safeParse(req.body);

        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: 'Validation error',
            details: validation.error.errors,
          });
        }

        const result = await verifyLocationUseCase.execute({
          fieldId: id,
          latitude: validation.data.latitude,
          longitude: validation.data.longitude,
        });

        res.json({
          success: true,
          data: {
            isWithinBoundary: result.isWithinBoundary,
            distanceFromCenter: result.distanceFromCenter,
          },
          message: result.message,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/organic-fields/config/options
   * Get configuration options (crop types, water sources, etc.)
   */
  router.get(
    '/config/options',
    authenticate(),
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        res.json({
          success: true,
          data: {
            cropTypes: SUPPORTED_CROP_TYPES,
            waterSources: WATER_SOURCES,
            irrigationTypes: IRRIGATION_TYPES,
            certificationStatuses: Object.values(OrganicFieldStatus),
            certificationStandards: ['ORGANIC_USDA', 'ORGANIC_EU', 'SENASICA'],
            transitionPeriodMonths: 36,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
