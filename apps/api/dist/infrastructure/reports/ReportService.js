import { ReportType, ReportFormat, ReportStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { createPDFGenerator } from './generators/PDFGenerator.js';
import { createCSVGenerator } from './generators/CSVGenerator.js';
import { createExcelGenerator } from './generators/ExcelGenerator.js';
import { s3StorageProvider as s3Service } from '../storage/index.js';
import logger from '../../shared/utils/logger.js';
export class ReportServiceError extends Error {
    code;
    statusCode;
    constructor(message, code, statusCode = 400) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.name = 'ReportServiceError';
    }
}
export class ReportService {
    prisma;
    REPORTS_BUCKET_PREFIX = 'reports';
    REPORT_EXPIRY_DAYS = 30;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createReport(input) {
        const reportId = uuidv4();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + this.REPORT_EXPIRY_DAYS);
        const report = await this.prisma.report.create({
            data: {
                id: reportId,
                userId: input.userId,
                type: input.type,
                format: input.format,
                name: input.name || this.generateReportName(input.type, input.format),
                filters: input.filters,
                status: ReportStatus.PENDING,
                expiresAt,
            },
        });
        logger.info('[ReportService] Report created', {
            reportId,
            type: input.type,
            format: input.format,
            userId: input.userId,
        });
        this.generateReport(reportId).catch((error) => {
            logger.error('[ReportService] Background generation failed', {
                reportId,
                error: error.message,
            });
        });
        return this.mapToReportData(report);
    }
    async getReport(reportId, userId) {
        const report = await this.prisma.report.findFirst({
            where: {
                id: reportId,
                userId,
            },
        });
        if (!report)
            return null;
        return this.mapToReportData(report);
    }
    async listReports(userId, options = {}) {
        const { type, status, limit = 20, offset = 0 } = options;
        const where = {
            userId,
            ...(type && { type }),
            ...(status && { status }),
        };
        const [reports, total] = await Promise.all([
            this.prisma.report.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
            }),
            this.prisma.report.count({ where }),
        ]);
        return {
            reports: reports.map(this.mapToReportData),
            total,
        };
    }
    async deleteReport(reportId, userId) {
        const report = await this.prisma.report.findFirst({
            where: { id: reportId, userId },
        });
        if (!report) {
            throw new ReportServiceError('Report not found', 'REPORT_NOT_FOUND', 404);
        }
        if (report.fileKey) {
            try {
                await s3Service.delete(report.fileKey);
            }
            catch (error) {
                logger.warn('[ReportService] Failed to delete file from S3', {
                    reportId,
                    fileKey: report.fileKey,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
        await this.prisma.report.delete({ where: { id: reportId } });
        logger.info('[ReportService] Report deleted', { reportId });
    }
    async getDownloadUrl(reportId, userId) {
        const report = await this.prisma.report.findFirst({
            where: { id: reportId, userId },
        });
        if (!report) {
            throw new ReportServiceError('Report not found', 'REPORT_NOT_FOUND', 404);
        }
        if (report.status !== ReportStatus.COMPLETED) {
            throw new ReportServiceError('Report is not ready for download', 'REPORT_NOT_READY', 400);
        }
        if (!report.fileKey) {
            throw new ReportServiceError('Report file not found', 'FILE_NOT_FOUND', 404);
        }
        const url = await s3Service.getPresignedDownloadUrl(report.fileKey, undefined, 3600);
        return url;
    }
    async cleanupExpiredReports() {
        const expiredReports = await this.prisma.report.findMany({
            where: {
                expiresAt: { lt: new Date() },
            },
            select: { id: true, fileKey: true },
        });
        for (const report of expiredReports) {
            if (report.fileKey) {
                try {
                    await s3Service.delete(report.fileKey);
                }
                catch (error) {
                    logger.warn('[ReportService] Failed to delete expired file', {
                        reportId: report.id,
                        fileKey: report.fileKey,
                    });
                }
            }
        }
        const result = await this.prisma.report.deleteMany({
            where: { expiresAt: { lt: new Date() } },
        });
        logger.info('[ReportService] Expired reports cleaned up', {
            count: result.count,
        });
        return result.count;
    }
    async generateReport(reportId) {
        const startTime = Date.now();
        try {
            const report = await this.prisma.report.update({
                where: { id: reportId },
                data: { status: ReportStatus.PROCESSING },
            });
            const data = await this.fetchReportData(report.type, report.userId, report.filters);
            const buffer = await this.generateFile(report.type, report.format, data);
            const fileKey = `${this.REPORTS_BUCKET_PREFIX}/${report.userId}/${reportId}.${this.getFileExtension(report.format)}`;
            const uploadResult = await s3Service.upload(buffer, {
                key: fileKey,
                contentType: this.getContentType(report.format),
            });
            const fileUrl = uploadResult.url;
            const processingTime = Date.now() - startTime;
            await this.prisma.report.update({
                where: { id: reportId },
                data: {
                    status: ReportStatus.COMPLETED,
                    fileUrl,
                    fileKey,
                    fileSize: buffer.length,
                    completedAt: new Date(),
                    processingTime,
                },
            });
            logger.info('[ReportService] Report generated', {
                reportId,
                type: report.type,
                format: report.format,
                size: buffer.length,
                processingTime,
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            await this.prisma.report.update({
                where: { id: reportId },
                data: {
                    status: ReportStatus.FAILED,
                    error: errorMessage,
                    processingTime: Date.now() - startTime,
                },
            });
            logger.error('[ReportService] Report generation failed', {
                reportId,
                error: errorMessage,
            });
            throw error;
        }
    }
    async fetchReportData(type, userId, filters) {
        const dateFrom = filters?.dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const dateTo = filters?.dateTo || new Date();
        switch (type) {
            case ReportType.BATCH_TRACEABILITY:
                return this.fetchBatchData(userId, filters);
            case ReportType.PRODUCER_SUMMARY:
                return this.fetchProducerData(userId, filters);
            case ReportType.AUDIT_LOG:
                return this.fetchAuditData(userId, dateFrom, dateTo);
            case ReportType.INVENTORY:
                return this.fetchInventoryData(filters);
            case ReportType.ANALYTICS:
                return this.fetchAnalyticsData(dateFrom, dateTo);
            case ReportType.EVENTS_TIMELINE:
                return this.fetchEventsData(filters);
            case ReportType.COMPLIANCE:
                return this.fetchComplianceData(userId, filters);
            default:
                throw new ReportServiceError(`Unsupported report type: ${type}`, 'UNSUPPORTED_TYPE');
        }
    }
    async generateFile(type, format, data) {
        switch (format) {
            case ReportFormat.PDF:
                return this.generatePDF(type, data);
            case ReportFormat.CSV:
                return this.generateCSV(type, data);
            case ReportFormat.XLSX:
                return this.generateExcel(type, data);
            default:
                throw new ReportServiceError(`Unsupported format: ${format}`, 'UNSUPPORTED_FORMAT');
        }
    }
    async fetchBatchData(userId, filters) {
        const batches = await this.prisma.batch.findMany({
            where: {
                ...(filters?.producerId && { producerId: filters.producerId }),
                ...(filters?.status && { status: filters.status }),
                ...(filters?.variety && { variety: filters.variety }),
                ...(filters?.dateFrom && {
                    harvestDate: { gte: new Date(filters.dateFrom) },
                }),
                ...(filters?.dateTo && {
                    harvestDate: { lte: new Date(filters.dateTo) },
                }),
            },
            include: {
                producer: { include: { user: true } },
                events: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 1000,
        });
        return batches.map((batch) => ({
            id: batch.id,
            variety: batch.variety,
            origin: batch.origin,
            weightKg: Number(batch.weightKg),
            harvestDate: batch.harvestDate,
            status: batch.status,
            producerName: batch.producer.businessName,
            producerRfc: batch.producer.rfc,
            blockchainHash: batch.blockchainHash,
            eventCount: batch.events.length,
            createdAt: batch.createdAt,
        }));
    }
    async fetchProducerData(userId, filters) {
        const producer = await this.prisma.producer.findFirst({
            where: {
                ...(filters?.producerId && { id: filters.producerId }),
                userId,
            },
            include: {
                user: true,
                batches: { include: { events: true } },
                certifications: { where: { isActive: true } },
            },
        });
        if (!producer)
            return null;
        return {
            producer: {
                businessName: producer.businessName,
                rfc: producer.rfc,
                state: producer.state,
                municipality: producer.municipality,
                isWhitelisted: producer.isWhitelisted,
                createdAt: producer.createdAt,
            },
            stats: {
                totalBatches: producer.batches.length,
                totalWeight: producer.batches.reduce((sum, b) => sum + Number(b.weightKg), 0),
                activeCertifications: producer.certifications.length,
                avgEventsPerBatch: producer.batches.length > 0
                    ? producer.batches.reduce((sum, b) => sum + b.events.length, 0) / producer.batches.length
                    : 0,
            },
            recentBatches: producer.batches.slice(0, 10).map((b) => ({
                id: b.id,
                variety: b.variety,
                weightKg: Number(b.weightKg),
                harvestDate: b.harvestDate,
                status: b.status,
            })),
        };
    }
    async fetchAuditData(userId, dateFrom, dateTo) {
        const logs = await this.prisma.auditLog.findMany({
            where: {
                timestamp: { gte: dateFrom, lte: dateTo },
            },
            orderBy: { timestamp: 'desc' },
            take: 5000,
        });
        const uniqueUsers = new Set(logs.map((l) => l.userId).filter(Boolean));
        const successCount = logs.filter((l) => l.success).length;
        return {
            period: { start: dateFrom, end: dateTo },
            summary: {
                totalActions: logs.length,
                uniqueUsers: uniqueUsers.size,
                successRate: logs.length > 0 ? (successCount / logs.length) * 100 : 0,
            },
            logs: logs.map((log) => ({
                id: log.id,
                timestamp: log.timestamp,
                userId: log.userId,
                action: log.action,
                resource: log.resource,
                resourceId: log.resourceId,
                success: log.success,
                ipAddress: log.ipAddress,
                durationMs: log.durationMs,
            })),
        };
    }
    async fetchInventoryData(filters) {
        const batches = await this.prisma.batch.groupBy({
            by: ['variety'],
            _count: { id: true },
            _sum: { weightKg: true },
            _avg: { weightKg: true },
        });
        return batches.map((b) => ({
            variety: b.variety,
            totalBatches: b._count.id,
            totalWeightKg: Number(b._sum.weightKg) || 0,
            avgWeightKg: Number(b._avg.weightKg) || 0,
        }));
    }
    async fetchAnalyticsData(dateFrom, dateTo) {
        const [batches, events, producers] = await Promise.all([
            this.prisma.batch.findMany({
                where: { createdAt: { gte: dateFrom, lte: dateTo } },
            }),
            this.prisma.traceabilityEvent.findMany({
                where: { timestamp: { gte: dateFrom, lte: dateTo } },
            }),
            this.prisma.producer.count({ where: { isWhitelisted: true } }),
        ]);
        return {
            period: { start: dateFrom, end: dateTo },
            metrics: {
                totalBatches: batches.length,
                totalWeight: batches.reduce((sum, b) => sum + Number(b.weightKg), 0),
                totalEvents: events.length,
                totalProducers: producers,
            },
            dailyStats: [],
            topProducers: [],
        };
    }
    async fetchEventsData(filters) {
        const events = await this.prisma.traceabilityEvent.findMany({
            where: {
                ...(filters?.dateFrom && { timestamp: { gte: new Date(filters.dateFrom) } }),
                ...(filters?.dateTo && { timestamp: { lte: new Date(filters.dateTo) } }),
            },
            orderBy: { timestamp: 'desc' },
            take: 5000,
        });
        return events.map((e) => ({
            id: e.id,
            batchId: e.batchId,
            eventType: e.eventType,
            timestamp: e.timestamp,
            locationName: e.locationName,
            latitude: Number(e.latitude),
            longitude: Number(e.longitude),
            temperature: e.temperature ? Number(e.temperature) : undefined,
            humidity: e.humidity ? Number(e.humidity) : undefined,
            notes: e.notes,
            isVerified: e.isVerified,
            createdById: e.createdById,
        }));
    }
    async fetchComplianceData(userId, filters) {
        return {
            batches: await this.fetchBatchData(userId, filters),
            audits: await this.fetchAuditData(userId, filters?.dateFrom || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), filters?.dateTo || new Date()),
        };
    }
    async generatePDF(type, data) {
        const pdfGenerator = createPDFGenerator({
            title: this.getReportTitle(type),
        });
        switch (type) {
            case ReportType.BATCH_TRACEABILITY:
                const batches = data;
                return pdfGenerator.generateProducerReport({
                    producer: {
                        businessName: 'Reporte de Lotes',
                        rfc: 'N/A',
                        state: 'N/A',
                        municipality: 'N/A',
                        isWhitelisted: true,
                        createdAt: new Date(),
                    },
                    stats: {
                        totalBatches: batches.length,
                        totalWeight: batches.reduce((sum, b) => sum + b.weightKg, 0),
                        activeCertifications: 0,
                        avgEventsPerBatch: batches.reduce((sum, b) => sum + b.eventCount, 0) / (batches.length || 1),
                    },
                    recentBatches: batches.slice(0, 20),
                });
            case ReportType.AUDIT_LOG:
                return pdfGenerator.generateAuditReport(data);
            default:
                return pdfGenerator.generateProducerReport(data);
        }
    }
    async generateCSV(type, data) {
        const csvGenerator = createCSVGenerator();
        switch (type) {
            case ReportType.BATCH_TRACEABILITY:
                return csvGenerator.generateBatchExport(data);
            case ReportType.EVENTS_TIMELINE:
                return csvGenerator.generateEventExport(data);
            case ReportType.AUDIT_LOG:
                const auditData = data;
                return csvGenerator.generateAuditExport(auditData.logs);
            default:
                return csvGenerator.generate(data, Object.keys(data[0] || {}).map((key) => ({
                    header: key,
                    key,
                })));
        }
    }
    async generateExcel(type, data) {
        const excelGenerator = createExcelGenerator();
        switch (type) {
            case ReportType.BATCH_TRACEABILITY:
                const batches = data;
                return excelGenerator.generateBatchReport({
                    batches,
                    summary: {
                        totalBatches: batches.length,
                        totalWeight: batches.reduce((sum, b) => sum + b.weightKg, 0),
                        byVariety: this.groupBy(batches, 'variety'),
                        byStatus: this.groupBy(batches, 'status'),
                    },
                });
            case ReportType.AUDIT_LOG:
                const auditData = data;
                return excelGenerator.generateAuditReport({
                    logs: auditData.logs,
                    summary: {
                        totalActions: auditData.summary.totalActions,
                        uniqueUsers: auditData.summary.uniqueUsers,
                        successCount: Math.round(auditData.summary.successRate * auditData.summary.totalActions / 100),
                        failureCount: auditData.summary.totalActions - Math.round(auditData.summary.successRate * auditData.summary.totalActions / 100),
                        byAction: this.groupBy(auditData.logs, 'action'),
                    },
                });
            default:
                return excelGenerator.generate({
                    title: this.getReportTitle(type),
                    sheets: [{
                            name: 'Data',
                            columns: Object.keys(data[0] || {}).map((key) => ({
                                header: key,
                                key,
                                width: 15,
                            })),
                            data: data,
                            freezeHeader: true,
                            autoFilter: true,
                        }],
                });
        }
    }
    generateReportName(type, format) {
        const date = new Date().toISOString().split('T')[0];
        const typeNames = {
            BATCH_TRACEABILITY: 'Trazabilidad_Lotes',
            PRODUCER_SUMMARY: 'Resumen_Productor',
            AUDIT_LOG: 'Registro_Auditoria',
            INVENTORY: 'Inventario',
            ANALYTICS: 'Analiticas',
            COMPLIANCE: 'Cumplimiento',
            EVENTS_TIMELINE: 'Eventos',
        };
        return `${typeNames[type]}_${date}.${this.getFileExtension(format)}`;
    }
    getReportTitle(type) {
        const titles = {
            BATCH_TRACEABILITY: 'Reporte de Trazabilidad de Lotes',
            PRODUCER_SUMMARY: 'Resumen de Productor',
            AUDIT_LOG: 'Registro de Auditoria',
            INVENTORY: 'Reporte de Inventario',
            ANALYTICS: 'Reporte de Analiticas',
            COMPLIANCE: 'Reporte de Cumplimiento',
            EVENTS_TIMELINE: 'Linea de Tiempo de Eventos',
        };
        return titles[type] || 'Reporte';
    }
    getFileExtension(format) {
        const extensions = {
            PDF: 'pdf',
            CSV: 'csv',
            XLSX: 'xlsx',
        };
        return extensions[format];
    }
    getContentType(format) {
        const types = {
            PDF: 'application/pdf',
            CSV: 'text/csv',
            XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
        return types[format];
    }
    groupBy(array, key) {
        return array.reduce((acc, item) => {
            const k = String(item[key] || 'Unknown');
            acc[k] = (acc[k] || 0) + 1;
            return acc;
        }, {});
    }
    mapToReportData(report) {
        return {
            id: report.id,
            userId: report.userId,
            type: report.type,
            format: report.format,
            status: report.status,
            name: report.name,
            fileUrl: report.fileUrl,
            fileSize: report.fileSize,
            filters: report.filters,
            error: report.error,
            createdAt: report.createdAt,
            completedAt: report.completedAt,
            expiresAt: report.expiresAt,
        };
    }
}
export function createReportService(prisma) {
    return new ReportService(prisma);
}
