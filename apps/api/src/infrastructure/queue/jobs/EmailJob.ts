/**
 * @file Email Job
 * @description Queue-based email sending via ResilientEmailService
 *
 * Supports:
 * - Template-based emails (welcome, password-reset, verification, etc.)
 * - Custom HTML emails
 * - Priority queuing
 * - Attachments
 * - Automatic failover (SendGrid -> SES)
 *
 * @author AgroBridge Engineering Team
 */

import { Job } from "bull";
import { BaseJobProcessor } from "../processors/JobProcessor.js";
import { resilientEmailService } from "../../notifications/services/ResilientEmailService.js";
import logger from "../../../shared/utils/logger.js";
import type { EmailJobData, EmailJobResult } from "../QueueService.js";

/**
 * Email Job Processor
 *
 * Handles queue-based email sending with automatic provider failover
 */
export class EmailJob extends BaseJobProcessor<EmailJobData, EmailJobResult> {
  constructor() {
    super("email");
  }

  /**
   * Process email job
   *
   * @param job - Bull job instance
   * @returns Email send result
   */
  async process(job: Job<EmailJobData>): Promise<EmailJobResult> {
    const { to, subject, template, data, html, attachments } = job.data;

    try {
      // Check email service availability
      if (!resilientEmailService.isAvailable()) {
        logger.warn("[EmailJob] Email service not available");
        return {
          success: false,
          error: "Email service not available",
          errorCode: "SERVICE_UNAVAILABLE",
        };
      }

      // Step 1: Prepare email
      await this.reportProgress(job, 20, "Preparing email");

      let result;

      // Step 2: Send based on template type
      await this.reportProgress(job, 50, "Sending email");

      switch (template) {
        case "welcome":
          result = await resilientEmailService.sendWelcomeEmail(
            to,
            data.name as string,
          );
          break;

        case "password-reset":
          result = await resilientEmailService.sendPasswordResetEmail(
            to,
            data.resetToken as string,
          );
          break;

        case "verification":
          result = await resilientEmailService.sendVerificationEmail(
            to,
            data.verificationToken as string,
          );
          break;

        case "2fa-code":
          result = await resilientEmailService.send2FACodeEmail(
            to,
            data.code as string,
          );
          break;

        case "batch-created":
          result = await resilientEmailService.sendBatchCreatedEmail(to, {
            batchId: data.batchId as string,
            variety: data.variety as string,
            origin: data.origin as string,
            weightKg: data.weightKg as number,
            harvestDate: data.harvestDate as Date,
            producerName: data.producerName as string,
            status: data.status as string,
          });
          break;

        case "custom":
          if (!html) {
            return {
              success: false,
              error: "HTML content required for custom template",
              errorCode: "MISSING_HTML",
            };
          }
          result = await resilientEmailService.sendEmail({
            to,
            subject,
            html,
            attachments: attachments?.map((att) => ({
              filename: att.filename,
              content: att.content,
              type: "application/octet-stream", // Default MIME type
              disposition: "attachment" as const,
            })),
          });
          break;

        default:
          return {
            success: false,
            error: `Unknown template: ${template}`,
            errorCode: "UNKNOWN_TEMPLATE",
          };
      }

      // Step 3: Process result
      await this.reportProgress(job, 100, "Complete");

      if (result.success) {
        logger.info("[EmailJob] Email sent successfully", {
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
      } else {
        logger.warn("[EmailJob] Email send failed", {
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
    } catch (error) {
      const err = error as Error;
      logger.error("[EmailJob] Email job failed", {
        to,
        template,
        error: err.message,
        stack: err.stack,
      });

      return {
        success: false,
        error: err.message,
        errorCode: "PROCESSING_ERROR",
      };
    }
  }

  /**
   * Sanitize email data for logging (hide sensitive info)
   */
  protected sanitizeLogData<T>(data: T): T {
    if (!data || typeof data !== "object") {
      return data;
    }

    const sanitized = { ...data } as Record<string, unknown>;

    // Redact sensitive fields
    const sensitiveFields = [
      "resetToken",
      "verificationToken",
      "code",
      "password",
      "token",
    ];

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = "[REDACTED]";
      }
    }

    // Also check nested data object
    if (sanitized.data && typeof sanitized.data === "object") {
      const nestedData = { ...(sanitized.data as Record<string, unknown>) };
      for (const field of sensitiveFields) {
        if (field in nestedData) {
          nestedData[field] = "[REDACTED]";
        }
      }
      sanitized.data = nestedData;
    }

    return sanitized as T;
  }

  /**
   * Determine if error is retryable
   */
  protected isRetryableError(error: Error): boolean {
    // Non-retryable email errors
    const nonRetryablePatterns = [
      /invalid.*email/i,
      /address.*rejected/i,
      /blacklisted/i,
      /unsubscribed/i,
      /spam/i,
    ];

    return !nonRetryablePatterns.some((pattern) => pattern.test(error.message));
  }

  /**
   * Override onCompleted for email-specific completion logic
   */
  async onCompleted(
    job: Job<EmailJobData>,
    result: EmailJobResult,
  ): Promise<void> {
    await super.onCompleted(job, result);

    // Could implement email tracking/analytics here
    logger.debug("[EmailJob] Email delivery tracked", {
      to: job.data.to,
      template: job.data.template,
      success: result.success,
      provider: result.provider,
    });
  }

  /**
   * Override onFailed for email-specific failure handling
   */
  async onFailed(job: Job<EmailJobData>, error: Error): Promise<void> {
    await super.onFailed(job, error);

    // Log failed email for monitoring
    logger.error("[EmailJob] Email delivery failed permanently", {
      to: job.data.to,
      template: job.data.template,
      subject: job.data.subject,
      error: error.message,
      attempts: job.attemptsMade,
    });

    // Could implement alerting or fallback notification here
  }
}

// Export singleton instance
export const emailJob = new EmailJob();

export default emailJob;
