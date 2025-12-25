/**
 * @file API Key Service
 * @description Enterprise-grade API key management for programmatic access
 *
 * Security Features:
 * - Cryptographically secure key generation (crypto.randomBytes)
 * - Only key hash stored in database (key shown only once on creation)
 * - SHA-256 hashing for validation
 * - Key prefix for identification without exposing full key
 *
 * @author AgroBridge Engineering Team
 */

import crypto from 'crypto';
import { PrismaClient, ApiKeyStatus, ApiKeyScope } from '@prisma/client';
import logger from '../../shared/utils/logger.js';

export interface CreateApiKeyDto {
  userId: string;
  label: string;
  description?: string;
  scopes?: ApiKeyScope[];
  expiresAt?: Date;
  rateLimitRpm?: number;
  allowedIps?: string[];
  allowedOrigins?: string[];
}

export interface ApiKeyResponse {
  id: string;
  keyPrefix: string;
  label: string;
  description?: string | null;
  scopes: ApiKeyScope[];
  status: ApiKeyStatus;
  expiresAt?: Date | null;
  lastUsedAt?: Date | null;
  usageCount: number;
  rateLimitRpm: number;
  allowedIps: string[];
  allowedOrigins: string[];
  createdAt: Date;
}

export interface CreateApiKeyResponse extends ApiKeyResponse {
  // Full key - ONLY returned on creation, never stored or shown again
  key: string;
}

export interface ValidateApiKeyResult {
  valid: boolean;
  userId?: string;
  scopes?: ApiKeyScope[];
  keyId?: string;
  error?: string;
}

/**
 * API Key Service
 *
 * Manages the lifecycle of API keys for programmatic access.
 * Keys follow the format: ab_live_<random32chars> or ab_test_<random32chars>
 *
 * Enterprise MFA - v1 implementation
 * This service provides foundational API key management that can be extended
 * with additional authentication factors (e.g., mutual TLS, IP restrictions).
 */
export class ApiKeyService {
  private readonly KEY_PREFIX_LIVE = 'ab_live_';
  private readonly KEY_PREFIX_TEST = 'ab_test_';
  private readonly KEY_BYTES = 32; // 256 bits of entropy

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Generate a new API key
   *
   * @param dto - Key creation parameters
   * @returns Created key with the full key value (shown only once)
   */
  async createKey(dto: CreateApiKeyDto): Promise<CreateApiKeyResponse> {
    const isProduction = process.env.NODE_ENV === 'production';
    const prefix = isProduction ? this.KEY_PREFIX_LIVE : this.KEY_PREFIX_TEST;

    // Generate cryptographically secure random bytes
    const randomBytes = crypto.randomBytes(this.KEY_BYTES);
    const randomPart = randomBytes.toString('base64url').slice(0, 32);

    // Full key format: ab_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx (44 chars total)
    const fullKey = `${prefix}${randomPart}`;

    // Create SHA-256 hash for storage (never store the full key)
    const keyHash = this.hashKey(fullKey);

    // Store only the first 12 characters as prefix for identification
    const keyPrefix = fullKey.slice(0, 12);

    logger.debug('[ApiKeyService] Creating new API key', {
      userId: dto.userId,
      label: dto.label,
      keyPrefix,
    });

    const apiKey = await this.prisma.apiKey.create({
      data: {
        userId: dto.userId,
        keyPrefix,
        keyHash,
        label: dto.label,
        description: dto.description,
        scopes: dto.scopes || [ApiKeyScope.READ],
        expiresAt: dto.expiresAt,
        rateLimitRpm: dto.rateLimitRpm || 100,
        allowedIps: dto.allowedIps || [],
        allowedOrigins: dto.allowedOrigins || [],
        status: ApiKeyStatus.ACTIVE,
      },
    });

    logger.info('[ApiKeyService] API key created', {
      keyId: apiKey.id,
      userId: dto.userId,
      label: dto.label,
    });

    return {
      id: apiKey.id,
      key: fullKey, // Only time the full key is returned
      keyPrefix: apiKey.keyPrefix,
      label: apiKey.label,
      description: apiKey.description,
      scopes: apiKey.scopes,
      status: apiKey.status,
      expiresAt: apiKey.expiresAt,
      lastUsedAt: apiKey.lastUsedAt,
      usageCount: apiKey.usageCount,
      rateLimitRpm: apiKey.rateLimitRpm,
      allowedIps: apiKey.allowedIps,
      allowedOrigins: apiKey.allowedOrigins,
      createdAt: apiKey.createdAt,
    };
  }

  /**
   * Validate an API key and return associated permissions
   *
   * @param key - The full API key to validate
   * @param ip - Optional IP address for whitelist check
   * @returns Validation result with user info and scopes
   */
  async validateKey(key: string, ip?: string): Promise<ValidateApiKeyResult> {
    if (!key || !key.startsWith('ab_')) {
      return { valid: false, error: 'Invalid key format' };
    }

    const keyHash = this.hashKey(key);

    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyHash },
    });

    if (!apiKey) {
      logger.warn('[ApiKeyService] Invalid API key attempted', {
        keyPrefix: key.slice(0, 12),
        ip,
      });
      return { valid: false, error: 'Invalid API key' };
    }

    // Check status
    if (apiKey.status !== ApiKeyStatus.ACTIVE) {
      logger.warn('[ApiKeyService] Inactive API key used', {
        keyId: apiKey.id,
        status: apiKey.status,
        ip,
      });
      return { valid: false, error: `API key is ${apiKey.status.toLowerCase()}` };
    }

    // Check expiration
    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
      // Auto-update status to expired
      await this.prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { status: ApiKeyStatus.EXPIRED },
      });
      return { valid: false, error: 'API key has expired' };
    }

    // Check IP whitelist
    if (apiKey.allowedIps.length > 0 && ip) {
      if (!apiKey.allowedIps.includes(ip)) {
        logger.warn('[ApiKeyService] API key used from unauthorized IP', {
          keyId: apiKey.id,
          ip,
          allowedIps: apiKey.allowedIps,
        });
        return { valid: false, error: 'IP address not authorized' };
      }
    }

    // Update usage stats (non-blocking)
    this.prisma.apiKey
      .update({
        where: { id: apiKey.id },
        data: {
          lastUsedAt: new Date(),
          lastUsedIp: ip?.slice(0, 45),
          usageCount: { increment: 1 },
        },
      })
      .catch((err) => {
        logger.error('[ApiKeyService] Failed to update usage stats', { error: err.message });
      });

    return {
      valid: true,
      userId: apiKey.userId,
      scopes: apiKey.scopes,
      keyId: apiKey.id,
    };
  }

  /**
   * List all API keys for a user (masked)
   *
   * @param userId - User ID to list keys for
   * @returns Array of API keys with masked key values
   */
  async listKeys(userId: string): Promise<ApiKeyResponse[]> {
    const keys = await this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return keys.map((key) => ({
      id: key.id,
      keyPrefix: key.keyPrefix,
      label: key.label,
      description: key.description,
      scopes: key.scopes,
      status: key.status,
      expiresAt: key.expiresAt,
      lastUsedAt: key.lastUsedAt,
      usageCount: key.usageCount,
      rateLimitRpm: key.rateLimitRpm,
      allowedIps: key.allowedIps,
      allowedOrigins: key.allowedOrigins,
      createdAt: key.createdAt,
    }));
  }

  /**
   * Revoke an API key
   *
   * @param keyId - Key ID to revoke
   * @param userId - User ID (for authorization check)
   * @param revokedBy - User who revoked the key
   * @param reason - Optional revocation reason
   */
  async revokeKey(
    keyId: string,
    userId: string,
    revokedBy: string,
    reason?: string
  ): Promise<void> {
    const key = await this.prisma.apiKey.findFirst({
      where: { id: keyId, userId },
    });

    if (!key) {
      throw new Error('API key not found or unauthorized');
    }

    if (key.status === ApiKeyStatus.REVOKED) {
      throw new Error('API key is already revoked');
    }

    await this.prisma.apiKey.update({
      where: { id: keyId },
      data: {
        status: ApiKeyStatus.REVOKED,
        revokedAt: new Date(),
        revokedBy,
        revokedReason: reason,
      },
    });

    logger.info('[ApiKeyService] API key revoked', {
      keyId,
      userId,
      revokedBy,
      reason,
    });
  }

  /**
   * Get a single API key by ID
   *
   * @param keyId - Key ID
   * @param userId - User ID for authorization
   */
  async getKey(keyId: string, userId: string): Promise<ApiKeyResponse | null> {
    const key = await this.prisma.apiKey.findFirst({
      where: { id: keyId, userId },
    });

    if (!key) {
      return null;
    }

    return {
      id: key.id,
      keyPrefix: key.keyPrefix,
      label: key.label,
      description: key.description,
      scopes: key.scopes,
      status: key.status,
      expiresAt: key.expiresAt,
      lastUsedAt: key.lastUsedAt,
      usageCount: key.usageCount,
      rateLimitRpm: key.rateLimitRpm,
      allowedIps: key.allowedIps,
      allowedOrigins: key.allowedOrigins,
      createdAt: key.createdAt,
    };
  }

  /**
   * Update API key metadata (not the key itself)
   */
  async updateKey(
    keyId: string,
    userId: string,
    updates: {
      label?: string;
      description?: string;
      rateLimitRpm?: number;
      allowedIps?: string[];
      allowedOrigins?: string[];
    }
  ): Promise<ApiKeyResponse> {
    const key = await this.prisma.apiKey.findFirst({
      where: { id: keyId, userId },
    });

    if (!key) {
      throw new Error('API key not found or unauthorized');
    }

    const updated = await this.prisma.apiKey.update({
      where: { id: keyId },
      data: updates,
    });

    return {
      id: updated.id,
      keyPrefix: updated.keyPrefix,
      label: updated.label,
      description: updated.description,
      scopes: updated.scopes,
      status: updated.status,
      expiresAt: updated.expiresAt,
      lastUsedAt: updated.lastUsedAt,
      usageCount: updated.usageCount,
      rateLimitRpm: updated.rateLimitRpm,
      allowedIps: updated.allowedIps,
      allowedOrigins: updated.allowedOrigins,
      createdAt: updated.createdAt,
    };
  }

  /**
   * Hash an API key using SHA-256
   */
  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }
}

/**
 * Singleton instance
 * Note: In production, inject PrismaClient via dependency injection
 */
let apiKeyServiceInstance: ApiKeyService | null = null;

export function getApiKeyService(prisma: PrismaClient): ApiKeyService {
  if (!apiKeyServiceInstance) {
    apiKeyServiceInstance = new ApiKeyService(prisma);
  }
  return apiKeyServiceInstance;
}
