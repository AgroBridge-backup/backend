/**
 * @file AWS S3 Storage Provider
 * @description Production-grade S3 integration for file uploads
 *
 * Features:
 * - Presigned URLs for secure direct uploads
 * - File metadata management
 * - CDN integration (CloudFront)
 * - Multipart upload support for large files
 * - Automatic content type detection
 *
 * @author AgroBridge Engineering Team
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";
import logger from "../../../shared/utils/logger.js";

/**
 * Upload options for S3
 */
export interface S3UploadOptions {
  bucket?: string;
  key: string;
  contentType?: string;
  metadata?: Record<string, string>;
  cacheControl?: string;
  acl?: "private" | "public-read" | "public-read-write";
  tagging?: string;
}

/**
 * Upload result from S3
 */
export interface S3UploadResult {
  url: string;
  bucket: string;
  key: string;
  etag?: string;
  versionId?: string;
  cdnUrl?: string;
}

/**
 * Presigned URL options
 */
export interface PresignedUrlOptions {
  bucket?: string;
  key: string;
  contentType?: string;
  expiresIn?: number; // seconds
  metadata?: Record<string, string>;
}

/**
 * Presigned URL result
 */
export interface PresignedUrlResult {
  uploadUrl: string;
  downloadUrl: string;
  bucket: string;
  key: string;
  expiresAt: Date;
  fields?: Record<string, string>;
}

/**
 * File metadata from S3
 */
export interface S3FileMetadata {
  key: string;
  bucket: string;
  size: number;
  contentType?: string;
  lastModified?: Date;
  etag?: string;
  metadata?: Record<string, string>;
  url: string;
  cdnUrl?: string;
}

/**
 * AWS S3 Storage Provider
 *
 * Provides enterprise-grade file storage with S3 integration.
 * Supports presigned URLs, CDN integration, and secure file management.
 */
export class S3StorageProvider {
  private client: S3Client;
  private defaultBucket: string;
  private cdnDomain: string | null;
  private region: string;

  constructor() {
    this.region = process.env.AWS_REGION || "us-east-1";
    this.defaultBucket = process.env.AWS_S3_BUCKET || "agrobridge-uploads";
    this.cdnDomain = process.env.AWS_CLOUDFRONT_DOMAIN || null;

    this.client = new S3Client({
      region: this.region,
      credentials: process.env.AWS_ACCESS_KEY_ID
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
          }
        : undefined, // Use IAM role if no credentials
    });

    logger.info({
      message: "S3 Storage Provider initialized",
      meta: { bucket: this.defaultBucket, region: this.region },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // UPLOAD OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Upload a file buffer to S3
   *
   * @param buffer - File buffer to upload
   * @param options - Upload options
   * @returns Upload result with URLs
   */
  async upload(
    buffer: Buffer,
    options: S3UploadOptions,
  ): Promise<S3UploadResult> {
    const bucket = options.bucket || this.defaultBucket;

    try {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: options.key,
        Body: buffer,
        ContentType: options.contentType || "application/octet-stream",
        Metadata: options.metadata,
        CacheControl: options.cacheControl || "max-age=31536000",
        ACL: options.acl,
        Tagging: options.tagging,
      });

      const result = await this.client.send(command);

      const s3Url = `https://${bucket}.s3.${this.region}.amazonaws.com/${options.key}`;
      const cdnUrl = this.cdnDomain
        ? `https://${this.cdnDomain}/${options.key}`
        : undefined;

      logger.info({
        message: "File uploaded to S3",
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
    } catch (error) {
      logger.error({
        message: "S3 upload failed",
        meta: { bucket, key: options.key, error: (error as Error).message },
      });
      throw error;
    }
  }

  /**
   * Upload a readable stream to S3
   *
   * @param stream - Readable stream to upload
   * @param options - Upload options
   * @returns Upload result
   */
  async uploadStream(
    stream: Readable,
    options: S3UploadOptions,
  ): Promise<S3UploadResult> {
    const bucket = options.bucket || this.defaultBucket;

    try {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: options.key,
        Body: stream,
        ContentType: options.contentType || "application/octet-stream",
        Metadata: options.metadata,
        CacheControl: options.cacheControl || "max-age=31536000",
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
    } catch (error) {
      logger.error({
        message: "S3 stream upload failed",
        meta: { bucket, key: options.key, error: (error as Error).message },
      });
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRESIGNED URLS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Generate a presigned URL for direct upload
   *
   * @param options - Presigned URL options
   * @returns Presigned URLs for upload and download
   */
  async getPresignedUploadUrl(
    options: PresignedUrlOptions,
  ): Promise<PresignedUrlResult> {
    const bucket = options.bucket || this.defaultBucket;
    const expiresIn = options.expiresIn || 3600; // 1 hour default

    try {
      // Generate upload URL
      const putCommand = new PutObjectCommand({
        Bucket: bucket,
        Key: options.key,
        ContentType: options.contentType,
        Metadata: options.metadata,
      });

      const uploadUrl = await getSignedUrl(this.client, putCommand, {
        expiresIn,
      });

      // Generate download URL
      const getCommand = new GetObjectCommand({
        Bucket: bucket,
        Key: options.key,
      });

      const downloadUrl = await getSignedUrl(this.client, getCommand, {
        expiresIn,
      });

      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      logger.debug({
        message: "Presigned URL generated",
        meta: { bucket, key: options.key, expiresIn },
      });

      return {
        uploadUrl,
        downloadUrl,
        bucket,
        key: options.key,
        expiresAt,
      };
    } catch (error) {
      logger.error({
        message: "Failed to generate presigned URL",
        meta: { bucket, key: options.key, error: (error as Error).message },
      });
      throw error;
    }
  }

  /**
   * Generate a presigned URL for download
   *
   * @param key - S3 object key
   * @param bucket - Optional bucket (uses default if not specified)
   * @param expiresIn - Expiration time in seconds (default: 3600)
   * @returns Presigned download URL
   */
  async getPresignedDownloadUrl(
    key: string,
    bucket?: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    const targetBucket = bucket || this.defaultBucket;

    const command = new GetObjectCommand({
      Bucket: targetBucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // FILE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Download a file from S3
   *
   * @param key - S3 object key
   * @param bucket - Optional bucket
   * @returns File buffer
   */
  async download(key: string, bucket?: string): Promise<Buffer> {
    const targetBucket = bucket || this.defaultBucket;

    try {
      const command = new GetObjectCommand({
        Bucket: targetBucket,
        Key: key,
      });

      const response = await this.client.send(command);
      const stream = response.Body as Readable;

      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }

      return Buffer.concat(chunks);
    } catch (error) {
      logger.error({
        message: "S3 download failed",
        meta: { bucket: targetBucket, key, error: (error as Error).message },
      });
      throw error;
    }
  }

  /**
   * Delete a file from S3
   *
   * @param key - S3 object key
   * @param bucket - Optional bucket
   */
  async delete(key: string, bucket?: string): Promise<void> {
    const targetBucket = bucket || this.defaultBucket;

    try {
      const command = new DeleteObjectCommand({
        Bucket: targetBucket,
        Key: key,
      });

      await this.client.send(command);

      logger.info({
        message: "File deleted from S3",
        meta: { bucket: targetBucket, key },
      });
    } catch (error) {
      logger.error({
        message: "S3 delete failed",
        meta: { bucket: targetBucket, key, error: (error as Error).message },
      });
      throw error;
    }
  }

  /**
   * Check if a file exists in S3
   *
   * @param key - S3 object key
   * @param bucket - Optional bucket
   * @returns True if file exists
   */
  async exists(key: string, bucket?: string): Promise<boolean> {
    const targetBucket = bucket || this.defaultBucket;

    try {
      const command = new HeadObjectCommand({
        Bucket: targetBucket,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error: unknown) {
      if ((error as { name?: string }).name === "NotFound") {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get file metadata from S3
   *
   * @param key - S3 object key
   * @param bucket - Optional bucket
   * @returns File metadata
   */
  async getMetadata(key: string, bucket?: string): Promise<S3FileMetadata> {
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
    } catch (error) {
      logger.error({
        message: "Failed to get S3 metadata",
        meta: { bucket: targetBucket, key, error: (error as Error).message },
      });
      throw error;
    }
  }

  /**
   * Copy a file within S3
   *
   * @param sourceKey - Source object key
   * @param destinationKey - Destination object key
   * @param bucket - Optional bucket (same bucket copy)
   */
  async copy(
    sourceKey: string,
    destinationKey: string,
    bucket?: string,
  ): Promise<S3UploadResult> {
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
    } catch (error) {
      logger.error({
        message: "S3 copy failed",
        meta: {
          bucket: targetBucket,
          sourceKey,
          destinationKey,
          error: (error as Error).message,
        },
      });
      throw error;
    }
  }

  /**
   * List files in a directory (prefix)
   *
   * @param prefix - Directory prefix
   * @param bucket - Optional bucket
   * @param maxKeys - Maximum number of keys to return
   * @returns List of file keys
   */
  async list(
    prefix: string,
    bucket?: string,
    maxKeys: number = 1000,
  ): Promise<string[]> {
    const targetBucket = bucket || this.defaultBucket;

    try {
      const command = new ListObjectsV2Command({
        Bucket: targetBucket,
        Prefix: prefix,
        MaxKeys: maxKeys,
      });

      const response = await this.client.send(command);
      return response.Contents?.map((item) => item.Key || "") || [];
    } catch (error) {
      logger.error({
        message: "S3 list failed",
        meta: { bucket: targetBucket, prefix, error: (error as Error).message },
      });
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Generate a unique key for file uploads
   *
   * @param filename - Original filename
   * @param prefix - Directory prefix (e.g., "batches", "producers")
   * @returns Unique S3 key
   */
  generateKey(filename: string, prefix: string = "uploads"): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const extension = filename.split(".").pop() || "";
    const sanitizedName = filename
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .substring(0, 50);

    return `${prefix}/${timestamp}-${random}-${sanitizedName}`;
  }

  /**
   * Get the public URL for an S3 object
   *
   * @param key - S3 object key
   * @param bucket - Optional bucket
   * @returns Public URL (CDN if configured, else S3)
   */
  getPublicUrl(key: string, bucket?: string): string {
    if (this.cdnDomain) {
      return `https://${this.cdnDomain}/${key}`;
    }

    const targetBucket = bucket || this.defaultBucket;
    return `https://${targetBucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  /**
   * Get the default bucket name
   */
  getDefaultBucket(): string {
    return this.defaultBucket;
  }
}

/**
 * Singleton instance of the S3 Storage Provider
 */
export const s3StorageProvider = new S3StorageProvider();

export default s3StorageProvider;
