import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command, CopyObjectCommand, } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import logger from '../../../shared/utils/logger.js';
export class S3StorageProvider {
    client;
    defaultBucket;
    cdnDomain;
    region;
    constructor() {
        this.region = process.env.AWS_REGION || 'us-east-1';
        this.defaultBucket = process.env.AWS_S3_BUCKET || 'agrobridge-uploads';
        this.cdnDomain = process.env.AWS_CLOUDFRONT_DOMAIN || null;
        this.client = new S3Client({
            region: this.region,
            credentials: process.env.AWS_ACCESS_KEY_ID
                ? {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
                }
                : undefined,
        });
        logger.info({
            message: 'S3 Storage Provider initialized',
            meta: { bucket: this.defaultBucket, region: this.region },
        });
    }
    async upload(buffer, options) {
        const bucket = options.bucket || this.defaultBucket;
        try {
            const command = new PutObjectCommand({
                Bucket: bucket,
                Key: options.key,
                Body: buffer,
                ContentType: options.contentType || 'application/octet-stream',
                Metadata: options.metadata,
                CacheControl: options.cacheControl || 'max-age=31536000',
                ACL: options.acl,
                Tagging: options.tagging,
            });
            const result = await this.client.send(command);
            const s3Url = `https://${bucket}.s3.${this.region}.amazonaws.com/${options.key}`;
            const cdnUrl = this.cdnDomain
                ? `https://${this.cdnDomain}/${options.key}`
                : undefined;
            logger.info({
                message: 'File uploaded to S3',
                meta: { bucket, key: options.key, size: buffer.length },
            });
            return {
                url: s3Url,
                bucket,
                key: options.key,
                etag: result.ETag,
                versionId: result.VersionId,
                cdnUrl,
            };
        }
        catch (error) {
            logger.error({
                message: 'S3 upload failed',
                meta: { bucket, key: options.key, error: error.message },
            });
            throw error;
        }
    }
    async uploadStream(stream, options) {
        const bucket = options.bucket || this.defaultBucket;
        try {
            const command = new PutObjectCommand({
                Bucket: bucket,
                Key: options.key,
                Body: stream,
                ContentType: options.contentType || 'application/octet-stream',
                Metadata: options.metadata,
                CacheControl: options.cacheControl || 'max-age=31536000',
                ACL: options.acl,
            });
            const result = await this.client.send(command);
            const s3Url = `https://${bucket}.s3.${this.region}.amazonaws.com/${options.key}`;
            const cdnUrl = this.cdnDomain
                ? `https://${this.cdnDomain}/${options.key}`
                : undefined;
            return {
                url: s3Url,
                bucket,
                key: options.key,
                etag: result.ETag,
                versionId: result.VersionId,
                cdnUrl,
            };
        }
        catch (error) {
            logger.error({
                message: 'S3 stream upload failed',
                meta: { bucket, key: options.key, error: error.message },
            });
            throw error;
        }
    }
    async getPresignedUploadUrl(options) {
        const bucket = options.bucket || this.defaultBucket;
        const expiresIn = options.expiresIn || 3600;
        try {
            const putCommand = new PutObjectCommand({
                Bucket: bucket,
                Key: options.key,
                ContentType: options.contentType,
                Metadata: options.metadata,
            });
            const uploadUrl = await getSignedUrl(this.client, putCommand, {
                expiresIn,
            });
            const getCommand = new GetObjectCommand({
                Bucket: bucket,
                Key: options.key,
            });
            const downloadUrl = await getSignedUrl(this.client, getCommand, {
                expiresIn,
            });
            const expiresAt = new Date(Date.now() + expiresIn * 1000);
            logger.debug({
                message: 'Presigned URL generated',
                meta: { bucket, key: options.key, expiresIn },
            });
            return {
                uploadUrl,
                downloadUrl,
                bucket,
                key: options.key,
                expiresAt,
            };
        }
        catch (error) {
            logger.error({
                message: 'Failed to generate presigned URL',
                meta: { bucket, key: options.key, error: error.message },
            });
            throw error;
        }
    }
    async getPresignedDownloadUrl(key, bucket, expiresIn = 3600) {
        const targetBucket = bucket || this.defaultBucket;
        const command = new GetObjectCommand({
            Bucket: targetBucket,
            Key: key,
        });
        return getSignedUrl(this.client, command, { expiresIn });
    }
    async download(key, bucket) {
        const targetBucket = bucket || this.defaultBucket;
        try {
            const command = new GetObjectCommand({
                Bucket: targetBucket,
                Key: key,
            });
            const response = await this.client.send(command);
            const stream = response.Body;
            const chunks = [];
            for await (const chunk of stream) {
                chunks.push(Buffer.from(chunk));
            }
            return Buffer.concat(chunks);
        }
        catch (error) {
            logger.error({
                message: 'S3 download failed',
                meta: { bucket: targetBucket, key, error: error.message },
            });
            throw error;
        }
    }
    async delete(key, bucket) {
        const targetBucket = bucket || this.defaultBucket;
        try {
            const command = new DeleteObjectCommand({
                Bucket: targetBucket,
                Key: key,
            });
            await this.client.send(command);
            logger.info({
                message: 'File deleted from S3',
                meta: { bucket: targetBucket, key },
            });
        }
        catch (error) {
            logger.error({
                message: 'S3 delete failed',
                meta: { bucket: targetBucket, key, error: error.message },
            });
            throw error;
        }
    }
    async exists(key, bucket) {
        const targetBucket = bucket || this.defaultBucket;
        try {
            const command = new HeadObjectCommand({
                Bucket: targetBucket,
                Key: key,
            });
            await this.client.send(command);
            return true;
        }
        catch (error) {
            if (error.name === 'NotFound') {
                return false;
            }
            throw error;
        }
    }
    async getMetadata(key, bucket) {
        const targetBucket = bucket || this.defaultBucket;
        try {
            const command = new HeadObjectCommand({
                Bucket: targetBucket,
                Key: key,
            });
            const response = await this.client.send(command);
            const s3Url = `https://${targetBucket}.s3.${this.region}.amazonaws.com/${key}`;
            const cdnUrl = this.cdnDomain
                ? `https://${this.cdnDomain}/${key}`
                : undefined;
            return {
                key,
                bucket: targetBucket,
                size: response.ContentLength || 0,
                contentType: response.ContentType,
                lastModified: response.LastModified,
                etag: response.ETag,
                metadata: response.Metadata,
                url: s3Url,
                cdnUrl,
            };
        }
        catch (error) {
            logger.error({
                message: 'Failed to get S3 metadata',
                meta: { bucket: targetBucket, key, error: error.message },
            });
            throw error;
        }
    }
    async copy(sourceKey, destinationKey, bucket) {
        const targetBucket = bucket || this.defaultBucket;
        try {
            const command = new CopyObjectCommand({
                Bucket: targetBucket,
                CopySource: `${targetBucket}/${sourceKey}`,
                Key: destinationKey,
            });
            const result = await this.client.send(command);
            const s3Url = `https://${targetBucket}.s3.${this.region}.amazonaws.com/${destinationKey}`;
            const cdnUrl = this.cdnDomain
                ? `https://${this.cdnDomain}/${destinationKey}`
                : undefined;
            return {
                url: s3Url,
                bucket: targetBucket,
                key: destinationKey,
                etag: result.CopyObjectResult?.ETag,
                cdnUrl,
            };
        }
        catch (error) {
            logger.error({
                message: 'S3 copy failed',
                meta: {
                    bucket: targetBucket,
                    sourceKey,
                    destinationKey,
                    error: error.message,
                },
            });
            throw error;
        }
    }
    async list(prefix, bucket, maxKeys = 1000) {
        const targetBucket = bucket || this.defaultBucket;
        try {
            const command = new ListObjectsV2Command({
                Bucket: targetBucket,
                Prefix: prefix,
                MaxKeys: maxKeys,
            });
            const response = await this.client.send(command);
            return response.Contents?.map((item) => item.Key || '') || [];
        }
        catch (error) {
            logger.error({
                message: 'S3 list failed',
                meta: { bucket: targetBucket, prefix, error: error.message },
            });
            throw error;
        }
    }
    generateKey(filename, prefix = 'uploads') {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const extension = filename.split('.').pop() || '';
        const sanitizedName = filename
            .replace(/[^a-zA-Z0-9.-]/g, '_')
            .substring(0, 50);
        return `${prefix}/${timestamp}-${random}-${sanitizedName}`;
    }
    getPublicUrl(key, bucket) {
        if (this.cdnDomain) {
            return `https://${this.cdnDomain}/${key}`;
        }
        const targetBucket = bucket || this.defaultBucket;
        return `https://${targetBucket}.s3.${this.region}.amazonaws.com/${key}`;
    }
    getDefaultBucket() {
        return this.defaultBucket;
    }
}
export const s3StorageProvider = new S3StorageProvider();
export default s3StorageProvider;
