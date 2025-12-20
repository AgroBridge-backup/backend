/**
 * @file Storage Module Index
 * @description Central export point for the file storage infrastructure
 *
 * This module provides enterprise-grade file storage capabilities:
 * - AWS S3 integration with presigned URLs
 * - File validation (type, size, security)
 * - Image optimization with Sharp
 * - Thumbnail and responsive image generation
 *
 * @example
 * ```typescript
 * import { storageService } from './infrastructure/storage';
 *
 * // Upload with validation and optimization
 * const result = await storageService.upload(buffer, 'photo.jpg', 'image/jpeg', {
 *   type: 'batch_photo',
 *   optimize: true,
 *   generateThumbnail: true,
 * });
 *
 * // Get presigned URL for direct client upload
 * const presigned = await storageService.getPresignedUploadUrl({
 *   filename: 'document.pdf',
 *   contentType: 'application/pdf',
 *   type: 'certificate',
 * });
 * ```
 *
 * @author AgroBridge Engineering Team
 */

// ════════════════════════════════════════════════════════════════════════════════
// MAIN STORAGE SERVICE
// ════════════════════════════════════════════════════════════════════════════════
export {
  StorageService,
  storageService,
  type UploadType,
  type UploadOptions,
  type UploadResult,
  type PresignedUploadRequest,
} from './StorageService.js';

// ════════════════════════════════════════════════════════════════════════════════
// S3 STORAGE PROVIDER
// ════════════════════════════════════════════════════════════════════════════════
export {
  S3StorageProvider,
  s3StorageProvider,
  type S3UploadOptions,
  type S3UploadResult,
  type PresignedUrlOptions,
  type PresignedUrlResult,
  type S3FileMetadata,
} from './providers/S3StorageProvider.js';

// ════════════════════════════════════════════════════════════════════════════════
// FILE VALIDATOR
// ════════════════════════════════════════════════════════════════════════════════
export {
  FileValidator,
  fileValidator,
  FileTypeConfig,
  type FileValidationOptions,
  type FileValidationResult,
} from './FileValidator.js';

// ════════════════════════════════════════════════════════════════════════════════
// IMAGE OPTIMIZER
// ════════════════════════════════════════════════════════════════════════════════
export {
  ImageOptimizer,
  imageOptimizer,
  OptimizationPresets,
  type ImageOptimizationOptions,
  type ThumbnailOptions,
  type ResponsiveImageSizes,
  type OptimizationResult,
  type ImageMetadata,
} from './ImageOptimizer.js';
