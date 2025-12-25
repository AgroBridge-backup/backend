/**
 * Traceability 2.0 - Tamper-Evident NFC Seals
 * REST API Routes
 *
 * @deprecated POST-MVP: NFC seal features not required for organic certification MVP.
 * All endpoints return 501 Not Implemented.
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middlewares/auth.middleware.js';
import logger from '../../shared/utils/logger.js';

/**
 * @deprecated POST-MVP - Stub router for NFC seals
 */
export function createNfcSealsRouter(prisma: PrismaClient): Router {
  const router = Router();

  logger.info('[NFC Seals] Routes initialized in stub mode - NFC features disabled for MVP');

  // All endpoints return 501 Not Implemented
  const notImplemented = (req: Request, res: Response) => {
    res.status(501).json({
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'NFC seal features not available in MVP. This feature will be available after beta launch.',
      },
    });
  };

  // Stub routes
  router.post('/provision', authenticate(), notImplemented);
  router.post('/provision/batch', authenticate(), notImplemented);
  router.post('/:sealId/attach', authenticate(), notImplemented);
  router.post('/verify', notImplemented);
  router.get('/:sealId', authenticate(), notImplemented);
  router.get('/:sealId/history', authenticate(), notImplemented);
  router.get('/batch/:batchId', authenticate(), notImplemented);
  router.get('/batch/:batchId/summary', authenticate(), notImplemented);
  router.post('/:sealId/remove', authenticate(), notImplemented);

  return router;
}
