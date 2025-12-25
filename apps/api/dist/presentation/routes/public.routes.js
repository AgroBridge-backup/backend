import { Router } from 'express';
import { z } from 'zod';
import { PublicTraceabilityService } from '../../domain/services/PublicTraceabilityService.js';
import { PrismaPublicTraceabilityRepository } from '../../infrastructure/database/prisma/repositories/PrismaPublicTraceabilityRepository.js';
import { RateLimiterConfig } from '../../infrastructure/http/middleware/rate-limiter.middleware.js';
import { AppError } from '../../shared/errors/AppError.js';
import logger from '../../shared/utils/logger.js';
const shortCodeSchema = z.object({
    params: z.object({
        shortCode: z.string().min(6).max(12),
    }),
});
const farmerIdSchema = z.object({
    params: z.object({
        farmerId: z.string().min(1),
    }),
});
const scanEventSchema = z.object({
    body: z.object({
        shortCode: z.string().min(6).max(12),
        referrer: z.string().optional(),
    }),
});
export function createPublicRoutes(prisma) {
    const router = Router();
    const repository = new PrismaPublicTraceabilityRepository(prisma);
    const service = new PublicTraceabilityService(prisma, repository);
    router.get('/farmers/:farmerId', RateLimiterConfig.api(), async (req, res, next) => {
        try {
            const { farmerId } = req.params;
            const profile = await service.getFarmerProfile(farmerId);
            if (!profile) {
                throw new AppError('Farmer not found', 404);
            }
            res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
            res.json({
                success: true,
                data: profile,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/batches/:shortCode', RateLimiterConfig.api(), async (req, res, next) => {
        try {
            const { shortCode } = req.params;
            const traceability = await service.getBatchTraceability(shortCode);
            if (!traceability) {
                throw new AppError('Batch not found or link expired', 404);
            }
            res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120');
            res.json({
                success: true,
                data: traceability,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.post('/events/scan', RateLimiterConfig.api(), async (req, res, next) => {
        try {
            const validatedData = scanEventSchema.shape.body.parse(req.body);
            const userAgent = req.headers['user-agent'];
            const referrer = validatedData.referrer || req.headers['referer'];
            const country = req.headers['cf-ipcountry'] ||
                req.headers['x-country'] ||
                null;
            await service.recordScan({
                shortCode: validatedData.shortCode,
                userAgent,
                referrer,
                country: country || undefined,
            });
            res.status(201).json({
                success: true,
                message: 'Scan recorded',
            });
        }
        catch (error) {
            logger.error('Failed to record scan event', { error });
            res.status(201).json({
                success: true,
                message: 'Acknowledged',
            });
        }
    });
    router.get('/health', (_req, res) => {
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
        });
    });
    return router;
}
export function createPublicLinkRoutes(prisma) {
    const router = Router();
    const repository = new PrismaPublicTraceabilityRepository(prisma);
    const service = new PublicTraceabilityService(prisma, repository);
    router.post('/:id/public-link', async (req, res, next) => {
        try {
            const { id: batchId } = req.params;
            if (!z.string().uuid().safeParse(batchId).success) {
                throw new AppError('Invalid batch ID', 400);
            }
            const result = await service.generatePublicLink(batchId);
            logger.info('Public link generated', {
                batchId,
                shortCode: result.link.shortCode,
                isNew: result.isNew,
                userId: req.user?.userId,
            });
            res.status(result.isNew ? 201 : 200).json({
                success: true,
                data: {
                    publicUrl: result.publicUrl,
                    shortCode: result.link.shortCode,
                    qrImageUrl: result.qrImageUrl,
                    viewCount: result.link.viewCount,
                    createdAt: result.link.createdAt,
                },
                message: result.isNew
                    ? 'Public link created successfully'
                    : 'Existing public link retrieved',
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/:id/public-stats', async (req, res, next) => {
        try {
            const { id: batchId } = req.params;
            if (!z.string().uuid().safeParse(batchId).success) {
                throw new AppError('Invalid batch ID', 400);
            }
            const analytics = await service.getScanAnalytics(batchId);
            if (!analytics) {
                throw new AppError('No public link exists for this batch', 404);
            }
            res.json({
                success: true,
                data: analytics,
            });
        }
        catch (error) {
            next(error);
        }
    });
    return router;
}
