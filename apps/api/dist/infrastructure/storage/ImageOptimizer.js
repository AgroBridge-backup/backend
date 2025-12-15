import sharp from 'sharp';
import logger from '../../shared/utils/logger.js';
export const OptimizationPresets = {
    HIGH_QUALITY: {
        quality: 85,
        format: 'webp',
        stripMetadata: true,
        progressive: true,
    },
    MEDIUM_QUALITY: {
        quality: 75,
        format: 'webp',
        stripMetadata: true,
        progressive: true,
    },
    LOW_QUALITY: {
        quality: 60,
        format: 'webp',
        stripMetadata: true,
    },
    AVATAR: {
        width: 256,
        height: 256,
        fit: 'cover',
        quality: 80,
        format: 'webp',
        stripMetadata: true,
    },
    BATCH_PHOTO: {
        width: 1200,
        quality: 80,
        format: 'webp',
        stripMetadata: true,
        progressive: true,
    },
    CERTIFICATE: {
        width: 2000,
        quality: 90,
        format: 'png',
        stripMetadata: false,
    },
};
const RESPONSIVE_SIZES = {
    small: { width: 320, quality: 70 },
    medium: { width: 768, quality: 75 },
    large: { width: 1200, quality: 80 },
};
export class ImageOptimizer {
    async optimize(buffer, options = {}) {
        const { width, height, fit = 'inside', quality = 80, format = 'webp', stripMetadata = true, progressive = true, } = options;
        try {
            const originalSize = buffer.length;
            let pipeline = sharp(buffer);
            if (stripMetadata) {
                pipeline = pipeline.rotate();
            }
            if (width || height) {
                pipeline = pipeline.resize(width, height, { fit, withoutEnlargement: true });
            }
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
            const result = {
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
        }
        catch (error) {
            logger.error({
                message: 'Image optimization failed',
                meta: { error: error.message },
            });
            throw error;
        }
    }
    async generateThumbnail(buffer, options = { width: 200 }) {
        const { width, height, fit = 'cover', quality = 70, format = 'webp', } = options;
        try {
            let pipeline = sharp(buffer)
                .rotate()
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
        }
        catch (error) {
            logger.error({
                message: 'Thumbnail generation failed',
                meta: { error: error.message },
            });
            throw error;
        }
    }
    async generateResponsiveSet(buffer) {
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
        }
        catch (error) {
            logger.error({
                message: 'Responsive image generation failed',
                meta: { error: error.message },
            });
            throw error;
        }
    }
    async getMetadata(buffer) {
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
        }
        catch (error) {
            logger.error({
                message: 'Failed to get image metadata',
                meta: { error: error.message },
            });
            throw error;
        }
    }
    async convertFormat(buffer, format, quality = 80) {
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
    async optimizeAvatar(buffer) {
        return this.optimize(buffer, OptimizationPresets.AVATAR);
    }
    async optimizeBatchPhoto(buffer) {
        return this.optimize(buffer, OptimizationPresets.BATCH_PHOTO);
    }
    async optimizeCertificate(buffer) {
        return this.optimize(buffer, OptimizationPresets.CERTIFICATE);
    }
    async crop(buffer, width, height, position = 'center') {
        return sharp(buffer)
            .resize(width, height, { fit: 'cover', position })
            .toBuffer();
    }
    async rotate(buffer, angle) {
        return sharp(buffer).rotate(angle).toBuffer();
    }
    async blur(buffer, sigma = 10) {
        return sharp(buffer).blur(sigma).toBuffer();
    }
    async generatePlaceholder(buffer) {
        return sharp(buffer)
            .resize(20, 20, { fit: 'inside' })
            .blur(5)
            .webp({ quality: 20 })
            .toBuffer();
    }
}
export const imageOptimizer = new ImageOptimizer();
export default imageOptimizer;
