/**
 * Quality Metrics Routes
 *
 * REST API endpoints for Brix/pH quality verification.
 *
 * @module QualityMetricsRoutes
 */

import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { QualityMetricsService } from "../../domain/services/QualityMetricsService.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { AppError } from "../../shared/errors/AppError.js";
import { CropType } from "../../domain/entities/SmartColdChain.js";

// ════════════════════════════════════════════════════════════════════════════════
// VALIDATION SCHEMAS
// ════════════════════════════════════════════════════════════════════════════════

const RecordQualitySchema = z.object({
  fieldId: z.string().optional(),
  batchId: z.string().optional(),
  harvestDate: z.string().datetime(),
  cropType: z.enum([
    "AVOCADO",
    "BLUEBERRY",
    "STRAWBERRY",
    "RASPBERRY",
    "COFFEE",
    "CACAO",
  ]),
  sampleSize: z.number().int().min(1).optional(),
  brixLevel: z.number().min(0).max(30),
  phLevel: z.number().min(0).max(14),
  firmness: z.number().min(0).optional(),
  color: z.string().optional(),
  diameter: z.number().min(0).optional(),
  weight: z.number().min(0).optional(),
  defectCount: z.number().int().min(0).optional(),
  defectTypes: z.array(z.string()).optional(),
  measurementDevice: z.string().optional(),
  measurementMethod: z.string().optional(),
  notes: z.string().optional(),
});

const LabVerificationSchema = z.object({
  labReportUrl: z.string().url().optional(),
});

// ════════════════════════════════════════════════════════════════════════════════
// ROUTER FACTORY
// ════════════════════════════════════════════════════════════════════════════════

export function createQualityMetricsRouter(prisma: PrismaClient): Router {
  const router = Router();
  const service = new QualityMetricsService(prisma);

  // Apply auth middleware to all routes
  router.use(authenticate());

  // ══════════════════════════════════════════════════════════════════════════════
  // QUALITY METRICS ENDPOINTS
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * POST /quality-metrics
   * Record quality metrics for a harvest
   */
  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const exportCompanyId = req.user?.exportCompanyAdminId;
      if (!exportCompanyId) {
        throw new AppError("Export company context required", 403);
      }

      const data = RecordQualitySchema.parse(req.body);

      const metrics = await service.recordQuality({
        ...data,
        exportCompanyId,
        harvestDate: new Date(data.harvestDate),
        cropType: data.cropType as CropType,
      });

      res.status(201).json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /quality-metrics
   * List quality metrics for the export company
   */
  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const exportCompanyId = req.user?.exportCompanyAdminId;
      if (!exportCompanyId) {
        throw new AppError("Export company context required", 403);
      }

      const {
        fieldId,
        batchId,
        cropType,
        overallQuality,
        exportEligible,
        startDate,
        endDate,
        limit,
        offset,
      } = req.query;

      const result = await service.listMetrics(exportCompanyId, {
        fieldId: fieldId as string,
        batchId: batchId as string,
        cropType: cropType as string,
        overallQuality: overallQuality as string,
        exportEligible:
          exportEligible === "true"
            ? true
            : exportEligible === "false"
              ? false
              : undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });

      res.json({
        success: true,
        data: result.metrics,
        meta: { total: result.total },
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /quality-metrics/stats
   * Get quality statistics for the export company
   */
  router.get(
    "/stats",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const exportCompanyId = req.user?.exportCompanyAdminId;
        if (!exportCompanyId) {
          throw new AppError("Export company context required", 403);
        }

        const { startDate, endDate, cropType } = req.query;

        const stats = await service.getStats(exportCompanyId, {
          startDate: startDate ? new Date(startDate as string) : undefined,
          endDate: endDate ? new Date(endDate as string) : undefined,
          cropType: cropType as string,
        });

        res.json({
          success: true,
          data: stats,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /quality-metrics/thresholds
   * Get quality thresholds for all crop types
   */
  router.get(
    "/thresholds",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const thresholds = service.getAllThresholds();

        res.json({
          success: true,
          data: thresholds,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /quality-metrics/thresholds/:cropType
   * Get quality thresholds for a specific crop type
   */
  router.get(
    "/thresholds/:cropType",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const thresholds = service.getThresholds(
          req.params.cropType as CropType,
        );

        res.json({
          success: true,
          data: thresholds,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /quality-metrics/trend
   * Analyze quality trend for field or batch
   */
  router.get(
    "/trend",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const exportCompanyId = req.user?.exportCompanyAdminId;
        if (!exportCompanyId) {
          throw new AppError("Export company context required", 403);
        }

        const { fieldId, batchId, cropType, months } = req.query;

        const trend = await service.analyzeQualityTrend({
          exportCompanyId,
          fieldId: fieldId as string,
          batchId: batchId as string,
          cropType: cropType as string,
          months: months ? parseInt(months as string) : undefined,
        });

        res.json({
          success: true,
          data: trend,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /quality-metrics/:id
   * Get quality metrics by ID
   */
  router.get(
    "/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const metrics = await service.getMetrics(req.params.id);

        res.json({
          success: true,
          data: metrics,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /quality-metrics/:id/verify
   * Verify quality metrics with lab report
   */
  router.post(
    "/:id/verify",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const data = LabVerificationSchema.parse(req.body);

        const metrics = await service.verifyWithLab({
          metricsId: req.params.id,
          verifiedBy: req.user?.id || "unknown",
          labReportUrl: data.labReportUrl,
        });

        res.json({
          success: true,
          data: metrics,
          message: "Quality metrics verified with lab report",
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
