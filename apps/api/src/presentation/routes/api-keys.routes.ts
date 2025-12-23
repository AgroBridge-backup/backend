/**
 * @file API Keys Routes
 * @description REST endpoints for API key management
 *
 * Endpoints:
 * - POST /api/v1/api-keys - Create a new API key
 * - GET /api/v1/api-keys - List all API keys for the authenticated user
 * - GET /api/v1/api-keys/:id - Get a specific API key
 * - PATCH /api/v1/api-keys/:id - Update API key metadata
 * - DELETE /api/v1/api-keys/:id - Revoke an API key
 *
 * @author AgroBridge Engineering Team
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient, ApiKeyScope } from '@prisma/client';
import { z } from 'zod';
import { ApiKeyService, getApiKeyService } from '../../infrastructure/auth/ApiKeyService.js';
import { authenticate } from '../../presentation/middlewares/auth.middleware.js';
import { RateLimiterConfig } from '../../infrastructure/http/middleware/rate-limiter.middleware.js';
import { AuditLogger, AuditAction } from '../../infrastructure/logging/audit.logger.js';
import { AppError } from '../../shared/errors/AppError.js';
import logger from '../../shared/utils/logger.js';

// Request validation schemas
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

/**
 * Create API Keys Router
 *
 * @param prisma - Prisma client instance
 * @returns Express router with API key endpoints
 */
export function createApiKeysRouter(prisma: PrismaClient): Router {
  const router = Router();
  const apiKeyService = getApiKeyService(prisma);
  const auditLogger = new AuditLogger(prisma);

  // Apply auth middleware to all routes
  router.use(authenticate());

  // Apply stricter rate limiting for key creation
  router.use('/', RateLimiterConfig.sensitive());

  /**
   * POST /api/v1/api-keys
   * Create a new API key
   */
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      const validation = createApiKeySchema.safeParse(req.body);
      if (!validation.success) {
        throw new AppError(
          `Validation error: ${validation.error.errors.map((e) => e.message).join(', ')}`,
          400
        );
      }

      const result = await apiKeyService.createKey({
        userId,
        ...validation.data,
      });

      // Audit log - CREATE action
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

      // Return 201 Created with the key (only time it's shown)
      res.status(201).json({
        success: true,
        data: result,
        message: 'API key created. Store the key securely - it will not be shown again.',
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/v1/api-keys
   * List all API keys for the authenticated user
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.userId;
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
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/v1/api-keys/:id
   * Get a specific API key
   */
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.userId;
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
    } catch (error) {
      next(error);
    }
  });

  /**
   * PATCH /api/v1/api-keys/:id
   * Update API key metadata
   */
  router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      const { id } = req.params;

      const validation = updateApiKeySchema.safeParse(req.body);
      if (!validation.success) {
        throw new AppError(
          `Validation error: ${validation.error.errors.map((e) => e.message).join(', ')}`,
          400
        );
      }

      const updated = await apiKeyService.updateKey(id, userId, validation.data);

      // Audit log - UPDATE action
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
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /api/v1/api-keys/:id
   * Revoke an API key
   */
  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      const { id } = req.params;

      const validation = revokeApiKeySchema.safeParse(req.body);
      const reason = validation.success ? validation.data.reason : undefined;

      await apiKeyService.revokeKey(id, userId, userId, reason);

      // Audit log - DELETE action
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
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export default createApiKeysRouter;
