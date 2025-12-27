/**
 * @file Storage Service
 * @description Unified storage service combining S3, validation, and optimization
 *
 * Provides a single entry point for file operations:
 * - Upload with automatic validation and optimization
 * - Presigned URLs for direct client uploads
 * - Thumbnail and responsive image generation
 * - File metadata and retrieval
 *
 * @author AgroBridge Engineering Team
 */

import logger from "../../shared/utils/logger.js";
import {
  s3StorageProvider,
  S3StorageProvider,
  type S3UploadResult,
  type PresignedUrlResult,
  type S3FileMetadata,
} from "./providers/S3StorageProvider.js";
import {
  fileValidator,
  FileValidator,
  FileTypeConfig,
  type FileValidationOptions,
} from "./FileValidator.js";
import {
  imageOptimizer,
  ImageOptimizer,
  type OptimizationResult,
  type ResponsiveImageSizes,
} from "./ImageOptimizer.js";

/**
 * Upload types for different use cases
 */
export type UploadType =
  | "image"
  | "document"
  | "certificate"
  | "avatar"
  | "batch_photo"
  | "general";

/**
 * Upload options
 */
export interface UploadOptions {
  type?: UploadType;
  optimize?: boolean;
  generateThumbnail?: boolean;
  generateResponsive?: boolean;
  prefix?: string;
  metadata?: Record<string, string>;
}

/**
 * Upload result
 */
export interface UploadResult {
  success: boolean;
  file?: {
    url: string;
    cdnUrl?: string;
    bucket: string;
    key: string;
    size: number;
    contentType: string;
    metadata?: Record<string, string>;
  };
  thumbnail?: {
    url: string;
    key: string;
  };
  responsive?: {
    small: { url: string; key: string };
    medium: { url: string; key: string };
    large: { url: string; key: string };
  };
  validation?: {
    valid: boolean;
    errors: string[];
  };
  error?: string;
}

/**
 * Presigned upload request
 */
export interface PresignedUploadRequest {
  filename: string;
  contentType: string;
  type?: UploadType;
  prefix?: string;
  expiresIn?: number;
  metadata?: Record<string, string>;
}

/**
 * Storage Service
 *
 * Unified service for file storage operations combining:
 * - S3 storage provider
 * - File validation
 * - Image optimization
 */
export class StorageService {
  constructor(
    private storage: S3StorageProvider = s3StorageProvider,
    private validator: FileValidator = fileValidator,
    private optimizer: ImageOptimizer = imageOptimizer,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════════
  // UPLOAD OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Upload a file with validation and optional optimization
   *
   * @param buffer - File buffer
   * @param filename - Original filename
   * @param contentType - MIME type
   * @param options - Upload options
   * @returns Upload result
   */
  async upload(
    buffer: Buffer,
    filename: string,
    contentType: string,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    const {
      type = "general",
      optimize = true,
      generateThumbnail = false,
      generateResponsive = false,
      prefix = "uploads",
      metadata = {},
    } = options;

    try {
      // Validate file
      const validation = this.validateByType(buffer, filename, type);
      if (!validation.valid) {
        return {
          success: false,
          validation,
          error: validation.errors.join("; "),
        };
      }

      // Determine if this is an image
      const isImage = contentType.startsWith("image/");

      // Optimize image if applicable
      let uploadBuffer = buffer;
      let finalContentType = contentType;

      if (isImage && optimize) {
        const optimized = await this.optimizeByType(buffer, type);
        uploadBuffer = optimized.buffer;
        finalContentType = `image/${optimized.format}`;
      }

      // Generate key
      const sanitizedFilename = validation.sanitizedFilename || filename;
      const key = this.storage.generateKey(sanitizedFilename, prefix);

      // Upload main file
      const uploadResult = await this.storage.upload(uploadBuffer, {
        key,
        contentType: finalContentType,
        metadata: {
          ...metadata,
          originalFilename: filename,
          uploadType: type,
        },
      });

      const result: UploadResult = {
        success: true,
        file: {
          url: uploadResult.url,
          cdnUrl: uploadResult.cdnUrl,
          bucket: uploadResult.bucket,
          key: uploadResult.key,
          size: uploadBuffer.length,
          contentType: finalContentType,
          metadata,
        },
        validation,
      };

      // Generate thumbnail if requested
      if (isImage && generateThumbnail) {
        const thumbnailKey = key.replace(/(\.[^.]+)$/, "_thumb$1");
        const thumbnail = await this.optimizer.generateThumbnail(buffer, {
          width: 200,
          height: 200,
        });

        await this.storage.upload(thumbnail, {
          key: thumbnailKey,
          contentType: "image/webp",
        });

        result.thumbnail = {
          url: this.storage.getPublicUrl(thumbnailKey),
          key: thumbnailKey,
        };
      }

      // Generate responsive images if requested
      if (isImage && generateResponsive) {
        const responsiveSet =
          await this.optimizer.generateResponsiveSet(buffer);
        const baseKey = key.replace(/(\.[^.]+)$/, "");

        const [smallResult, mediumResult, largeResult] = await Promise.all([
          this.storage.upload(responsiveSet.small, {
            key: `${baseKey}_small.webp`,
            contentType: "image/webp",
          }),
          this.storage.upload(responsiveSet.medium, {
            key: `${baseKey}_medium.webp`,
            contentType: "image/webp",
          }),
          this.storage.upload(responsiveSet.large, {
            key: `${baseKey}_large.webp`,
            contentType: "image/webp",
          }),
        ]);

        result.responsive = {
          small: { url: smallResult.url, key: smallResult.key },
          medium: { url: mediumResult.url, key: mediumResult.key },
          large: { url: largeResult.url, key: largeResult.key },
        };
      }

      logger.info({
        message: "File uploaded successfully",
        meta: { key, type, size: uploadBuffer.length },
      });

      return result;
    } catch (error) {
      logger.error({
        message: "File upload failed",
        meta: { filename, type, error: (error as Error).message },
      });

      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Upload an avatar image
   *
   * @param buffer - Image buffer
   * @param filename - Original filename
   * @param userId - User ID for path organization
   * @returns Upload result
   */
  async uploadAvatar(
    buffer: Buffer,
    filename: string,
    userId: string,
  ): Promise<UploadResult> {
    return this.upload(buffer, filename, "image/jpeg", {
      type: "avatar",
      optimize: true,
      generateThumbnail: true,
      prefix: `avatars/${userId}`,
    });
  }

  /**
   * Upload a batch photo
   *
   * @param buffer - Image buffer
   * @param filename - Original filename
   * @param batchId - Batch ID for path organization
   * @returns Upload result
   */
  async uploadBatchPhoto(
    buffer: Buffer,
    filename: string,
    batchId: string,
  ): Promise<UploadResult> {
    return this.upload(buffer, filename, "image/jpeg", {
      type: "batch_photo",
      optimize: true,
      generateThumbnail: true,
      generateResponsive: true,
      prefix: `batches/${batchId}`,
    });
  }

  /**
   * Upload a certificate document
   *
   * @param buffer - Document buffer
   * @param filename - Original filename
   * @param producerId - Producer ID for path organization
   * @returns Upload result
   */
  async uploadCertificate(
    buffer: Buffer,
    filename: string,
    producerId: string,
    contentType: string,
  ): Promise<UploadResult> {
    return this.upload(buffer, filename, contentType, {
      type: "certificate",
      optimize: contentType.startsWith("image/"),
      prefix: `certificates/${producerId}`,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRESIGNED URLS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Get presigned URL for direct client upload
   *
   * @param request - Presigned upload request
   * @returns Presigned URL result
   */
  async getPresignedUploadUrl(
    request: PresignedUploadRequest,
  ): Promise<
    PresignedUrlResult & { validation: { valid: boolean; errors: string[] } }
  > {
    const {
      filename,
      contentType,
      type = "general",
      prefix = "uploads",
      expiresIn = 3600,
      metadata,
    } = request;

    // Pre-validate based on type
    const validation = this.preValidate(filename, contentType, type);

    // Generate key
    const key = this.storage.generateKey(filename, prefix);

    // Get presigned URL
    const presigned = await this.storage.getPresignedUploadUrl({
      key,
      contentType,
      expiresIn,
      metadata,
    });

    return {
      ...presigned,
      validation,
    };
  }

  /**
   * Get presigned download URL
   *
   * @param key - S3 object key
   * @param expiresIn - Expiration time in seconds
   * @returns Presigned download URL
   */
  async getPresignedDownloadUrl(
    key: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    return this.storage.getPresignedDownloadUrl(key, undefined, expiresIn);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // FILE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Delete a file
   *
   * @param key - S3 object key
   */
  async delete(key: string): Promise<void> {
    await this.storage.delete(key);
  }

  /**
   * Delete file with its variants (thumbnails, responsive)
   *
   * @param key - Main file S3 key
   */
  async deleteWithVariants(key: string): Promise<void> {
    const baseKey = key.replace(/(\.[^.]+)$/, "");
    const extension = key.match(/\.[^.]+$/)?.[0] || "";

    const keysToDelete = [
      key, // Original
      `${baseKey}_thumb${extension}`, // Thumbnail
      `${baseKey}_small.webp`, // Responsive
      `${baseKey}_medium.webp`,
      `${baseKey}_large.webp`,
    ];

    await Promise.all(
      keysToDelete.map(async (k) => {
        try {
          if (await this.storage.exists(k)) {
            await this.storage.delete(k);
          }
        } catch {
          // Ignore errors for non-existent files
        }
      }),
    );
  }

  /**
   * Get file metadata
   *
   * @param key - S3 object key
   * @returns File metadata
   */
  async getMetadata(key: string): Promise<S3FileMetadata> {
    return this.storage.getMetadata(key);
  }

  /**
   * Check if file exists
   *
   * @param key - S3 object key
   * @returns True if exists
   */
  async exists(key: string): Promise<boolean> {
    return this.storage.exists(key);
  }

  /**
   * Download a file
   *
   * @param key - S3 object key
   * @returns File buffer
   */
  async download(key: string): Promise<Buffer> {
    return this.storage.download(key);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Validate file based on upload type
   */
  private validateByType(buffer: Buffer, filename: string, type: UploadType) {
    switch (type) {
      case "image":
      case "batch_photo":
        return this.validator.validateImage(buffer, filename);
      case "document":
        return this.validator.validateDocument(buffer, filename);
      case "certificate":
        return this.validator.validateCertificate(buffer, filename);
      case "avatar":
        return this.validator.validateAvatar(buffer, filename);
      default:
        return this.validator.validate(buffer, filename);
    }
  }

  /**
   * Pre-validate without buffer (for presigned URLs)
   */
  private preValidate(
    filename: string,
    contentType: string,
    type: UploadType,
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Get config for type
    const configs: Record<UploadType, FileValidationOptions | null> = {
      image: FileTypeConfig.IMAGE,
      batch_photo: FileTypeConfig.IMAGE,
      avatar: FileTypeConfig.AVATAR,
      certificate: FileTypeConfig.CERTIFICATE,
      document: FileTypeConfig.DOCUMENT,
      general: null,
    };

    const config = configs[type];
    if (!config) {
      return { valid: true, errors: [] };
    }

    // Check content type
    if (
      config.allowedMimeTypes &&
      !config.allowedMimeTypes.includes(contentType)
    ) {
      errors.push(
        `Content type "${contentType}" not allowed. Allowed: ${config.allowedMimeTypes.join(", ")}`,
      );
    }

    // Check extension
    const extension = filename.match(/\.[^.]+$/)?.[0].toLowerCase() || "";
    if (
      config.allowedExtensions &&
      !config.allowedExtensions.includes(extension)
    ) {
      errors.push(
        `Extension "${extension}" not allowed. Allowed: ${config.allowedExtensions.join(", ")}`,
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Optimize image based on upload type
   */
  private async optimizeByType(
    buffer: Buffer,
    type: UploadType,
  ): Promise<OptimizationResult> {
    switch (type) {
      case "avatar":
        return this.optimizer.optimizeAvatar(buffer);
      case "batch_photo":
        return this.optimizer.optimizeBatchPhoto(buffer);
      case "certificate":
        return this.optimizer.optimizeCertificate(buffer);
      default:
        return this.optimizer.optimize(buffer);
    }
  }
}

/**
 * Singleton instance of the Storage Service
 */
export const storageService = new StorageService();

export default storageService;
