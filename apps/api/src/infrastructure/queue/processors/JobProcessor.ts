/**
 * @file Base Job Processor
 * @description Generic job processor interface and base class with common utilities
 *
 * Provides:
 * - Type-safe processor interface
 * - Common logging and error handling
 * - Lifecycle hooks (onCompleted, onFailed, onProgress)
 * - Performance tracking
 *
 * @author AgroBridge Engineering Team
 */

import { Job } from 'bull';
import logger from '../../../shared/utils/logger.js';

/**
 * Job Processor Interface
 *
 * Defines the contract for all job processors
 */
export interface JobProcessor<TData, TResult> {
  /**
   * Process the job
   * @param job - Bull job instance
   * @returns Processing result
   */
  process(job: Job<TData>): Promise<TResult>;

  /**
   * Called when job completes successfully
   * @param job - Bull job instance
   * @param result - Processing result
   */
  onCompleted?(job: Job<TData>, result: TResult): Promise<void>;

  /**
   * Called when job fails (after all retries)
   * @param job - Bull job instance
   * @param error - Error that caused the failure
   */
  onFailed?(job: Job<TData>, error: Error): Promise<void>;

  /**
   * Called on job progress update
   * @param job - Bull job instance
   * @param progress - Progress percentage (0-100)
   */
  onProgress?(job: Job<TData>, progress: number): Promise<void>;
}

/**
 * Job Context
 *
 * Provides context information for logging and tracking
 */
export interface JobContext {
  jobId: string | number;
  queueName: string;
  attempt: number;
  maxAttempts: number;
  startTime: number;
}

/**
 * Base Job Processor
 *
 * Abstract base class providing common functionality for all job processors:
 * - Structured logging
 * - Error handling
 * - Performance tracking
 * - Progress reporting
 */
export abstract class BaseJobProcessor<TData, TResult> implements JobProcessor<TData, TResult> {
  /**
   * Queue name for logging context
   */
  protected readonly queueName: string;

  /**
   * Create a new BaseJobProcessor
   * @param queueName - Name of the queue this processor handles
   */
  constructor(queueName: string) {
    this.queueName = queueName;
  }

  /**
   * Process the job - must be implemented by subclasses
   * @param job - Bull job instance
   * @returns Processing result
   */
  abstract process(job: Job<TData>): Promise<TResult>;

  /**
   * Execute the job with standard logging and error handling
   *
   * This method wraps the process method with:
   * - Start/end logging
   * - Performance tracking
   * - Error handling
   *
   * @param job - Bull job instance
   * @returns Processing result
   */
  async execute(job: Job<TData>): Promise<TResult> {
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
    } catch (error) {
      const duration = Date.now() - startTime;
      const err = error as Error;

      this.logJobError(context, duration, err);

      if (this.onFailed && job.attemptsMade >= (job.opts.attempts || 3) - 1) {
        await this.onFailed(job, err);
      }

      throw error;
    }
  }

  /**
   * Called when job completes successfully
   * Default implementation logs the completion
   */
  async onCompleted(job: Job<TData>, result: TResult): Promise<void> {
    logger.info(`[${this.queueName}] Job completed`, {
      jobId: job.id,
      queueName: this.queueName,
    });
  }

  /**
   * Called when job fails after all retries
   * Default implementation logs the failure
   */
  async onFailed(job: Job<TData>, error: Error): Promise<void> {
    logger.error(`[${this.queueName}] Job failed permanently`, {
      jobId: job.id,
      queueName: this.queueName,
      error: error.message,
      stack: error.stack,
      attempts: job.attemptsMade,
    });
  }

  /**
   * Report job progress
   * @param job - Bull job instance
   * @param progress - Progress percentage (0-100)
   * @param message - Optional progress message
   */
  protected async reportProgress(
    job: Job<TData>,
    progress: number,
    message?: string
  ): Promise<void> {
    await job.progress(progress);

    logger.debug(`[${this.queueName}] Job progress`, {
      jobId: job.id,
      progress: `${progress}%`,
      message,
    });
  }

  /**
   * Create job context for logging
   */
  protected createContext(job: Job<TData>): JobContext {
    return {
      jobId: job.id,
      queueName: this.queueName,
      attempt: job.attemptsMade + 1,
      maxAttempts: job.opts.attempts || 3,
      startTime: Date.now(),
    };
  }

  /**
   * Log job start
   */
  protected logJobStart(context: JobContext, data: TData): void {
    logger.info(`[${this.queueName}] Job started`, {
      jobId: context.jobId,
      attempt: `${context.attempt}/${context.maxAttempts}`,
      data: this.sanitizeLogData(data),
    });
  }

  /**
   * Log job success
   */
  protected logJobSuccess(context: JobContext, duration: number, result: TResult): void {
    logger.info(`[${this.queueName}] Job succeeded`, {
      jobId: context.jobId,
      duration: `${duration}ms`,
      result: this.sanitizeLogData(result),
    });
  }

  /**
   * Log job error
   */
  protected logJobError(context: JobContext, duration: number, error: Error): void {
    logger.error(`[${this.queueName}] Job error`, {
      jobId: context.jobId,
      attempt: `${context.attempt}/${context.maxAttempts}`,
      duration: `${duration}ms`,
      error: error.message,
      stack: error.stack,
    });
  }

  /**
   * Sanitize data for logging (remove sensitive info)
   * Override in subclasses for custom sanitization
   */
  protected sanitizeLogData<T>(data: T): T {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sanitized = { ...data } as Record<string, unknown>;

    // Remove potentially sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'privateKey'];
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized as T;
  }

  /**
   * Check if error is retryable
   * Override in subclasses for custom retry logic
   */
  protected isRetryableError(error: Error): boolean {
    const nonRetryablePatterns = [
      /invalid/i,
      /not found/i,
      /unauthorized/i,
      /forbidden/i,
      /validation/i,
    ];

    return !nonRetryablePatterns.some(pattern => pattern.test(error.message));
  }

  /**
   * Delay helper for rate limiting
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Factory function to create a processor wrapper for Bull
 *
 * @param processor - Job processor instance
 * @returns Function suitable for Bull's process method
 */
export function createProcessorFunction<TData, TResult>(
  processor: BaseJobProcessor<TData, TResult>
): (job: Job<TData>) => Promise<TResult> {
  return async (job: Job<TData>) => {
    return processor.execute(job);
  };
}

export default BaseJobProcessor;
