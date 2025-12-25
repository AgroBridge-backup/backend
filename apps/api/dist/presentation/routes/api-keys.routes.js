import { Router } from 'express';
import { ApiKeyScope } from '@prisma/client';
import { z } from 'zod';
import { getApiKeyService } from '../../infrastructure/auth/ApiKeyService.js';
import { authenticate } from '../../presentation/middlewares/auth.middleware.js';
import { RateLimiterConfig } from '../../infrastructure/http/middleware/rate-limiter.middleware.js';
import { AuditLogger, AuditAction } from '../../infrastructure/logging/audit.logger.js';
import { AppError } from '../../shared/errors/AppError.js';
import logger from '../../shared/utils/logger.js';
const createApiKeySchema = z.object({
    label: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    scopes: z.array(z.nativeEnum(ApiKeyScope)).optional(),
    expiresAt: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
    rateLimitRpm: z.number().int().min(1).max(10000).optional(),
    allowedIps: z.array(z.string().ip()).optional(),
    allowedOrigins: z.array(z.string().url()).optional(),
});
const updateApiKeySchema = z.object({
    label: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    rateLimitRpm: z.number().int().min(1).max(10000).optional(),
    allowedIps: z.array(z.string().ip()).optional(),
    allowedOrigins: z.array(z.string().url()).optional(),
});
const revokeApiKeySchema = z.object({
    reason: z.string().max(500).optional(),
});
export function createApiKeysRouter(prisma) {
    const router = Router();
    const apiKeyService = getApiKeyService(prisma);
    const auditLogger = new AuditLogger(prisma);
    router.use(authenticate());
    router.use('/', RateLimiterConfig.sensitive());
    router.post('/', async (req, res, next) => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                throw new AppError('Unauthorized', 401);
            }
            const validation = createApiKeySchema.safeParse(req.body);
            if (!validation.success) {
                throw new AppError(`Validation error: ${validation.error.errors.map((e) => e.message).join(', ')}`, 400);
            }
            const result = await apiKeyService.createKey({
                userId,
                ...validation.data,
            });
            await auditLogger.log({
                userId,
                action: AuditAction.CREATE,
                resource: 'ApiKey',
                resourceId: result.id,
                details: { label: result.label, scopes: result.scopes },
                ...AuditLogger.extractRequestInfo(req),
                success: true,
            });
            logger.info('[API Keys] Key created', {
                userId,
                keyId: result.id,
                label: result.label,
            });
            res.status(201).json({
                success: true,
                data: result,
                message: 'API key created. Store the key securely - it will not be shown again.',
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/', async (req, res, next) => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                throw new AppError('Unauthorized', 401);
            }
            const keys = await apiKeyService.listKeys(userId);
            res.json({
                success: true,
                data: keys,
                meta: {
                    total: keys.length,
                },
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/:id', async (req, res, next) => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                throw new AppError('Unauthorized', 401);
            }
            const { id } = req.params;
            const key = await apiKeyService.getKey(id, userId);
            if (!key) {
                throw new AppError('API key not found', 404);
            }
            res.json({
                success: true,
                data: key,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.patch('/:id', async (req, res, next) => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                throw new AppError('Unauthorized', 401);
            }
            const { id } = req.params;
            const validation = updateApiKeySchema.safeParse(req.body);
            if (!validation.success) {
                throw new AppError(`Validation error: ${validation.error.errors.map((e) => e.message).join(', ')}`, 400);
            }
            const updated = await apiKeyService.updateKey(id, userId, validation.data);
            await auditLogger.log({
                userId,
                action: AuditAction.UPDATE,
                resource: 'ApiKey',
                resourceId: id,
                details: { updates: validation.data },
                ...AuditLogger.extractRequestInfo(req),
                success: true,
            });
            res.json({
                success: true,
                data: updated,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.delete('/:id', async (req, res, next) => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                throw new AppError('Unauthorized', 401);
            }
            const { id } = req.params;
            const validation = revokeApiKeySchema.safeParse(req.body);
            const reason = validation.success ? validation.data.reason : undefined;
            await apiKeyService.revokeKey(id, userId, userId, reason);
            await auditLogger.log({
                userId,
                action: AuditAction.DELETE,
                resource: 'ApiKey',
                resourceId: id,
                details: { reason },
                ...AuditLogger.extractRequestInfo(req),
                success: true,
            });
            logger.info('[API Keys] Key revoked', { userId, keyId: id, reason });
            res.json({
                success: true,
                message: 'API key has been revoked',
            });
        }
        catch (error) {
            next(error);
        }
    });
    return router;
}
export default createApiKeysRouter;
