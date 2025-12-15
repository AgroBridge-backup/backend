import { PrismaClient } from '@prisma/client';
import { BaseJobProcessor } from '../processors/JobProcessor.js';
import { storageService } from '../../storage/StorageService.js';
import { resilientEmailService } from '../../notifications/services/ResilientEmailService.js';
import logger from '../../../shared/utils/logger.js';
const prisma = new PrismaClient();
export class ReportGenerationJob extends BaseJobProcessor {
    constructor() {
        super('reports');
    }
    async process(job) {
        const { type, format, filters, userId, emailTo, filename } = job.data;
        try {
            await this.reportProgress(job, 10, 'Fetching data');
            const data = await this.fetchReportData(type, filters);
            if (!data || data.length === 0) {
                logger.warn('[ReportGenerationJob] No data found for report', {
                    type,
                    filters,
                });
                return {
                    success: false,
                    error: 'No data found for the specified filters',
                };
            }
            await this.reportProgress(job, 40, `Generating ${format.toUpperCase()} report`);
            const reportBuffer = await this.generateReport(type, format, data);
            await this.reportProgress(job, 70, 'Uploading report');
            const reportFilename = filename || this.generateFilename(type, format);
            const uploadResult = await this.uploadReport(reportBuffer, reportFilename, format, {
                type,
                format,
                generatedBy: userId,
                generatedAt: new Date().toISOString(),
                filters: JSON.stringify(filters),
                rowCount: data.length,
            });
            if (!uploadResult.success) {
                return {
                    success: false,
                    error: uploadResult.error || 'Failed to upload report',
                };
            }
            let emailSent = false;
            if (emailTo) {
                await this.reportProgress(job, 90, 'Sending email notification');
                emailSent = await this.sendReportEmail(emailTo, reportFilename, uploadResult.url);
            }
            await this.reportProgress(job, 100, 'Complete');
            logger.info('[ReportGenerationJob] Report generated successfully', {
                type,
                format,
                filename: reportFilename,
                rowCount: data.length,
                emailSent,
            });
            return {
                success: true,
                reportUrl: uploadResult.url,
                cdnUrl: uploadResult.cdnUrl,
                filename: reportFilename,
                size: reportBuffer.length,
                emailSent,
            };
        }
        catch (error) {
            const err = error;
            logger.error('[ReportGenerationJob] Report generation failed', {
                type,
                format,
                error: err.message,
                stack: err.stack,
            });
            return {
                success: false,
                error: err.message,
            };
        }
    }
    async fetchReportData(type, filters) {
        switch (type) {
            case 'batch-traceability':
                return this.fetchBatchTraceabilityData(filters);
            case 'producer-summary':
                return this.fetchProducerSummaryData(filters);
            case 'audit-log':
                return this.fetchAuditLogData(filters);
            case 'export':
                return this.fetchExportData(filters);
            default:
                throw new Error(`Unknown report type: ${type}`);
        }
    }
    async fetchBatchTraceabilityData(filters) {
        const where = {};
        if (filters.batchId) {
            where.id = filters.batchId;
        }
        if (filters.producerId) {
            where.producerId = filters.producerId;
        }
        if (filters.startDate && filters.endDate) {
            where.createdAt = {
                gte: new Date(filters.startDate),
                lte: new Date(filters.endDate),
            };
        }
        const batches = await prisma.batch.findMany({
            where,
            include: {
                events: true,
                producer: {
                    select: {
                        id: true,
                        businessName: true,
                        state: true,
                        municipality: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: filters.limit || 1000,
        });
        return batches;
    }
    async fetchProducerSummaryData(filters) {
        const where = {};
        if (filters.producerId) {
            where.id = filters.producerId;
        }
        const producers = await prisma.producer.findMany({
            where,
            select: {
                id: true,
                businessName: true,
                rfc: true,
                state: true,
                municipality: true,
                isWhitelisted: true,
                createdAt: true,
                _count: {
                    select: {
                        batches: true,
                    },
                },
                certifications: {
                    select: {
                        id: true,
                        type: true,
                        certifier: true,
                        issuedAt: true,
                        expiresAt: true,
                        isActive: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: filters.limit || 100,
        });
        return producers;
    }
    async fetchAuditLogData(filters) {
        logger.debug('[ReportGenerationJob] Fetching audit log data', { filters });
        return [];
    }
    async fetchExportData(filters) {
        const entity = filters.entity;
        switch (entity) {
            case 'batches':
                return this.fetchBatchTraceabilityData(filters);
            case 'producers':
                return this.fetchProducerSummaryData(filters);
            default:
                throw new Error(`Unknown export entity: ${entity}`);
        }
    }
    async generateReport(type, format, data) {
        switch (format) {
            case 'csv':
                return this.generateCSV(data);
            case 'xlsx':
                return this.generateXLSX(type, data);
            case 'pdf':
                return this.generatePDF(type, data);
            default:
                throw new Error(`Unknown format: ${format}`);
        }
    }
    async generateCSV(data) {
        if (data.length === 0) {
            return Buffer.from('');
        }
        const firstItem = data[0];
        const headers = this.flattenHeaders(firstItem);
        const lines = [headers.join(',')];
        for (const item of data) {
            const row = headers.map(header => {
                const value = this.getNestedValue(item, header);
                return this.escapeCSV(value);
            });
            lines.push(row.join(','));
        }
        return Buffer.from(lines.join('\n'), 'utf-8');
    }
    async generateXLSX(_type, data) {
        logger.warn('[ReportGenerationJob] XLSX generation not fully implemented, using CSV');
        return this.generateCSV(data);
    }
    async generatePDF(_type, data) {
        logger.warn('[ReportGenerationJob] PDF generation not fully implemented');
        const content = [
            'AgroBridge Report',
            `Generated: ${new Date().toISOString()}`,
            `Records: ${data.length}`,
            '',
            JSON.stringify(data, null, 2),
        ].join('\n');
        return Buffer.from(content, 'utf-8');
    }
    flattenHeaders(obj, prefix = '') {
        const headers = [];
        for (const [key, value] of Object.entries(obj)) {
            const headerName = prefix ? `${prefix}.${key}` : key;
            if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
                if (key !== '_count') {
                    headers.push(...this.flattenHeaders(value, headerName));
                }
            }
            else {
                headers.push(headerName);
            }
        }
        return headers;
    }
    getNestedValue(obj, path) {
        const keys = path.split('.');
        let value = obj;
        for (const key of keys) {
            if (value && typeof value === 'object') {
                value = value[key];
            }
            else {
                return '';
            }
        }
        return value;
    }
    escapeCSV(value) {
        if (value === null || value === undefined) {
            return '';
        }
        const str = value instanceof Date
            ? value.toISOString()
            : String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }
    generateFilename(type, format) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        return `${type}-${timestamp}.${format}`;
    }
    async uploadReport(buffer, filename, format, metadata) {
        const contentTypeMap = {
            csv: 'text/csv',
            xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            pdf: 'application/pdf',
        };
        try {
            const result = await storageService.upload(buffer, filename, contentTypeMap[format], {
                type: 'document',
                optimize: false,
                prefix: 'reports',
                metadata: {
                    ...Object.fromEntries(Object.entries(metadata).map(([k, v]) => [k, String(v)])),
                },
            });
            if (!result.success) {
                return { success: false, error: result.error };
            }
            return {
                success: true,
                url: result.file?.url,
                cdnUrl: result.file?.cdnUrl,
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async sendReportEmail(email, filename, downloadUrl) {
        try {
            const result = await resilientEmailService.sendEmail({
                to: email,
                subject: `Tu reporte está listo: ${filename}`,
                html: this.generateReportEmailHtml(filename, downloadUrl),
            });
            return result.success;
        }
        catch (error) {
            logger.error('[ReportGenerationJob] Failed to send report email', {
                email,
                error: error.message,
            });
            return false;
        }
    }
    generateReportEmailHtml(filename, downloadUrl) {
        return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #1B5E20 0%, #2E7D32 100%); color: white; padding: 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700;">Tu Reporte Está Listo</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px;">
              <p style="margin-bottom: 16px;">Hola,</p>
              <p style="margin-bottom: 24px;">El reporte que solicitaste ha sido generado exitosamente.</p>
              <p style="margin-bottom: 8px;"><strong>Archivo:</strong> ${filename}</p>
              <table role="presentation" style="width: 100%; margin-top: 24px;">
                <tr>
                  <td align="center">
                    <a href="${downloadUrl}" style="display: inline-block; background: #2E7D32; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                      Descargar Reporte
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin-top: 24px; color: #666; font-size: 14px;">
                Este enlace estará disponible por 7 días.
              </p>
            </td>
          </tr>
          <tr>
            <td style="text-align: center; padding: 20px; color: #999; font-size: 12px; border-top: 1px solid #E0E0E0;">
              <p style="margin: 0;">&copy; ${new Date().getFullYear()} AgroBridge. Todos los derechos reservados.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
    }
    async onCompleted(job, result) {
        await super.onCompleted(job, result);
        logger.info('[ReportGenerationJob] Report generation completed', {
            type: job.data.type,
            format: job.data.format,
            filename: result.filename,
            size: result.size,
            emailSent: result.emailSent,
        });
    }
}
export const reportGenerationJob = new ReportGenerationJob();
export default reportGenerationJob;
