import { BaseJobProcessor } from '../processors/JobProcessor.js';
import { resilientEmailService } from '../../notifications/services/ResilientEmailService.js';
import logger from '../../../shared/utils/logger.js';
export class EmailJob extends BaseJobProcessor {
    constructor() {
        super('email');
    }
    async process(job) {
        const { to, subject, template, data, html, attachments } = job.data;
        try {
            if (!resilientEmailService.isAvailable()) {
                logger.warn('[EmailJob] Email service not available');
                return {
                    success: false,
                    error: 'Email service not available',
                    errorCode: 'SERVICE_UNAVAILABLE',
                };
            }
            await this.reportProgress(job, 20, 'Preparing email');
            let result;
            await this.reportProgress(job, 50, 'Sending email');
            switch (template) {
                case 'welcome':
                    result = await resilientEmailService.sendWelcomeEmail(to, data.name);
                    break;
                case 'password-reset':
                    result = await resilientEmailService.sendPasswordResetEmail(to, data.resetToken);
                    break;
                case 'verification':
                    result = await resilientEmailService.sendVerificationEmail(to, data.verificationToken);
                    break;
                case '2fa-code':
                    result = await resilientEmailService.send2FACodeEmail(to, data.code);
                    break;
                case 'batch-created':
                    result = await resilientEmailService.sendBatchCreatedEmail(to, {
                        batchId: data.batchId,
                        variety: data.variety,
                        origin: data.origin,
                        weightKg: data.weightKg,
                        harvestDate: data.harvestDate,
                        producerName: data.producerName,
                        status: data.status,
                    });
                    break;
                case 'custom':
                    if (!html) {
                        return {
                            success: false,
                            error: 'HTML content required for custom template',
                            errorCode: 'MISSING_HTML',
                        };
                    }
                    result = await resilientEmailService.sendEmail({
                        to,
                        subject,
                        html,
                        attachments: attachments?.map(att => ({
                            filename: att.filename,
                            content: att.content,
                            type: 'application/octet-stream',
                            disposition: 'attachment',
                        })),
                    });
                    break;
                default:
                    return {
                        success: false,
                        error: `Unknown template: ${template}`,
                        errorCode: 'UNKNOWN_TEMPLATE',
                    };
            }
            await this.reportProgress(job, 100, 'Complete');
            if (result.success) {
                logger.info('[EmailJob] Email sent successfully', {
                    to,
                    template,
                    messageId: result.messageId,
                    provider: result.provider,
                });
                return {
                    success: true,
                    messageId: result.messageId,
                    provider: result.provider,
                };
            }
            else {
                logger.warn('[EmailJob] Email send failed', {
                    to,
                    template,
                    error: result.error,
                    errorCode: result.errorCode,
                });
                return {
                    success: false,
                    error: result.error,
                    errorCode: result.errorCode,
                };
            }
        }
        catch (error) {
            const err = error;
            logger.error('[EmailJob] Email job failed', {
                to,
                template,
                error: err.message,
                stack: err.stack,
            });
            return {
                success: false,
                error: err.message,
                errorCode: 'PROCESSING_ERROR',
            };
        }
    }
    sanitizeLogData(data) {
        if (!data || typeof data !== 'object') {
            return data;
        }
        const sanitized = { ...data };
        const sensitiveFields = [
            'resetToken',
            'verificationToken',
            'code',
            'password',
            'token',
        ];
        for (const field of sensitiveFields) {
            if (field in sanitized) {
                sanitized[field] = '[REDACTED]';
            }
        }
        if (sanitized.data && typeof sanitized.data === 'object') {
            const nestedData = { ...sanitized.data };
            for (const field of sensitiveFields) {
                if (field in nestedData) {
                    nestedData[field] = '[REDACTED]';
                }
            }
            sanitized.data = nestedData;
        }
        return sanitized;
    }
    isRetryableError(error) {
        const nonRetryablePatterns = [
            /invalid.*email/i,
            /address.*rejected/i,
            /blacklisted/i,
            /unsubscribed/i,
            /spam/i,
        ];
        return !nonRetryablePatterns.some(pattern => pattern.test(error.message));
    }
    async onCompleted(job, result) {
        await super.onCompleted(job, result);
        logger.debug('[EmailJob] Email delivery tracked', {
            to: job.data.to,
            template: job.data.template,
            success: result.success,
            provider: result.provider,
        });
    }
    async onFailed(job, error) {
        await super.onFailed(job, error);
        logger.error('[EmailJob] Email delivery failed permanently', {
            to: job.data.to,
            template: job.data.template,
            subject: job.data.subject,
            error: error.message,
            attempts: job.attemptsMade,
        });
    }
}
export const emailJob = new EmailJob();
export default emailJob;
