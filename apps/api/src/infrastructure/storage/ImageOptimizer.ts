/**
 * @file Image Optimizer Service
 * @description Optimizes images for web delivery using Sharp
 *
 * Features:
 * - Automatic format conversion (WebP, AVIF)
 * - Responsive image generation
 * - Thumbnail creation
 * - Quality optimization
 * - Metadata stripping for privacy
 *
 * @author AgroBridge Engineering Team
 */

import sharp, { Sharp, FitEnum } from 'sharp';
import logger from '../../shared/utils/logger.js';

/**
 * Image optimization options
 */
export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  fit?: keyof FitEnum;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp' | 'avif';
  stripMetadata?: boolean;
  progressive?: boolean;
}

/**
 * Thumbnail options
 */
export interface ThumbnailOptions {
  width: number;
  height?: number;
  fit?: keyof FitEnum;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

/**
 * Responsive image sizes
 */
export interface ResponsiveImageSizes {
  small: Buffer;
  medium: Buffer;
  large: Buffer;
  original: Buffer;
}

/**
 * Optimization result
 */
export interface OptimizationResult {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
  size: number;
  compressionRatio?: number;
}

/**
 * Image metadata
 */
export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  space: string;
  channels: number;
  hasAlpha: boolean;
  size: number;
}

/**
 * Default optimization presets
 */
export const OptimizationPresets = {
  /** High quality for hero images */
  HIGH_QUALITY: {
    quality: 85,
    format: 'webp' as const,
    stripMetadata: true,
    progressive: true,
  },
  /** Medium quality for general use */
  MEDIUM_QUALITY: {
    quality: 75,
    format: 'webp' as const,
    stripMetadata: true,
    progressive: true,
  },
  /** Low quality for thumbnails */
  LOW_QUALITY: {
    quality: 60,
    format: 'webp' as const,
    stripMetadata: true,
  },
  /** Avatar preset */
  AVATAR: {
    width: 256,
    height: 256,
    fit: 'cover' as const,
    quality: 80,
    format: 'webp' as const,
    stripMetadata: true,
  },
  /** Batch photo preset */
  BATCH_PHOTO: {
    width: 1200,
    quality: 80,
    format: 'webp' as const,
    stripMetadata: true,
    progressive: true,
  },
  /** Certificate scan preset */
  CERTIFICATE: {
    width: 2000,
    quality: 90,
    format: 'png' as const,
    stripMetadata: false, // Keep metadata for certificates
  },
} as const;

/**
 * Responsive image dimensions
 */
const RESPONSIVE_SIZES = {
  small: { width: 320, quality: 70 },
  medium: { width: 768, quality: 75 },
  large: { width: 1200, quality: 80 },
};

/**
 * Image Optimizer Service
 *
 * Provides comprehensive image optimization using Sharp library.
 * Supports format conversion, resizing, thumbnails, and responsive images.
 */
export class ImageOptimizer {
  /**
   * Optimize an image with specified options
   *
   * @param buffer - Input image buffer
   * @param options - Optimization options
   * @returns Optimized image result
   */
  async optimize(
    buffer: Buffer,
    options: ImageOptimizationOptions = {}
  ): Promise<OptimizationResult> {
    const {
      width,
      height,
      fit = 'inside',
      quality = 80,
      format = 'webp',
      stripMetadata = true,
      progressive = true,
    } = options;

    try {
      const originalSize = buffer.length;
      let pipeline: Sharp = sharp(buffer);

      // Strip metadata if requested
      if (stripMetadata) {
        pipeline = pipeline.rotate(); // Auto-rotate based on EXIF then strip
      }

      // Resize if dimensions specified
      if (width || height) {
        pipeline = pipeline.resize(width, height, { fit, withoutEnlargement: true });
      }

      // Convert format
      switch (format) {
        case 'jpeg':
          pipeline = pipeline.jpeg({ quality, progressive });
          break;
        case 'png':
          pipeline = pipeline.png({ compressionLevel: Math.round((100 - quality) / 10) });
          break;
        case 'webp':
          pipeline = pipeline.webp({ quality });
          break;
        case 'avif':
          pipeline = pipeline.avif({ quality });
          break;
      }

      const outputBuffer = await pipeline.toBuffer();
      const metadata = await sharp(outputBuffer).metadata();

      const result: OptimizationResult = {
        buffer: outputBuffer,
        width: metadata.width || 0,
        height: metadata.height || 0,
        format,
        size: outputBuffer.length,
        compressionRatio: originalSize > 0 ? outputBuffer.length / originalSize : 1,
      };

      logger.debug({
        message: 'Image optimized',
        meta: {
          originalSize,
          newSize: result.size,
          compressionRatio: result.compressionRatio?.toFixed(2),
          format,
        },
      });

      return result;
    } catch (error) {
      logger.error({
        message: 'Image optimization failed',
        meta: { error: (error as Error).message },
      });
      throw error;
    }
  }

  /**
   * Generate a thumbnail
   *
   * @param buffer - Input image buffer
   * @param options - Thumbnail options
   * @returns Thumbnail buffer
   */
  async generateThumbnail(
    buffer: Buffer,
    options: ThumbnailOptions = { width: 200 }
  ): Promise<Buffer> {
    const {
      width,
      height,
      fit = 'cover',
      quality = 70,
      format = 'webp',
    } = options;

    try {
      let pipeline = sharp(buffer)
        .rotate() // Auto-rotate based on EXIF
        .resize(width, height, { fit, withoutEnlargement: true });

      switch (format) {
        case 'jpeg':
          pipeline = pipeline.jpeg({ quality });
          break;
        case 'png':
          pipeline = pipeline.png({ compressionLevel: 6 });
          break;
        case 'webp':
          pipeline = pipeline.webp({ quality });
          break;
      }

      return pipeline.toBuffer();
    } catch (error) {
      logger.error({
        message: 'Thumbnail generation failed',
        meta: { error: (error as Error).message },
      });
      throw error;
    }
  }

  /**
   * Generate responsive image set
   *
   * @param buffer - Input image buffer
   * @returns Responsive image buffers
   */
  async generateResponsiveSet(buffer: Buffer): Promise<ResponsiveImageSizes> {
    try {
      const [small, medium, large, original] = await Promise.all([
        this.optimize(buffer, {
          width: RESPONSIVE_SIZES.small.width,
          quality: RESPONSIVE_SIZES.small.quality,
          format: 'webp',
        }),
        this.optimize(buffer, {
          width: RESPONSIVE_SIZES.medium.width,
          quality: RESPONSIVE_SIZES.medium.quality,
          format: 'webp',
        }),
        this.optimize(buffer, {
          width: RESPONSIVE_SIZES.large.width,
          quality: RESPONSIVE_SIZES.large.quality,
          format: 'webp',
        }),
        this.optimize(buffer, {
          quality: 85,
          format: 'webp',
        }),
      ]);

      return {
        small: small.buffer,
        medium: medium.buffer,
        large: large.buffer,
        original: original.buffer,
      };
    } catch (error) {
      logger.error({
        message: 'Responsive image generation failed',
        meta: { error: (error as Error).message },
      });
      throw error;
    }
  }

  /**
   * Get image metadata
   *
   * @param buffer - Image buffer
   * @returns Image metadata
   */
  async getMetadata(buffer: Buffer): Promise<ImageMetadata> {
    try {
      const metadata = await sharp(buffer).metadata();

      return {
        width: metadata.width || 0,
        height: metadata.height || 0,
        format: metadata.format || 'unknown',
        space: metadata.space || 'unknown',
        channels: metadata.channels || 0,
        hasAlpha: metadata.hasAlpha || false,
        size: buffer.length,
      };
    } catch (error) {
      logger.error({
        message: 'Failed to get image metadata',
        meta: { error: (error as Error).message },
      });
      throw error;
    }
  }

  /**
   * Convert image format
   *
   * @param buffer - Input image buffer
   * @param format - Target format
   * @param quality - Quality (0-100)
   * @returns Converted image buffer
   */
  async convertFormat(
    buffer: Buffer,
    format: 'jpeg' | 'png' | 'webp' | 'avif',
    quality: number = 80
  ): Promise<Buffer> {
    let pipeline = sharp(buffer);

    switch (format) {
      case 'jpeg':
        pipeline = pipeline.jpeg({ quality });
        break;
      case 'png':
        pipeline = pipeline.png({ compressionLevel: Math.round((100 - quality) / 10) });
        break;
      case 'webp':
        pipeline = pipeline.webp({ quality });
        break;
      case 'avif':
        pipeline = pipeline.avif({ quality });
        break;
    }

    return pipeline.toBuffer();
  }

  /**
   * Optimize avatar image
   *
   * @param buffer - Input image buffer
   * @returns Optimized avatar buffer
   */
  async optimizeAvatar(buffer: Buffer): Promise<OptimizationResult> {
    return this.optimize(buffer, OptimizationPresets.AVATAR);
  }

  /**
   * Optimize batch photo
   *
   * @param buffer - Input image buffer
   * @returns Optimized batch photo buffer
   */
  async optimizeBatchPhoto(buffer: Buffer): Promise<OptimizationResult> {
    return this.optimize(buffer, OptimizationPresets.BATCH_PHOTO);
  }

  /**
   * Optimize certificate image
   *
   * @param buffer - Input image buffer
   * @returns Optimized certificate buffer
   */
  async optimizeCertificate(buffer: Buffer): Promise<OptimizationResult> {
    return this.optimize(buffer, OptimizationPresets.CERTIFICATE);
  }

  /**
   * Crop image to specific dimensions
   *
   * @param buffer - Input image buffer
   * @param width - Target width
   * @param height - Target height
   * @param position - Crop position
   * @returns Cropped image buffer
   */
  async crop(
    buffer: Buffer,
    width: number,
    height: number,
    position: 'center' | 'top' | 'bottom' | 'left' | 'right' = 'center'
  ): Promise<Buffer> {
    return sharp(buffer)
      .resize(width, height, { fit: 'cover', position })
      .toBuffer();
  }

  /**
   * Rotate image
   *
   * @param buffer - Input image buffer
   * @param angle - Rotation angle (90, 180, 270)
   * @returns Rotated image buffer
   */
  async rotate(buffer: Buffer, angle: 90 | 180 | 270): Promise<Buffer> {
    return sharp(buffer).rotate(angle).toBuffer();
  }

  /**
   * Blur image (for privacy/placeholder)
   *
   * @param buffer - Input image buffer
   * @param sigma - Blur sigma (0.3-1000)
   * @returns Blurred image buffer
   */
  async blur(buffer: Buffer, sigma: number = 10): Promise<Buffer> {
    return sharp(buffer).blur(sigma).toBuffer();
  }

  /**
   * Generate placeholder blur hash
   *
   * @param buffer - Input image buffer
   * @returns Tiny blurred placeholder buffer
   */
  async generatePlaceholder(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
      .resize(20, 20, { fit: 'inside' })
      .blur(5)
      .webp({ quality: 20 })
      .toBuffer();
  }
}

/**
 * Singleton instance of the Image Optimizer
 */
export const imageOptimizer = new ImageOptimizer();

export default imageOptimizer;
