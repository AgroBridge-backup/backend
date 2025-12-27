/**
 * @file Report Routes
 * @description Export report generation endpoints
 *
 * Endpoints:
 * - POST   /api/v1/reports - Create a new report
 * - GET    /api/v1/reports - List user's reports
 * - GET    /api/v1/reports/:reportId - Get report details
 * - DELETE /api/v1/reports/:reportId - Delete a report
 * - GET    /api/v1/reports/:reportId/download - Get download URL
 * - GET    /api/v1/reports/types - Get available report types
 *
 * @author AgroBridge Engineering Team
 */

import { Router, Request, Response } from "express";
import { PrismaClient, ReportType, ReportFormat } from "@prisma/client";
import { validateRequest } from "../middlewares/validator.middleware.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { RateLimiterConfig } from "../../infrastructure/http/middleware/rate-limiter.middleware.js";
import {
  ReportService,
  createReportService,
  ReportServiceError,
} from "../../infrastructure/reports/ReportService.js";
import {
  createReportSchema,
  listReportsSchema,
  getReportSchema,
  deleteReportSchema,
  downloadReportSchema,
} from "../validators/report.validator.js";
import logger from "../../shared/utils/logger.js";

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT ROUTER FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

export function createReportRouter(prisma: PrismaClient): Router {
  const router = Router();
  const reportService = createReportService(prisma);

  // ═══════════════════════════════════════════════════════════════════════════════
  // PUBLIC ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/v1/reports/types
   * Get available report types and formats
   */
  router.get(
    "/types",
    RateLimiterConfig.api(),
    (req: Request, res: Response) => {
      const types = [
        {
          type: ReportType.BATCH_TRACEABILITY,
          name: "Trazabilidad de Lotes",
          description:
            "Reporte detallado de lotes con eventos y certificaciones",
          formats: [ReportFormat.PDF, ReportFormat.CSV, ReportFormat.XLSX],
        },
        {
          type: ReportType.PRODUCER_SUMMARY,
          name: "Resumen de Productor",
          description: "Estadisticas y actividad del productor",
          formats: [ReportFormat.PDF, ReportFormat.XLSX],
        },
        {
          type: ReportType.AUDIT_LOG,
          name: "Registro de Auditoria",
          description: "Historial de acciones del sistema",
          formats: [ReportFormat.PDF, ReportFormat.CSV, ReportFormat.XLSX],
        },
        {
          type: ReportType.INVENTORY,
          name: "Inventario",
          description: "Estado actual del inventario por variedad",
          formats: [ReportFormat.CSV, ReportFormat.XLSX],
        },
        {
          type: ReportType.ANALYTICS,
          name: "Analiticas",
          description: "Metricas y tendencias de la plataforma",
          formats: [ReportFormat.PDF, ReportFormat.XLSX],
        },
        {
          type: ReportType.EVENTS_TIMELINE,
          name: "Linea de Tiempo de Eventos",
          description: "Exportacion de eventos de trazabilidad",
          formats: [ReportFormat.CSV, ReportFormat.XLSX],
        },
        {
          type: ReportType.COMPLIANCE,
          name: "Cumplimiento",
          description: "Reporte de cumplimiento normativo",
          formats: [ReportFormat.PDF],
        },
      ];

      res.json({
        success: true,
        data: { types },
      });
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // AUTHENTICATED ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/v1/reports
   * Create a new report
   */
  router.post(
    "/",
    authenticate(),
    RateLimiterConfig.api(),
    validateRequest(createReportSchema),
    async (req: Request, res: Response) => {
      try {
        if (!req.user?.userId) {
          return res.status(401).json({
            success: false,
            error: { code: "UNAUTHORIZED", message: "User not authenticated" },
          });
        }

        const { type, format, name, filters } = req.body;

        const report = await reportService.createReport({
          userId: req.user.userId,
          type,
          format,
          name,
          filters,
        });

        res.status(202).json({
          success: true,
          data: report,
          message: "Report generation started. Check status for completion.",
        });
      } catch (error) {
        handleReportError(error, res);
      }
    },
  );

  /**
   * GET /api/v1/reports
   * List user's reports
   */
  router.get(
    "/",
    authenticate(),
    validateRequest(listReportsSchema),
    async (req: Request, res: Response) => {
      try {
        if (!req.user?.userId) {
          return res.status(401).json({
            success: false,
            error: { code: "UNAUTHORIZED", message: "User not authenticated" },
          });
        }

        const { type, status, limit, offset } = req.query;

        const result = await reportService.listReports(req.user.userId, {
          type: type as ReportType | undefined,
          status: status as any,
          limit: Number(limit) || 20,
          offset: Number(offset) || 0,
        });

        res.json({
          success: true,
          data: result.reports,
          meta: {
            total: result.total,
            limit: Number(limit) || 20,
            offset: Number(offset) || 0,
          },
        });
      } catch (error) {
        handleReportError(error, res);
      }
    },
  );

  /**
   * GET /api/v1/reports/:reportId
   * Get report details
   */
  router.get(
    "/:reportId",
    authenticate(),
    validateRequest(getReportSchema),
    async (req: Request, res: Response) => {
      try {
        if (!req.user?.userId) {
          return res.status(401).json({
            success: false,
            error: { code: "UNAUTHORIZED", message: "User not authenticated" },
          });
        }

        const report = await reportService.getReport(
          req.params.reportId,
          req.user.userId,
        );

        if (!report) {
          return res.status(404).json({
            success: false,
            error: { code: "NOT_FOUND", message: "Report not found" },
          });
        }

        res.json({
          success: true,
          data: report,
        });
      } catch (error) {
        handleReportError(error, res);
      }
    },
  );

  /**
   * DELETE /api/v1/reports/:reportId
   * Delete a report
   */
  router.delete(
    "/:reportId",
    authenticate(),
    RateLimiterConfig.api(),
    validateRequest(deleteReportSchema),
    async (req: Request, res: Response) => {
      try {
        if (!req.user?.userId) {
          return res.status(401).json({
            success: false,
            error: { code: "UNAUTHORIZED", message: "User not authenticated" },
          });
        }

        await reportService.deleteReport(req.params.reportId, req.user.userId);

        res.status(204).send();
      } catch (error) {
        handleReportError(error, res);
      }
    },
  );

  /**
   * GET /api/v1/reports/:reportId/download
   * Get download URL for report
   */
  router.get(
    "/:reportId/download",
    authenticate(),
    validateRequest(downloadReportSchema),
    async (req: Request, res: Response) => {
      try {
        if (!req.user?.userId) {
          return res.status(401).json({
            success: false,
            error: { code: "UNAUTHORIZED", message: "User not authenticated" },
          });
        }

        const downloadUrl = await reportService.getDownloadUrl(
          req.params.reportId,
          req.user.userId,
        );

        res.json({
          success: true,
          data: {
            downloadUrl,
            expiresIn: 3600, // 1 hour
          },
        });
      } catch (error) {
        handleReportError(error, res);
      }
    },
  );

  return router;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Handle report service errors
 */
function handleReportError(error: unknown, res: Response): void {
  if (error instanceof ReportServiceError) {
    logger.warn("[ReportRoutes] Report service error", {
      code: error.code,
      message: error.message,
    });
    res.status(error.statusCode).json({
      success: false,
      error: { code: error.code, message: error.message },
    });
    return;
  }

  logger.error("[ReportRoutes] Unexpected error", {
    error: error instanceof Error ? error.message : "Unknown error",
    stack: error instanceof Error ? error.stack : undefined,
  });

  res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
  });
}
