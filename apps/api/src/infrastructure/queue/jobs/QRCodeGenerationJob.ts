/**
 * @file QR Code Generation Job
 * @description Async QR code generation for batch traceability
 *
 * Generates QR codes containing:
 * - Traceability URL for consumer scanning
 * - Batch identification data
 * - Optional metadata
 *
 * Process:
 * 1. Generate QR code as PNG buffer
 * 2. Upload to S3 via StorageService
 * 3. Update batch record with QR code URL
 *
 * @author AgroBridge Engineering Team
 */

import { Job } from "bull";
import QRCode from "qrcode";
import { PrismaClient } from "@prisma/client";
import { BaseJobProcessor } from "../processors/JobProcessor.js";
import { storageService } from "../../storage/StorageService.js";
import logger from "../../../shared/utils/logger.js";
import type { QRJobData, QRJobResult } from "../QueueService.js";

// Prisma client instance
const prisma = new PrismaClient();

/**
 * QR Code Generation Options
 */
interface QRGenerationOptions {
  /** QR code size in pixels */
  width: number;
  /** Error correction level */
  errorCorrectionLevel: "L" | "M" | "Q" | "H";
  /** Margin (quiet zone) modules */
  margin: number;
  /** Dark module color */
  color: {
    dark: string;
    light: string;
  };
}

/**
 * Default QR generation options
 */
const DEFAULT_QR_OPTIONS: QRGenerationOptions = {
  width: 400,
  errorCorrectionLevel: "H", // High - 30% error recovery
  margin: 2,
  color: {
    dark: "#1B5E20", // AgroBridge green
    light: "#FFFFFF",
  },
};

/**
 * QR Code Generation Job Processor
 *
 * Handles async generation of QR codes for batch traceability
 */
export class QRCodeGenerationJob extends BaseJobProcessor<
  QRJobData,
  QRJobResult
> {
  private options: QRGenerationOptions;

  constructor(options: Partial<QRGenerationOptions> = {}) {
    super("qr-generation");
    this.options = { ...DEFAULT_QR_OPTIONS, ...options };
  }

  /**
   * Process QR code generation job
   *
   * @param job - Bull job instance
   * @returns QR generation result
   */
  async process(job: Job<QRJobData>): Promise<QRJobResult> {
    const { batchId, data, userId } = job.data;

    try {
      // Step 1: Validate batch exists
      await this.reportProgress(job, 10, "Validating batch");
      const batch = await this.validateBatch(batchId);

      if (!batch) {
        return {
          success: false,
          batchId,
          error: `Batch not found: ${batchId}`,
        };
      }

      // Step 2: Generate QR code
      await this.reportProgress(job, 30, "Generating QR code");
      const qrBuffer = await this.generateQRCode(data);

      // Step 3: Upload to S3
      await this.reportProgress(job, 60, "Uploading to storage");
      const uploadResult = await this.uploadQRCode(qrBuffer, batchId);

      if (!uploadResult.success) {
        return {
          success: false,
          batchId,
          error: uploadResult.error || "Failed to upload QR code",
        };
      }

      // Step 4: Update batch record
      await this.reportProgress(job, 80, "Updating batch record");
      await this.updateBatchWithQRCode(
        batchId,
        uploadResult.url!,
        uploadResult.cdnUrl,
      );

      // Step 5: Complete
      await this.reportProgress(job, 100, "Complete");

      logger.info("[QRCodeGenerationJob] QR code generated successfully", {
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
    } catch (error) {
      const err = error as Error;
      logger.error("[QRCodeGenerationJob] Failed to generate QR code", {
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

  /**
   * Validate batch exists in database
   */
  private async validateBatch(batchId: string): Promise<{ id: string } | null> {
    try {
      const batch = await prisma.batch.findUnique({
        where: { id: batchId },
        select: { id: true },
      });
      return batch;
    } catch (error) {
      logger.error("[QRCodeGenerationJob] Error validating batch", {
        batchId,
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Generate QR code as PNG buffer
   */
  private async generateQRCode(data: string): Promise<Buffer> {
    const buffer = await QRCode.toBuffer(data, {
      type: "png",
      width: this.options.width,
      errorCorrectionLevel: this.options.errorCorrectionLevel,
      margin: this.options.margin,
      color: this.options.color,
    });

    logger.debug("[QRCodeGenerationJob] QR code generated", {
      dataLength: data.length,
      bufferSize: buffer.length,
    });

    return buffer;
  }

  /**
   * Upload QR code to S3
   */
  private async uploadQRCode(
    buffer: Buffer,
    batchId: string,
  ): Promise<{
    success: boolean;
    url?: string;
    cdnUrl?: string;
    error?: string;
  }> {
    try {
      const filename = `qr-${batchId}-${Date.now()}.png`;

      const result = await storageService.upload(
        buffer,
        filename,
        "image/png",
        {
          type: "image",
          optimize: false, // QR codes should not be optimized
          prefix: `qr-codes/${batchId}`,
          metadata: {
            batchId,
            type: "qr-code",
            generatedAt: new Date().toISOString(),
          },
        },
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Upload failed",
        };
      }

      return {
        success: true,
        url: result.file?.url,
        cdnUrl: result.file?.cdnUrl,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Log QR code URL for batch (batch model doesn't have qrCodeUrl field)
   * The URL is returned in the job result for the caller to handle
   */
  private async updateBatchWithQRCode(
    batchId: string,
    qrCodeUrl: string,
    cdnUrl?: string,
  ): Promise<void> {
    // Note: The Batch model doesn't have a qrCodeUrl field.
    // The QR code URL is returned in the job result.
    // If needed, add a qrCodeUrl field to the Batch model via migration.
    logger.info("[QRCodeGenerationJob] QR code URL generated for batch", {
      batchId,
      qrCodeUrl,
      cdnUrl,
      generatedAt: new Date().toISOString(),
    });
  }

  /**
   * Override onCompleted for custom completion logic
   */
  async onCompleted(job: Job<QRJobData>, result: QRJobResult): Promise<void> {
    await super.onCompleted(job, result);

    // Optional: Send callback if URL provided
    if (job.data.callbackUrl && result.success) {
      try {
        // Could implement webhook callback here
        logger.debug("[QRCodeGenerationJob] Callback URL provided", {
          callbackUrl: job.data.callbackUrl,
        });
      } catch (error) {
        logger.warn("[QRCodeGenerationJob] Callback failed", {
          error: (error as Error).message,
        });
      }
    }
  }

  /**
   * Override onFailed for custom failure handling
   */
  async onFailed(job: Job<QRJobData>, error: Error): Promise<void> {
    await super.onFailed(job, error);

    // Log to audit system
    logger.error("[QRCodeGenerationJob] Job failed permanently", {
      batchId: job.data.batchId,
      userId: job.data.userId,
      error: error.message,
      attempts: job.attemptsMade,
    });
  }
}

// Export singleton instance
export const qrCodeGenerationJob = new QRCodeGenerationJob();

export default qrCodeGenerationJob;
