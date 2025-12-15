import { Router } from 'express';
import { ReportType, ReportFormat } from '@prisma/client';
import { validateRequest } from '../middlewares/validator.middleware.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { RateLimiterConfig } from '../../infrastructure/http/middleware/rate-limiter.middleware.js';
import { createReportService, ReportServiceError, } from '../../infrastructure/reports/ReportService.js';
import { createReportSchema, listReportsSchema, getReportSchema, deleteReportSchema, downloadReportSchema, } from '../validators/report.validator.js';
import logger from '../../shared/utils/logger.js';
export function createReportRouter(prisma) {
    const router = Router();
    const reportService = createReportService(prisma);
    router.get('/types', RateLimiterConfig.api(), (req, res) => {
        const types = [
            {
                type: ReportType.BATCH_TRACEABILITY,
                name: 'Trazabilidad de Lotes',
                description: 'Reporte detallado de lotes con eventos y certificaciones',
                formats: [ReportFormat.PDF, ReportFormat.CSV, ReportFormat.XLSX],
            },
            {
                type: ReportType.PRODUCER_SUMMARY,
                name: 'Resumen de Productor',
                description: 'Estadisticas y actividad del productor',
                formats: [ReportFormat.PDF, ReportFormat.XLSX],
            },
            {
                type: ReportType.AUDIT_LOG,
                name: 'Registro de Auditoria',
                description: 'Historial de acciones del sistema',
                formats: [ReportFormat.PDF, ReportFormat.CSV, ReportFormat.XLSX],
            },
            {
                type: ReportType.INVENTORY,
                name: 'Inventario',
                description: 'Estado actual del inventario por variedad',
                formats: [ReportFormat.CSV, ReportFormat.XLSX],
            },
            {
                type: ReportType.ANALYTICS,
                name: 'Analiticas',
                description: 'Metricas y tendencias de la plataforma',
                formats: [ReportFormat.PDF, ReportFormat.XLSX],
            },
            {
                type: ReportType.EVENTS_TIMELINE,
                name: 'Linea de Tiempo de Eventos',
                description: 'Exportacion de eventos de trazabilidad',
                formats: [ReportFormat.CSV, ReportFormat.XLSX],
            },
            {
                type: ReportType.COMPLIANCE,
                name: 'Cumplimiento',
                description: 'Reporte de cumplimiento normativo',
                formats: [ReportFormat.PDF],
            },
        ];
        res.json({
            success: true,
            data: { types },
        });
    });
    router.post('/', authenticate(), RateLimiterConfig.api(), validateRequest(createReportSchema), async (req, res) => {
        try {
            if (!req.user?.userId) {
                return res.status(401).json({
                    success: false,
                    error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
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
                message: 'Report generation started. Check status for completion.',
            });
        }
        catch (error) {
            handleReportError(error, res);
        }
    });
    router.get('/', authenticate(), validateRequest(listReportsSchema), async (req, res) => {
        try {
            if (!req.user?.userId) {
                return res.status(401).json({
                    success: false,
                    error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
                });
            }
            const { type, status, limit, offset } = req.query;
            const result = await reportService.listReports(req.user.userId, {
                type: type,
                status: status,
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
        }
        catch (error) {
            handleReportError(error, res);
        }
    });
    router.get('/:reportId', authenticate(), validateRequest(getReportSchema), async (req, res) => {
        try {
            if (!req.user?.userId) {
                return res.status(401).json({
                    success: false,
                    error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
                });
            }
            const report = await reportService.getReport(req.params.reportId, req.user.userId);
            if (!report) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Report not found' },
                });
            }
            res.json({
                success: true,
                data: report,
            });
        }
        catch (error) {
            handleReportError(error, res);
        }
    });
    router.delete('/:reportId', authenticate(), RateLimiterConfig.api(), validateRequest(deleteReportSchema), async (req, res) => {
        try {
            if (!req.user?.userId) {
                return res.status(401).json({
                    success: false,
                    error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
                });
            }
            await reportService.deleteReport(req.params.reportId, req.user.userId);
            res.status(204).send();
        }
        catch (error) {
            handleReportError(error, res);
        }
    });
    router.get('/:reportId/download', authenticate(), validateRequest(downloadReportSchema), async (req, res) => {
        try {
            if (!req.user?.userId) {
                return res.status(401).json({
                    success: false,
                    error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
                });
            }
            const downloadUrl = await reportService.getDownloadUrl(req.params.reportId, req.user.userId);
            res.json({
                success: true,
                data: {
                    downloadUrl,
                    expiresIn: 3600,
                },
            });
        }
        catch (error) {
            handleReportError(error, res);
        }
    });
    return router;
}
function handleReportError(error, res) {
    if (error instanceof ReportServiceError) {
        logger.warn('[ReportRoutes] Report service error', {
            code: error.code,
            message: error.message,
        });
        res.status(error.statusCode).json({
            success: false,
            error: { code: error.code, message: error.message },
        });
        return;
    }
    logger.error('[ReportRoutes] Unexpected error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
}
