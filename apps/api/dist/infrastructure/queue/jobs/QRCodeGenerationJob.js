import QRCode from 'qrcode';
import { PrismaClient } from '@prisma/client';
import { BaseJobProcessor } from '../processors/JobProcessor.js';
import { storageService } from '../../storage/StorageService.js';
import logger from '../../../shared/utils/logger.js';
const prisma = new PrismaClient();
const DEFAULT_QR_OPTIONS = {
    width: 400,
    errorCorrectionLevel: 'H',
    margin: 2,
    color: {
        dark: '#1B5E20',
        light: '#FFFFFF',
    },
};
export class QRCodeGenerationJob extends BaseJobProcessor {
    options;
    constructor(options = {}) {
        super('qr-generation');
        this.options = { ...DEFAULT_QR_OPTIONS, ...options };
    }
    async process(job) {
        const { batchId, data, userId } = job.data;
        try {
            await this.reportProgress(job, 10, 'Validating batch');
            const batch = await this.validateBatch(batchId);
            if (!batch) {
                return {
                    success: false,
                    batchId,
                    error: `Batch not found: ${batchId}`,
                };
            }
            await this.reportProgress(job, 30, 'Generating QR code');
            const qrBuffer = await this.generateQRCode(data);
            await this.reportProgress(job, 60, 'Uploading to storage');
            const uploadResult = await this.uploadQRCode(qrBuffer, batchId);
            if (!uploadResult.success) {
                return {
                    success: false,
                    batchId,
                    error: uploadResult.error || 'Failed to upload QR code',
                };
            }
            await this.reportProgress(job, 80, 'Updating batch record');
            await this.updateBatchWithQRCode(batchId, uploadResult.url, uploadResult.cdnUrl);
            await this.reportProgress(job, 100, 'Complete');
            logger.info('[QRCodeGenerationJob] QR code generated successfully', {
                batchId,
                qrCodeUrl: uploadResult.url,
                userId,
            });
            return {
                success: true,
                batchId,
                qrCodeUrl: uploadResult.url,
                cdnUrl: uploadResult.cdnUrl,
            };
        }
        catch (error) {
            const err = error;
            logger.error('[QRCodeGenerationJob] Failed to generate QR code', {
                batchId,
                error: err.message,
                stack: err.stack,
            });
            return {
                success: false,
                batchId,
                error: err.message,
            };
        }
    }
    async validateBatch(batchId) {
        try {
            const batch = await prisma.batch.findUnique({
                where: { id: batchId },
                select: { id: true },
            });
            return batch;
        }
        catch (error) {
            logger.error('[QRCodeGenerationJob] Error validating batch', {
                batchId,
                error: error.message,
            });
            return null;
        }
    }
    async generateQRCode(data) {
        const buffer = await QRCode.toBuffer(data, {
            type: 'png',
            width: this.options.width,
            errorCorrectionLevel: this.options.errorCorrectionLevel,
            margin: this.options.margin,
            color: this.options.color,
        });
        logger.debug('[QRCodeGenerationJob] QR code generated', {
            dataLength: data.length,
            bufferSize: buffer.length,
        });
        return buffer;
    }
    async uploadQRCode(buffer, batchId) {
        try {
            const filename = `qr-${batchId}-${Date.now()}.png`;
            const result = await storageService.upload(buffer, filename, 'image/png', {
                type: 'image',
                optimize: false,
                prefix: `qr-codes/${batchId}`,
                metadata: {
                    batchId,
                    type: 'qr-code',
                    generatedAt: new Date().toISOString(),
                },
            });
            if (!result.success) {
                return {
                    success: false,
                    error: result.error || 'Upload failed',
                };
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
    async updateBatchWithQRCode(batchId, qrCodeUrl, cdnUrl) {
        logger.info('[QRCodeGenerationJob] QR code URL generated for batch', {
            batchId,
            qrCodeUrl,
            cdnUrl,
            generatedAt: new Date().toISOString(),
        });
    }
    async onCompleted(job, result) {
        await super.onCompleted(job, result);
        if (job.data.callbackUrl && result.success) {
            try {
                logger.debug('[QRCodeGenerationJob] Callback URL provided', {
                    callbackUrl: job.data.callbackUrl,
                });
            }
            catch (error) {
                logger.warn('[QRCodeGenerationJob] Callback failed', {
                    error: error.message,
                });
            }
        }
    }
    async onFailed(job, error) {
        await super.onFailed(job, error);
        logger.error('[QRCodeGenerationJob] Job failed permanently', {
            batchId: job.data.batchId,
            userId: job.data.userId,
            error: error.message,
            attempts: job.attemptsMade,
        });
    }
}
export const qrCodeGenerationJob = new QRCodeGenerationJob();
export default qrCodeGenerationJob;
