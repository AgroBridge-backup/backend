/**
 * Farmer Storytelling & Consumer Traceability
 * Public Read-Only API Routes
 *
 * These endpoints are unauthenticated and designed for consumer access.
 * All data is read-only and privacy-respecting.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { PublicTraceabilityService } from '../../domain/services/PublicTraceabilityService.js';
import { PrismaPublicTraceabilityRepository } from '../../infrastructure/database/prisma/repositories/PrismaPublicTraceabilityRepository.js';
import { RateLimiterConfig } from '../../infrastructure/http/middleware/rate-limiter.middleware.js';
import { AppError } from '../../shared/errors/AppError.js';
import logger from '../../shared/utils/logger.js';

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTER FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

export function createPublicRoutes(prisma: PrismaClient): Router {
  const router = Router();

  // Initialize dependencies
  const repository = new PrismaPublicTraceabilityRepository(prisma);
  const service = new PublicTraceabilityService(prisma, repository);

  // ═══════════════════════════════════════════════════════════════════════════
  // FARMER PROFILE (Public)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /public/farmers/:farmerId
   * Get public farmer profile by ID or slug
   *
   * Returns: name, photo, region, story, crops, certifications, stats
   */
  router.get(
    '/farmers/:farmerId',
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { farmerId } = req.params;

        const profile = await service.getFarmerProfile(farmerId);

        if (!profile) {
          throw new AppError('Farmer not found', 404);
        }

        // Set cache headers for CDN
        res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600'); // 5 min client, 10 min CDN

        res.json({
          success: true,
          data: profile,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // BATCH TRACEABILITY (Public - QR Target)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /public/batches/:shortCode
   * Get full public batch traceability by short code
   *
   * This is the main QR code target endpoint.
   * Returns all Traceability 2.0 data in consumer-friendly format.
   */
  router.get(
    '/batches/:shortCode',
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { shortCode } = req.params;

        const traceability = await service.getBatchTraceability(shortCode);

        if (!traceability) {
          throw new AppError('Batch not found or link expired', 404);
        }

        // Set shorter cache for dynamic traceability data
        res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120'); // 1 min client, 2 min CDN

        res.json({
          success: true,
          data: traceability,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // SCAN ANALYTICS (Privacy-Safe)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * POST /public/events/scan
   * Record a QR scan event (privacy-safe analytics)
   *
   * Called by the public web app when a QR page is viewed.
   * Does not track personal data, only aggregate metrics.
   */
  router.post(
    '/events/scan',
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const validatedData = scanEventSchema.shape.body.parse(req.body);

        // Extract device info from headers
        const userAgent = req.headers['user-agent'];
        const referrer = validatedData.referrer || req.headers['referer'] as string | undefined;

        // Get country from headers (set by CDN/proxy) - no IP storage
        const country = (req.headers['cf-ipcountry'] as string) ||
                       (req.headers['x-country'] as string) ||
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
      } catch (error) {
        // Don't fail the request for analytics errors
        logger.error('Failed to record scan event', { error });
        res.status(201).json({
          success: true,
          message: 'Acknowledged',
        });
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // HEALTH CHECK
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /public/health
   * Public API health check
   */
  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  });

  return router;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTHENTICATED ROUTES (For Producers/Exporters)
// ═══════════════════════════════════════════════════════════════════════════════

export function createPublicLinkRoutes(prisma: PrismaClient): Router {
  const router = Router();

  // Initialize dependencies
  const repository = new PrismaPublicTraceabilityRepository(prisma);
  const service = new PublicTraceabilityService(prisma, repository);

  /**
   * POST /batches/:id/public-link
   * Generate a public link and QR code for a batch
   *
   * Auth: PRODUCER, EXPORTER, ADMIN
   */
  router.post(
    '/:id/public-link',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id: batchId } = req.params;

        // Validate UUID format
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
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /batches/:id/public-stats
   * Get scan analytics for a batch's public link
   *
   * Auth: PRODUCER, EXPORTER, ADMIN
   */
  router.get(
    '/:id/public-stats',
    async (req: Request, res: Response, next: NextFunction) => {
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
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
