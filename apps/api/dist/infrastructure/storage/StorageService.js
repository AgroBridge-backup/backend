import logger from '../../shared/utils/logger.js';
import { s3StorageProvider, } from './providers/S3StorageProvider.js';
import { fileValidator, FileTypeConfig } from './FileValidator.js';
import { imageOptimizer, } from './ImageOptimizer.js';
export class StorageService {
    storage;
    validator;
    optimizer;
    constructor(storage = s3StorageProvider, validator = fileValidator, optimizer = imageOptimizer) {
        this.storage = storage;
        this.validator = validator;
        this.optimizer = optimizer;
    }
    async upload(buffer, filename, contentType, options = {}) {
        const { type = 'general', optimize = true, generateThumbnail = false, generateResponsive = false, prefix = 'uploads', metadata = {}, } = options;
        try {
            const validation = this.validateByType(buffer, filename, type);
            if (!validation.valid) {
                return {
                    success: false,
                    validation,
                    error: validation.errors.join('; '),
                };
            }
            const isImage = contentType.startsWith('image/');
            let uploadBuffer = buffer;
            let finalContentType = contentType;
            if (isImage && optimize) {
                const optimized = await this.optimizeByType(buffer, type);
                uploadBuffer = optimized.buffer;
                finalContentType = `image/${optimized.format}`;
            }
            const sanitizedFilename = validation.sanitizedFilename || filename;
            const key = this.storage.generateKey(sanitizedFilename, prefix);
            const uploadResult = await this.storage.upload(uploadBuffer, {
                key,
                contentType: finalContentType,
                metadata: {
                    ...metadata,
                    originalFilename: filename,
                    uploadType: type,
                },
            });
            const result = {
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
            if (isImage && generateThumbnail) {
                const thumbnailKey = key.replace(/(\.[^.]+)$/, '_thumb$1');
                const thumbnail = await this.optimizer.generateThumbnail(buffer, {
                    width: 200,
                    height: 200,
                });
                await this.storage.upload(thumbnail, {
                    key: thumbnailKey,
                    contentType: 'image/webp',
                });
                result.thumbnail = {
                    url: this.storage.getPublicUrl(thumbnailKey),
                    key: thumbnailKey,
                };
            }
            if (isImage && generateResponsive) {
                const responsiveSet = await this.optimizer.generateResponsiveSet(buffer);
                const baseKey = key.replace(/(\.[^.]+)$/, '');
                const [smallResult, mediumResult, largeResult] = await Promise.all([
                    this.storage.upload(responsiveSet.small, {
                        key: `${baseKey}_small.webp`,
                        contentType: 'image/webp',
                    }),
                    this.storage.upload(responsiveSet.medium, {
                        key: `${baseKey}_medium.webp`,
                        contentType: 'image/webp',
                    }),
                    this.storage.upload(responsiveSet.large, {
                        key: `${baseKey}_large.webp`,
                        contentType: 'image/webp',
                    }),
                ]);
                result.responsive = {
                    small: { url: smallResult.url, key: smallResult.key },
                    medium: { url: mediumResult.url, key: mediumResult.key },
                    large: { url: largeResult.url, key: largeResult.key },
                };
            }
            logger.info({
                message: 'File uploaded successfully',
                meta: { key, type, size: uploadBuffer.length },
            });
            return result;
        }
        catch (error) {
            logger.error({
                message: 'File upload failed',
                meta: { filename, type, error: error.message },
            });
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async uploadAvatar(buffer, filename, userId) {
        return this.upload(buffer, filename, 'image/jpeg', {
            type: 'avatar',
            optimize: true,
            generateThumbnail: true,
            prefix: `avatars/${userId}`,
        });
    }
    async uploadBatchPhoto(buffer, filename, batchId) {
        return this.upload(buffer, filename, 'image/jpeg', {
            type: 'batch_photo',
            optimize: true,
            generateThumbnail: true,
            generateResponsive: true,
            prefix: `batches/${batchId}`,
        });
    }
    async uploadCertificate(buffer, filename, producerId, contentType) {
        return this.upload(buffer, filename, contentType, {
            type: 'certificate',
            optimize: contentType.startsWith('image/'),
            prefix: `certificates/${producerId}`,
        });
    }
    async getPresignedUploadUrl(request) {
        const { filename, contentType, type = 'general', prefix = 'uploads', expiresIn = 3600, metadata, } = request;
        const validation = this.preValidate(filename, contentType, type);
        const key = this.storage.generateKey(filename, prefix);
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
    async getPresignedDownloadUrl(key, expiresIn = 3600) {
        return this.storage.getPresignedDownloadUrl(key, undefined, expiresIn);
    }
    async delete(key) {
        await this.storage.delete(key);
    }
    async deleteWithVariants(key) {
        const baseKey = key.replace(/(\.[^.]+)$/, '');
        const extension = key.match(/\.[^.]+$/)?.[0] || '';
        const keysToDelete = [
            key,
            `${baseKey}_thumb${extension}`,
            `${baseKey}_small.webp`,
            `${baseKey}_medium.webp`,
            `${baseKey}_large.webp`,
        ];
        await Promise.all(keysToDelete.map(async (k) => {
            try {
                if (await this.storage.exists(k)) {
                    await this.storage.delete(k);
                }
            }
            catch {
            }
        }));
    }
    async getMetadata(key) {
        return this.storage.getMetadata(key);
    }
    async exists(key) {
        return this.storage.exists(key);
    }
    async download(key) {
        return this.storage.download(key);
    }
    validateByType(buffer, filename, type) {
        switch (type) {
            case 'image':
            case 'batch_photo':
                return this.validator.validateImage(buffer, filename);
            case 'document':
                return this.validator.validateDocument(buffer, filename);
            case 'certificate':
                return this.validator.validateCertificate(buffer, filename);
            case 'avatar':
                return this.validator.validateAvatar(buffer, filename);
            default:
                return this.validator.validate(buffer, filename);
        }
    }
    preValidate(filename, contentType, type) {
        const errors = [];
        const configs = {
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
        if (config.allowedMimeTypes && !config.allowedMimeTypes.includes(contentType)) {
            errors.push(`Content type "${contentType}" not allowed. Allowed: ${config.allowedMimeTypes.join(', ')}`);
        }
        const extension = filename.match(/\.[^.]+$/)?.[0].toLowerCase() || '';
        if (config.allowedExtensions && !config.allowedExtensions.includes(extension)) {
            errors.push(`Extension "${extension}" not allowed. Allowed: ${config.allowedExtensions.join(', ')}`);
        }
        return {
            valid: errors.length === 0,
            errors,
        };
    }
    async optimizeByType(buffer, type) {
        switch (type) {
            case 'avatar':
                return this.optimizer.optimizeAvatar(buffer);
            case 'batch_photo':
                return this.optimizer.optimizeBatchPhoto(buffer);
            case 'certificate':
                return this.optimizer.optimizeCertificate(buffer);
            default:
                return this.optimizer.optimize(buffer);
        }
    }
}
export const storageService = new StorageService();
export default storageService;
