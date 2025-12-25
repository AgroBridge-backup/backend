/**
 * Public Certificate Verification Routes
 * NO AUTHENTICATION REQUIRED
 * For US importers/retailers to verify organic certificates via QR code
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { PrismaOrganicCertificateRepository } from '../../infrastructure/database/prisma/repositories/PrismaOrganicCertificateRepository.js';
import { PrismaOrganicFieldRepository } from '../../infrastructure/database/prisma/repositories/PrismaOrganicFieldRepository.js';
import { PrismaFieldInspectionRepository } from '../../infrastructure/database/prisma/repositories/PrismaFieldInspectionRepository.js';
import { OrganicCertificateService } from '../../domain/services/OrganicCertificateService.js';
import { PdfGenerator } from '../../infrastructure/pdf/PdfGenerator.js';
import {
  VerifyCertificateUseCase,
  GetBlockchainProofUseCase,
} from '../../application/use-cases/organic-certificates/index.js';
import { RateLimiterConfig } from '../../infrastructure/http/middleware/rate-limiter.middleware.js';
import { logger } from '../../infrastructure/logging/logger.js';

/**
 * Create public verification router
 * NO AUTHENTICATION - designed for QR code scanning by importers/retailers
 */
export function createPublicVerifyRouter(prisma: PrismaClient): Router {
  const router = Router();

  // Initialize repositories
  const certificateRepository = new PrismaOrganicCertificateRepository(prisma);
  const fieldRepository = new PrismaOrganicFieldRepository(prisma);
  const inspectionRepository = new PrismaFieldInspectionRepository(prisma);

  // Initialize services (minimal - no blockchain needed for verification)
  const pdfGenerator = new PdfGenerator();
  const certificateService = new OrganicCertificateService({
    prisma,
    certificateRepository,
    fieldRepository,
    inspectionRepository,
    pdfGenerator,
  });

  // Initialize use cases
  const verifyCertificateUseCase = new VerifyCertificateUseCase(certificateService);
  const getBlockchainProofUseCase = new GetBlockchainProofUseCase(certificateService);

  /**
   * GET /api/v1/verify/:certificateNumber
   * Public certificate verification (QR code scan)
   * NO AUTH REQUIRED
   * 
   * Response includes:
   * - Certificate validity status
   * - Farmer information
   * - Certification standard
   * - Blockchain verification
   * - IPFS metadata link
   * - Verification statistics
   */
  router.get(
    '/:certificateNumber',
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { certificateNumber } = req.params;

        // Extract view data for analytics
        const viewData = {
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          country: req.headers['cf-ipcountry'] as string || undefined, // Cloudflare GeoIP
          deviceType: detectDeviceType(req.get('user-agent')),
          referrer: req.get('referrer'),
        };

        logger.info('Certificate verification request', {
          certificateNumber,
          country: viewData.country,
          deviceType: viewData.deviceType,
        });

        const result = await verifyCertificateUseCase.execute({
          certificateNumber,
          viewData,
        });

        // Set CORS headers for public access
        res.set('Access-Control-Allow-Origin', '*');

        res.json({
          success: true,
          data: result,
        });
      } catch (error: any) {
        // Handle not found gracefully
        if (error.code === 'CERTIFICATE_NOT_FOUND' || error.statusCode === 404) {
          return res.status(404).json({
            success: false,
            valid: false,
            error: 'Certificate not found',
            certificateNumber: req.params.certificateNumber,
          });
        }
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/verify/:certificateNumber/blockchain-proof
   * Get blockchain verification proof
   * NO AUTH REQUIRED
   */
  router.get(
    '/:certificateNumber/blockchain-proof',
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { certificateNumber } = req.params;

        const result = await getBlockchainProofUseCase.execute({
          certificateNumber,
        });

        // Set CORS headers for public access
        res.set('Access-Control-Allow-Origin', '*');

        res.json({
          success: true,
          data: result,
        });
      } catch (error: any) {
        if (error.code === 'CERTIFICATE_NOT_FOUND' || error.statusCode === 404) {
          return res.status(404).json({
            success: false,
            error: 'Certificate not found',
          });
        }
        if (error.message?.includes('not anchored')) {
          return res.status(400).json({
            success: false,
            error: 'Certificate not yet anchored to blockchain',
          });
        }
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/verify/:certificateNumber/qr
   * Get QR code image for certificate
   * NO AUTH REQUIRED
   */
  router.get(
    '/:certificateNumber/qr',
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { certificateNumber } = req.params;

        // Verify certificate exists
        const result = await verifyCertificateUseCase.execute({
          certificateNumber,
        });

        if (!result.valid) {
          return res.status(400).json({
            success: false,
            error: 'Certificate is not valid',
          });
        }

        // Generate QR code
        const QRCode = await import('qrcode');
        const verificationUrl = `https://verify.agrobridge.io/${certificateNumber}`;

        const qrCodeDataUrl = await QRCode.toDataURL(
          JSON.stringify({
            certificateNumber,
            verificationUrl,
            issuedDate: result.certification.issuedDate,
            farmer: result.farmInfo.farmerName,
            cropType: result.farmInfo.cropType,
          }),
          {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            width: 300,
            margin: 1,
          }
        );

        // Return as image
        const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        res.set('Content-Type', 'image/png');
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Cache-Control', 'public, max-age=3600');
        res.send(buffer);
      } catch (error: any) {
        if (error.code === 'CERTIFICATE_NOT_FOUND' || error.statusCode === 404) {
          return res.status(404).json({
            success: false,
            error: 'Certificate not found',
          });
        }
        next(error);
      }
    }
  );

  /**
   * OPTIONS handler for CORS preflight
   */
  router.options('/:certificateNumber', (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send();
  });

  return router;
}

/**
 * Detect device type from user agent
 */
function detectDeviceType(userAgent?: string): string {
  if (!userAgent) return 'UNKNOWN';

  const ua = userAgent.toLowerCase();
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return 'MOBILE';
  }
  if (ua.includes('tablet') || ua.includes('ipad')) {
    return 'TABLET';
  }
  return 'DESKTOP';
}

/**
 * Default export for standalone usage (app.ts - /verify routes)
 * Creates router with its own Prisma instance
 */
const prisma = new PrismaClient();
export default createPublicVerifyRouter(prisma);
