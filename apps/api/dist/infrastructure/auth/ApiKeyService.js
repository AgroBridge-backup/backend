import crypto from 'crypto';
import { ApiKeyStatus, ApiKeyScope } from '@prisma/client';
import logger from '../../shared/utils/logger.js';
export class ApiKeyService {
    prisma;
    KEY_PREFIX_LIVE = 'ab_live_';
    KEY_PREFIX_TEST = 'ab_test_';
    KEY_BYTES = 32;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createKey(dto) {
        const isProduction = process.env.NODE_ENV === 'production';
        const prefix = isProduction ? this.KEY_PREFIX_LIVE : this.KEY_PREFIX_TEST;
        const randomBytes = crypto.randomBytes(this.KEY_BYTES);
        const randomPart = randomBytes.toString('base64url').slice(0, 32);
        const fullKey = `${prefix}${randomPart}`;
        const keyHash = this.hashKey(fullKey);
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
            key: fullKey,
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
    async validateKey(key, ip) {
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
        if (apiKey.status !== ApiKeyStatus.ACTIVE) {
            logger.warn('[ApiKeyService] Inactive API key used', {
                keyId: apiKey.id,
                status: apiKey.status,
                ip,
            });
            return { valid: false, error: `API key is ${apiKey.status.toLowerCase()}` };
        }
        if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
            await this.prisma.apiKey.update({
                where: { id: apiKey.id },
                data: { status: ApiKeyStatus.EXPIRED },
            });
            return { valid: false, error: 'API key has expired' };
        }
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
    async listKeys(userId) {
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
    async revokeKey(keyId, userId, revokedBy, reason) {
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
    async getKey(keyId, userId) {
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
    async updateKey(keyId, userId, updates) {
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
    hashKey(key) {
        return crypto.createHash('sha256').update(key).digest('hex');
    }
}
let apiKeyServiceInstance = null;
export function getApiKeyService(prisma) {
    if (!apiKeyServiceInstance) {
        apiKeyServiceInstance = new ApiKeyService(prisma);
    }
    return apiKeyServiceInstance;
}
