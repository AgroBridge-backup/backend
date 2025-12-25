/**
 * Traceability 2.0 - Satellite Imagery Time-Lapse
 * REST API Routes
 *
 * @deprecated POST-MVP: Satellite imagery features not required for organic certification MVP.
 * All endpoints return 501 Not Implemented.
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middlewares/auth.middleware.js';
import logger from '../../shared/utils/logger.js';

/**
 * @deprecated POST-MVP - Stub router for satellite imagery
 */
export function createSatelliteImageryRouter(prisma: PrismaClient): Router {
  const router = Router();

  logger.info('[Satellite Imagery] Routes initialized in stub mode - Satellite features disabled for MVP');

  // All endpoints return 501 Not Implemented
  const notImplemented = (req: Request, res: Response) => {
    res.status(501).json({
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Satellite imagery features not available in MVP. This feature will be available after beta launch.',
      },
    });
  };

  // Field management routes
  router.post('/fields', authenticate(), notImplemented);
  router.get('/fields', authenticate(), notImplemented);
  router.get('/fields/:fieldId', authenticate(), notImplemented);
  router.put('/fields/:fieldId', authenticate(), notImplemented);
  router.delete('/fields/:fieldId', authenticate(), notImplemented);

  // Imagery routes
  router.get('/fields/:fieldId/imagery', authenticate(), notImplemented);
  router.get('/fields/:fieldId/time-lapse', authenticate(), notImplemented);
  router.get('/fields/:fieldId/latest', authenticate(), notImplemented);
  router.post('/fields/:fieldId/capture', authenticate(), notImplemented);

  // Analysis routes
  router.get('/fields/:fieldId/health', authenticate(), notImplemented);
  router.get('/fields/:fieldId/anomalies', authenticate(), notImplemented);

  return router;
}
