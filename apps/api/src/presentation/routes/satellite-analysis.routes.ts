/**
 * Satellite Analysis Routes
 *
 * REST API endpoints for satellite-based organic compliance verification.
 * Uses Sentinel-2 NDVI analysis to detect synthetic fertilizer patterns.
 *
 * @module satellite-analysis.routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.middleware.js';
import { SatelliteAnalysisService } from '../../domain/services/SatelliteAnalysisService.js';
import { createSentinelHubService } from '../../infrastructure/services/SentinelHubService.js';
import { SatelliteCropType, SENTINEL_HUB_LIMITS } from '../../domain/entities/SatelliteAnalysis.js';
import logger from '../../shared/utils/logger.js';

/**
 * Request validation schemas
 */
const AnalyzeFieldSchema = z.object({
  analysisYears: z.number().int().min(1).max(5).default(3),
  intervalDays: z.number().int().min(7).max(90).default(30),
  maxCloudCoverage: z.number().min(0).max(100).default(50),
});

const CropTypeSchema = z.enum([
  'AVOCADO',
  'BLUEBERRY',
  'STRAWBERRY',
  'RASPBERRY',
  'BLACKBERRY',
  'COFFEE',
  'CACAO',
]);

/**
 * Allowed roles for satellite analysis
 */
const ANALYSIS_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.EXPORT_COMPANY_ADMIN,
  UserRole.CERTIFIER,
];

const VIEW_ROLES: UserRole[] = [
  ...ANALYSIS_ROLES,
  UserRole.PRODUCER,
];

/**
 * Create satellite analysis router
 */
export function createSatelliteAnalysisRouter(prisma: PrismaClient): Router {
  const router = Router();
  const sentinelHub = createSentinelHubService();
  const service = new SatelliteAnalysisService(prisma, sentinelHub);

  /**
   * POST /api/v1/organic-fields/:fieldId/satellite-compliance
   *
   * Run 3-year NDVI analysis for organic certification compliance.
   * Detects synthetic fertilizer patterns with 90%+ confidence.
   *
   * @access ADMIN, EXPORT_COMPANY_ADMIN, CERTIFIER
   */
  router.post(
    '/:fieldId/satellite-compliance',
    authenticate(ANALYSIS_ROLES),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { fieldId } = req.params;
        const userId = req.user?.userId;

        if (!userId) {
          return res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
          });
        }

        // Validate request body
        const parseResult = AnalyzeFieldSchema.safeParse(req.body);
        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request parameters',
              details: parseResult.error.errors,
            },
          });
        }

        const { analysisYears, intervalDays, maxCloudCoverage } = parseResult.data;

        // Get field to determine crop type
        const field = await prisma.organicField.findUnique({
          where: { id: fieldId },
          select: { id: true, cropType: true, name: true, producerId: true },
        });

        if (!field) {
          return res.status(404).json({
            success: false,
            error: { code: 'FIELD_NOT_FOUND', message: `Campo ${fieldId} no encontrado` },
          });
        }

        // Validate crop type
        const cropTypeResult = CropTypeSchema.safeParse(field.cropType);
        if (!cropTypeResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'UNSUPPORTED_CROP',
              message: `Tipo de cultivo no soportado: ${field.cropType}`,
            },
          });
        }

        logger.info('[SatelliteRoutes] Starting satellite analysis', {
          fieldId,
          fieldName: field.name,
          cropType: field.cropType,
          analysisYears,
          requestedBy: userId,
        });

        // Run analysis
        const report = await service.analyzeFieldCompliance({
          organicFieldId: fieldId,
          analysisYears,
          cropType: cropTypeResult.data as SatelliteCropType,
          requestedBy: userId,
          intervalDays,
          maxCloudCoverage,
        });

        // Determine response message based on status
        let message: string;
        switch (report.complianceStatus) {
          case 'ELIGIBLE':
            message = 'Campo elegible para certificación orgánica. No se detectaron violaciones.';
            break;
          case 'INELIGIBLE':
            message = 'Campo NO elegible - se detectaron violaciones de prácticas orgánicas.';
            break;
          case 'NEEDS_REVIEW':
            message = 'Requiere revisión manual por posibles anomalías detectadas.';
            break;
          default:
            message = 'Análisis completado.';
        }

        return res.status(200).json({
          success: true,
          message,
          data: report,
        });
      } catch (error) {
        logger.error('[SatelliteRoutes] Analysis failed', {
          fieldId: req.params.fieldId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        if (error instanceof Error && error.message.includes('quota exceeded')) {
          return res.status(429).json({
            success: false,
            error: {
              code: 'QUOTA_EXCEEDED',
              message: 'Límite mensual de Sentinel Hub alcanzado. Inténtalo el próximo mes.',
              quotaLimit: SENTINEL_HUB_LIMITS.monthlyProcessingUnits,
            },
          });
        }

        next(error);
      }
    }
  );

  /**
   * GET /api/v1/organic-fields/:fieldId/satellite-analyses
   *
   * List all satellite analyses for a field (historical).
   *
   * @access ADMIN, EXPORT_COMPANY_ADMIN, CERTIFIER, PRODUCER
   */
  router.get(
    '/:fieldId/satellite-analyses',
    authenticate(VIEW_ROLES),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { fieldId } = req.params;
        const limit = parseInt(req.query.limit as string) || 10;

        // Verify field exists
        const field = await prisma.organicField.findUnique({
          where: { id: fieldId },
          select: { id: true, name: true },
        });

        if (!field) {
          return res.status(404).json({
            success: false,
            error: { code: 'FIELD_NOT_FOUND', message: `Campo ${fieldId} no encontrado` },
          });
        }

        const analyses = await service.listFieldAnalyses(fieldId, limit);

        return res.status(200).json({
          success: true,
          data: analyses,
          count: analyses.length,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/organic-fields/:fieldId/satellite-analyses/latest
   *
   * Get the most recent satellite analysis for a field.
   *
   * @access ADMIN, EXPORT_COMPANY_ADMIN, CERTIFIER, PRODUCER
   */
  router.get(
    '/:fieldId/satellite-analyses/latest',
    authenticate(VIEW_ROLES),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { fieldId } = req.params;

        const analysis = await service.getLatestAnalysis(fieldId);

        if (!analysis) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'NO_ANALYSIS_FOUND',
              message: 'No hay análisis satelital para este campo. Ejecute uno primero.',
            },
          });
        }

        return res.status(200).json({
          success: true,
          data: analysis,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

/**
 * Create satellite analysis direct routes (for /satellite-analyses/:id access)
 */
export function createSatelliteAnalysisDirectRouter(prisma: PrismaClient): Router {
  const router = Router();
  const sentinelHub = createSentinelHubService();
  const service = new SatelliteAnalysisService(prisma, sentinelHub);

  /**
   * GET /api/v1/satellite-analyses/:id
   *
   * Get existing analysis report by ID.
   *
   * @access ADMIN, EXPORT_COMPANY_ADMIN, CERTIFIER, PRODUCER
   */
  router.get(
    '/:id',
    authenticate(VIEW_ROLES),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;

        const analysis = await service.getAnalysis(id);

        if (!analysis) {
          return res.status(404).json({
            success: false,
            error: { code: 'ANALYSIS_NOT_FOUND', message: 'Análisis satelital no encontrado' },
          });
        }

        return res.status(200).json({
          success: true,
          data: analysis,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/satellite-analyses/stats
   *
   * Get satellite analysis statistics for dashboard.
   *
   * @access ADMIN, EXPORT_COMPANY_ADMIN
   */
  router.get(
    '/stats',
    authenticate([UserRole.ADMIN, UserRole.EXPORT_COMPANY_ADMIN]),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const stats = await service.getStats();

        return res.status(200).json({
          success: true,
          data: stats,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/satellite-analyses/health
   *
   * Check Sentinel Hub configuration and connectivity.
   *
   * @access ADMIN
   */
  router.get(
    '/health',
    authenticate([UserRole.ADMIN]),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const status = await service.checkConfiguration();

        return res.status(200).json({
          success: true,
          data: {
            ...status,
            quotaLimits: SENTINEL_HUB_LIMITS,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
