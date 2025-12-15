import logger from '../../../shared/utils/logger.js';
export class BaseJobProcessor {
    queueName;
    constructor(queueName) {
        this.queueName = queueName;
    }
    async execute(job) {
        const context = this.createContext(job);
        const startTime = Date.now();
        this.logJobStart(context, job.data);
        try {
            const result = await this.process(job);
            const duration = Date.now() - startTime;
            this.logJobSuccess(context, duration, result);
            if (this.onCompleted) {
                await this.onCompleted(job, result);
            }
            return result;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            const err = error;
            this.logJobError(context, duration, err);
            if (this.onFailed && job.attemptsMade >= (job.opts.attempts || 3) - 1) {
                await this.onFailed(job, err);
            }
            throw error;
        }
    }
    async onCompleted(job, result) {
        logger.info(`[${this.queueName}] Job completed`, {
            jobId: job.id,
            queueName: this.queueName,
        });
    }
    async onFailed(job, error) {
        logger.error(`[${this.queueName}] Job failed permanently`, {
            jobId: job.id,
            queueName: this.queueName,
            error: error.message,
            stack: error.stack,
            attempts: job.attemptsMade,
        });
    }
    async reportProgress(job, progress, message) {
        await job.progress(progress);
        logger.debug(`[${this.queueName}] Job progress`, {
            jobId: job.id,
            progress: `${progress}%`,
            message,
        });
    }
    createContext(job) {
        return {
            jobId: job.id,
            queueName: this.queueName,
            attempt: job.attemptsMade + 1,
            maxAttempts: job.opts.attempts || 3,
            startTime: Date.now(),
        };
    }
    logJobStart(context, data) {
        logger.info(`[${this.queueName}] Job started`, {
            jobId: context.jobId,
            attempt: `${context.attempt}/${context.maxAttempts}`,
            data: this.sanitizeLogData(data),
        });
    }
    logJobSuccess(context, duration, result) {
        logger.info(`[${this.queueName}] Job succeeded`, {
            jobId: context.jobId,
            duration: `${duration}ms`,
            result: this.sanitizeLogData(result),
        });
    }
    logJobError(context, duration, error) {
        logger.error(`[${this.queueName}] Job error`, {
            jobId: context.jobId,
            attempt: `${context.attempt}/${context.maxAttempts}`,
            duration: `${duration}ms`,
            error: error.message,
            stack: error.stack,
        });
    }
    sanitizeLogData(data) {
        if (!data || typeof data !== 'object') {
            return data;
        }
        const sanitized = { ...data };
        const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'privateKey'];
        for (const field of sensitiveFields) {
            if (field in sanitized) {
                sanitized[field] = '[REDACTED]';
            }
        }
        return sanitized;
    }
    isRetryableError(error) {
        const nonRetryablePatterns = [
            /invalid/i,
            /not found/i,
            /unauthorized/i,
            /forbidden/i,
            /validation/i,
        ];
        return !nonRetryablePatterns.some(pattern => pattern.test(error.message));
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
export function createProcessorFunction(processor) {
    return async (job) => {
        return processor.execute(job);
    };
}
export default BaseJobProcessor;
