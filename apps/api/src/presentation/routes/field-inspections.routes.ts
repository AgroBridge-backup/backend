/**
 * Field Inspections Routes
 * RESTful API endpoints for field inspection management
 * Supports inspection creation, photo evidence, organic input tracking, and verification
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { PrismaFieldInspectionRepository } from '../../infrastructure/database/prisma/repositories/PrismaFieldInspectionRepository.js';
import { PrismaOrganicFieldRepository } from '../../infrastructure/database/prisma/repositories/PrismaOrganicFieldRepository.js';
import { FieldInspectionService } from '../../domain/services/FieldInspectionService.js';
import {
  CreateFieldInspectionUseCase,
  GetFieldInspectionUseCase,
  ListFieldInspectionsUseCase,
  UpdateInspectionNotesUseCase,
  VerifyFieldInspectionUseCase,
  AddInspectionPhotoUseCase,
  AddOrganicInputUseCase,
  VerifyOrganicInputUseCase,
  AddFieldActivityUseCase,
  GetFieldInspectionStatsUseCase,
  GetInspectionDetailsUseCase,
} from '../../application/use-cases/field-inspections/index.js';
import {
  InspectionType,
  PHOTO_TYPES,
  INPUT_TYPES,
  ACTIVITY_TYPES,
  WEATHER_CONDITIONS,
} from '../../domain/entities/FieldInspection.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { RateLimiterConfig } from '../../infrastructure/http/middleware/rate-limiter.middleware.js';
import { logger } from '../../infrastructure/logging/logger.js';

// Validation schemas
const createInspectionSchema = z.object({
  inspectorId: z.string().uuid(),
  inspectorName: z.string().min(2).max(255),
  inspectorRole: z.string().min(2).max(100),
  inspectionType: z.nativeEnum(InspectionType).optional(),
  inspectionDate: z.string().datetime().optional(),
  duration: z.number().int().positive().optional(),
  inspectorLat: z.number().min(-90).max(90).optional(),
  inspectorLng: z.number().min(-180).max(180).optional(),
  gpsAccuracy: z.number().positive().optional(),
  weatherCondition: z.enum(WEATHER_CONDITIONS as unknown as [string, ...string[]]).optional(),
  temperature: z.number().optional(),
  notes: z.string().max(5000).optional(),
  issues: z.string().max(5000).optional(),
  recommendations: z.string().max(5000).optional(),
});

const updateNotesSchema = z.object({
  notes: z.string().max(5000).optional(),
  issues: z.string().max(5000).optional(),
  recommendations: z.string().max(5000).optional(),
});

const listInspectionsSchema = z.object({
  inspectionType: z.nativeEnum(InspectionType).optional(),
  isVerified: z.coerce.boolean().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

const addPhotoSchema = z.object({
  imageUrl: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  altitude: z.number().optional(),
  capturedAt: z.string().datetime(),
  caption: z.string().max(500).optional(),
  photoType: z.enum(PHOTO_TYPES as unknown as [string, ...string[]]).optional(),
});

const addOrganicInputSchema = z.object({
  productName: z.string().min(1).max(255),
  brandName: z.string().max(255).optional(),
  manufacturer: z.string().max(255).optional(),
  inputType: z.enum(INPUT_TYPES as unknown as [string, ...string[]]),
  isOmriListed: z.boolean().optional(),
  isOrganicApproved: z.boolean().optional(),
  certificationNumber: z.string().max(100).optional(),
  receiptUrl: z.string().url().optional(),
  receiptDate: z.string().datetime().optional(),
  quantity: z.string().max(100).optional(),
  supplier: z.string().max(255).optional(),
  ocrExtractedData: z.any().optional(),
  ocrConfidence: z.number().min(0).max(1).optional(),
});

const verifyOrganicInputSchema = z.object({
  approved: z.boolean(),
  rejectionReason: z.string().max(500).optional(),
});

const addActivitySchema = z.object({
  activityType: z.enum(ACTIVITY_TYPES as unknown as [string, ...string[]]),
  description: z.string().max(1000).optional(),
  activityDate: z.string().datetime(),
  duration: z.number().int().positive().optional(),
  areaCovered: z.number().positive().optional(),
  workerCount: z.number().int().positive().optional(),
  notes: z.string().max(2000).optional(),
});

/**
 * Factory function to create field inspections router with dependencies
 */
export function createFieldInspectionsRouter(prisma: PrismaClient): Router {
  const router = Router();

  // Initialize repositories and service
  const inspectionRepository = new PrismaFieldInspectionRepository(prisma);
  const fieldRepository = new PrismaOrganicFieldRepository(prisma);
  const inspectionService = new FieldInspectionService({
    inspectionRepository,
    fieldRepository,
  });

  // Initialize use cases
  const createInspectionUseCase = new CreateFieldInspectionUseCase(inspectionService);
  const getInspectionUseCase = new GetFieldInspectionUseCase(inspectionService);
  const listInspectionsUseCase = new ListFieldInspectionsUseCase(inspectionService);
  const updateNotesUseCase = new UpdateInspectionNotesUseCase(inspectionService);
  const verifyInspectionUseCase = new VerifyFieldInspectionUseCase(inspectionService);
  const addPhotoUseCase = new AddInspectionPhotoUseCase(inspectionService);
  const addOrganicInputUseCase = new AddOrganicInputUseCase(inspectionService);
  const verifyOrganicInputUseCase = new VerifyOrganicInputUseCase(inspectionService);
  const addActivityUseCase = new AddFieldActivityUseCase(inspectionService);
  const getStatsUseCase = new GetFieldInspectionStatsUseCase(inspectionService);
  const getDetailsUseCase = new GetInspectionDetailsUseCase(inspectionService);

  // ═══════════════════════════════════════════════════════════════════════════════
  // FIELD-SCOPED ROUTES (nested under /organic-fields/:fieldId)
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/v1/organic-fields/:fieldId/inspections
   * Create a new inspection for a field
   */
  router.post(
    '/:fieldId/inspections',
    authenticate(['PRODUCER', 'ADMIN', 'QA', 'CERTIFIER']),
    RateLimiterConfig.creation(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { fieldId } = req.params;
        const validation = createInspectionSchema.safeParse(req.body);

        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: 'Validation error',
            details: validation.error.errors,
          });
        }

        const result = await createInspectionUseCase.execute({
          fieldId,
          ...validation.data,
          inspectionDate: validation.data.inspectionDate
            ? new Date(validation.data.inspectionDate)
            : undefined,
        });

        logger.info('Field inspection created via API', {
          inspectionId: result.inspection.id,
          fieldId,
          gpsVerified: result.gpsVerified,
        });

        res.status(201).json({
          success: true,
          data: result.inspection,
          gpsVerified: result.gpsVerified,
          message: result.message,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/organic-fields/:fieldId/inspections
   * List inspections for a field
   */
  router.get(
    '/:fieldId/inspections',
    authenticate(['PRODUCER', 'ADMIN', 'QA', 'CERTIFIER']),
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { fieldId } = req.params;
        const validation = listInspectionsSchema.safeParse(req.query);

        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: 'Validation error',
            details: validation.error.errors,
          });
        }

        const result = await listInspectionsUseCase.execute({
          fieldId,
          ...validation.data,
          fromDate: validation.data.fromDate ? new Date(validation.data.fromDate) : undefined,
          toDate: validation.data.toDate ? new Date(validation.data.toDate) : undefined,
        });

        res.json({
          success: true,
          data: result.inspections,
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
   * GET /api/v1/organic-fields/:fieldId/inspections/stats
   * Get inspection statistics for a field
   */
  router.get(
    '/:fieldId/inspections/stats',
    authenticate(['PRODUCER', 'ADMIN', 'QA', 'CERTIFIER']),
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { fieldId } = req.params;

        const result = await getStatsUseCase.execute({ fieldId });

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

/**
 * Factory function to create inspection-specific routes
 * Mounted at /api/v1/inspections
 */
export function createInspectionRoutes(prisma: PrismaClient): Router {
  const router = Router();

  // Initialize repositories and service
  const inspectionRepository = new PrismaFieldInspectionRepository(prisma);
  const fieldRepository = new PrismaOrganicFieldRepository(prisma);
  const inspectionService = new FieldInspectionService({
    inspectionRepository,
    fieldRepository,
  });

  // Initialize use cases
  const getInspectionUseCase = new GetFieldInspectionUseCase(inspectionService);
  const updateNotesUseCase = new UpdateInspectionNotesUseCase(inspectionService);
  const verifyInspectionUseCase = new VerifyFieldInspectionUseCase(inspectionService);
  const addPhotoUseCase = new AddInspectionPhotoUseCase(inspectionService);
  const addOrganicInputUseCase = new AddOrganicInputUseCase(inspectionService);
  const verifyOrganicInputUseCase = new VerifyOrganicInputUseCase(inspectionService);
  const addActivityUseCase = new AddFieldActivityUseCase(inspectionService);
  const getDetailsUseCase = new GetInspectionDetailsUseCase(inspectionService);

  // ═══════════════════════════════════════════════════════════════════════════════
  // INSPECTION-SPECIFIC ROUTES
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/v1/inspections/:id
   * Get inspection by ID with optional details
   */
  router.get(
    '/:id',
    authenticate(['PRODUCER', 'ADMIN', 'QA', 'CERTIFIER']),
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const includeDetails = req.query.details === 'true';

        const result = await getInspectionUseCase.execute({
          inspectionId: id,
          includeDetails,
        });

        res.json({
          success: true,
          data: result.inspection,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * PATCH /api/v1/inspections/:id/notes
   * Update inspection notes, issues, and recommendations
   */
  router.patch(
    '/:id/notes',
    authenticate(['PRODUCER', 'ADMIN', 'QA', 'CERTIFIER']),
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const validation = updateNotesSchema.safeParse(req.body);

        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: 'Validation error',
            details: validation.error.errors,
          });
        }

        const result = await updateNotesUseCase.execute({
          inspectionId: id,
          ...validation.data,
        });

        logger.info('Inspection notes updated via API', { inspectionId: id });

        res.json({
          success: true,
          data: result.inspection,
          message: result.message,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/v1/inspections/:id/verify
   * Verify an inspection (supervisor/certifier only)
   */
  router.post(
    '/:id/verify',
    authenticate(['ADMIN', 'CERTIFIER']),
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const verifiedBy = req.user?.id || 'unknown';

        const result = await verifyInspectionUseCase.execute({
          inspectionId: id,
          verifiedBy,
        });

        logger.info('Inspection verified via API', {
          inspectionId: id,
          verifiedBy,
        });

        res.json({
          success: true,
          data: result.inspection,
          message: result.message,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/inspections/:id/details
   * Get all details (photos, inputs, activities) for an inspection
   */
  router.get(
    '/:id/details',
    authenticate(['PRODUCER', 'ADMIN', 'QA', 'CERTIFIER']),
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;

        const result = await getDetailsUseCase.execute({ inspectionId: id });

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // PHOTO ROUTES
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/v1/inspections/:id/photos
   * Add photo to inspection
   */
  router.post(
    '/:id/photos',
    authenticate(['PRODUCER', 'ADMIN', 'QA', 'CERTIFIER']),
    RateLimiterConfig.creation(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const validation = addPhotoSchema.safeParse(req.body);

        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: 'Validation error',
            details: validation.error.errors,
          });
        }

        const result = await addPhotoUseCase.execute({
          inspectionId: id,
          ...validation.data,
          capturedAt: new Date(validation.data.capturedAt),
        });

        logger.info('Inspection photo added via API', {
          inspectionId: id,
          photoId: result.photo.id,
          withinBoundary: result.withinBoundary,
        });

        res.status(201).json({
          success: true,
          data: result.photo,
          withinBoundary: result.withinBoundary,
          distanceFromField: result.distanceFromField,
          message: result.message,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // ORGANIC INPUT ROUTES
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/v1/inspections/:id/organic-inputs
   * Add organic input record to inspection
   */
  router.post(
    '/:id/organic-inputs',
    authenticate(['PRODUCER', 'ADMIN', 'QA', 'CERTIFIER']),
    RateLimiterConfig.creation(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const validation = addOrganicInputSchema.safeParse(req.body);

        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: 'Validation error',
            details: validation.error.errors,
          });
        }

        const result = await addOrganicInputUseCase.execute({
          inspectionId: id,
          ...validation.data,
          receiptDate: validation.data.receiptDate
            ? new Date(validation.data.receiptDate)
            : undefined,
        });

        logger.info('Organic input added via API', {
          inspectionId: id,
          inputId: result.organicInput.id,
          productName: result.organicInput.productName,
        });

        res.status(201).json({
          success: true,
          data: result.organicInput,
          message: result.message,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/v1/inspections/organic-inputs/:inputId/verify
   * Verify organic input (approve or reject)
   */
  router.post(
    '/organic-inputs/:inputId/verify',
    authenticate(['ADMIN', 'CERTIFIER']),
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { inputId } = req.params;
        const verifiedBy = req.user?.id || 'unknown';
        const validation = verifyOrganicInputSchema.safeParse(req.body);

        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: 'Validation error',
            details: validation.error.errors,
          });
        }

        const result = await verifyOrganicInputUseCase.execute({
          inputId,
          verifiedBy,
          approved: validation.data.approved,
          rejectionReason: validation.data.rejectionReason,
        });

        logger.info('Organic input verified via API', {
          inputId,
          verifiedBy,
          approved: validation.data.approved,
        });

        res.json({
          success: true,
          data: result.organicInput,
          message: result.message,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // ACTIVITY ROUTES
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/v1/inspections/:id/activities
   * Add field activity record to inspection
   */
  router.post(
    '/:id/activities',
    authenticate(['PRODUCER', 'ADMIN', 'QA', 'CERTIFIER']),
    RateLimiterConfig.creation(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const validation = addActivitySchema.safeParse(req.body);

        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: 'Validation error',
            details: validation.error.errors,
          });
        }

        const result = await addActivityUseCase.execute({
          inspectionId: id,
          ...validation.data,
          activityDate: new Date(validation.data.activityDate),
        });

        logger.info('Field activity added via API', {
          inspectionId: id,
          activityId: result.activity.id,
          activityType: result.activity.activityType,
        });

        res.status(201).json({
          success: true,
          data: result.activity,
          message: result.message,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // CONFIG ROUTES
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/v1/inspections/config/options
   * Get configuration options (photo types, input types, etc.)
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
            inspectionTypes: Object.values(InspectionType),
            photoTypes: PHOTO_TYPES,
            inputTypes: INPUT_TYPES,
            activityTypes: ACTIVITY_TYPES,
            weatherConditions: WEATHER_CONDITIONS,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
