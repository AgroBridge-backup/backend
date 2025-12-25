/**
 * Organic Certificate Routes
 * RESTful API endpoints for organic certificate management
 * Revenue-critical: $5-20/certificate
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { PrismaOrganicCertificateRepository } from '../../infrastructure/database/prisma/repositories/PrismaOrganicCertificateRepository.js';
import { PrismaOrganicFieldRepository } from '../../infrastructure/database/prisma/repositories/PrismaOrganicFieldRepository.js';
import { PrismaFieldInspectionRepository } from '../../infrastructure/database/prisma/repositories/PrismaFieldInspectionRepository.js';
import { OrganicCertificateService } from '../../domain/services/OrganicCertificateService.js';
import { PdfGenerator } from '../../infrastructure/pdf/PdfGenerator.js';
import { createIpfsService } from '../../infrastructure/ipfs/IPFSService.js';
import {
  CreateCertificateUseCase,
  GetCertificateUseCase,
  ListCertificatesUseCase,
  ApproveCertificateUseCase,
  RejectCertificateUseCase,
  RevokeCertificateUseCase,
  DownloadCertificatePdfUseCase,
} from '../../application/use-cases/organic-certificates/index.js';
import {
  OrganicCertificateStatus,
  CropType,
  CertificationStandard,
} from '../../domain/entities/OrganicCertificate.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { RateLimiterConfig } from '../../infrastructure/http/middleware/rate-limiter.middleware.js';
import { logger } from '../../infrastructure/logging/logger.js';

// Validation schemas
const createCertificateSchema = z.object({
  fieldIds: z.array(z.string().uuid()).min(1).max(10),
  cropType: z.nativeEnum(CropType).or(z.string()),
  harvestDate: z.string().datetime().optional(),
  certificationStandard: z.enum(['ORGANIC_USDA', 'ORGANIC_EU', 'SENASICA']),
  notes: z.string().max(1000).optional(),
});

const listCertificatesSchema = z.object({
  status: z.nativeEnum(OrganicCertificateStatus).optional(),
  cropType: z.nativeEnum(CropType).or(z.string()).optional(),
  certificationStandard: z.enum(['ORGANIC_USDA', 'ORGANIC_EU', 'SENASICA']).optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

const rejectCertificateSchema = z.object({
  reason: z.string().min(10).max(500),
});

const revokeCertificateSchema = z.object({
  reason: z.string().min(10).max(500),
});

/**
 * Create organic certificates router
 */
export function createOrganicCertificatesRouter(prisma: PrismaClient): Router {
  const router = Router();

  // Initialize repositories
  const certificateRepository = new PrismaOrganicCertificateRepository(prisma);
  const fieldRepository = new PrismaOrganicFieldRepository(prisma);
  const inspectionRepository = new PrismaFieldInspectionRepository(prisma);

  // Initialize services
  const pdfGenerator = new PdfGenerator({
    companyName: 'AgroBridge',
    companyWebsite: 'https://agrobridge.io',
    verificationBaseUrl: process.env.VERIFICATION_BASE_URL || 'https://verify.agrobridge.io',
  });

  const ipfsService = createIpfsService();

  const certificateService = new OrganicCertificateService({
    prisma,
    certificateRepository,
    fieldRepository,
    inspectionRepository,
    pdfGenerator,
    ipfsService: ipfsService.isConfigured() ? ipfsService : undefined,
    // blockchainService is optional - will be configured separately
  });

  // Initialize use cases
  const createCertificateUseCase = new CreateCertificateUseCase(certificateService);
  const getCertificateUseCase = new GetCertificateUseCase(certificateService);
  const listCertificatesUseCase = new ListCertificatesUseCase(certificateService);
  const approveCertificateUseCase = new ApproveCertificateUseCase(certificateService);
  const rejectCertificateUseCase = new RejectCertificateUseCase(certificateService);
  const revokeCertificateUseCase = new RevokeCertificateUseCase(certificateService);
  const downloadPdfUseCase = new DownloadCertificatePdfUseCase(certificateService);

  // ═══════════════════════════════════════════════════════════════════════════════
  // FARMER ROUTES (Certificate Generation)
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/v1/organic-certificates/generate
   * Generate new organic certificate
   * Auth: Farmer JWT
   */
  router.post(
    '/generate',
    authenticate(['PRODUCER', 'ADMIN']),
    RateLimiterConfig.creation(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const farmerId = req.user?.producerId || req.user?.id;
        if (!farmerId) {
          return res.status(401).json({
            success: false,
            error: 'Farmer ID not found in token',
          });
        }

        const validation = createCertificateSchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: 'Validation error',
            details: validation.error.errors,
          });
        }

        const result = await createCertificateUseCase.execute({
          farmerId,
          ...validation.data,
          harvestDate: validation.data.harvestDate
            ? new Date(validation.data.harvestDate)
            : undefined,
        });

        logger.info('Certificate generation initiated via API', {
          certificateId: result.certificate.id,
          certificateNumber: result.certificate.certificateNumber,
          farmerId,
        });

        res.status(202).json({
          success: true,
          data: {
            certificateId: result.certificate.id,
            certificateNumber: result.certificate.certificateNumber,
            status: result.certificate.status,
          },
          message: result.message,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/organic-certificates
   * List farmer's certificates
   * Auth: Farmer JWT
   */
  router.get(
    '/',
    authenticate(['PRODUCER', 'ADMIN', 'EXPORT_COMPANY_ADMIN']),
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const farmerId = req.user?.producerId;
        const exportCompanyId = req.user?.exportCompanyAdminId;
        const isAdmin = req.user?.role === 'ADMIN';

        const validation = listCertificatesSchema.safeParse(req.query);
        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: 'Validation error',
            details: validation.error.errors,
          });
        }

        const result = await listCertificatesUseCase.execute({
          farmerId: isAdmin ? undefined : farmerId,
          exportCompanyId: exportCompanyId || undefined,
          ...validation.data,
          fromDate: validation.data.fromDate
            ? new Date(validation.data.fromDate)
            : undefined,
          toDate: validation.data.toDate
            ? new Date(validation.data.toDate)
            : undefined,
        });

        res.json({
          success: true,
          data: result.certificates,
          meta: {
            total: result.total,
            limit: result.limit,
            offset: result.offset,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/organic-certificates/:id
   * Get certificate details
   * Auth: Farmer JWT (own certificates) or Export Company Admin
   */
  router.get(
    '/:id',
    authenticate(['PRODUCER', 'ADMIN', 'EXPORT_COMPANY_ADMIN']),
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const includeDetails = req.query.details === 'true';

        const result = await getCertificateUseCase.execute({
          certificateId: id,
          includeDetails,
        });

        res.json({
          success: true,
          data: result.certificate,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/organic-certificates/:id/download-pdf
   * Download certificate PDF
   * Auth: Farmer JWT or Export Company Admin
   */
  router.get(
    '/:id/download-pdf',
    authenticate(['PRODUCER', 'ADMIN', 'EXPORT_COMPANY_ADMIN']),
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;

        const result = await downloadPdfUseCase.execute({ certificateId: id });

        // Redirect to PDF URL
        res.redirect(result.pdfUrl);
      } catch (error) {
        next(error);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // EXPORT COMPANY ADMIN ROUTES (Certificate Review)
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/v1/organic-certificates/pending-review
   * Get certificates pending review for export company
   * Auth: Export Company Admin JWT
   */
  router.get(
    '/pending-review',
    authenticate(['EXPORT_COMPANY_ADMIN', 'ADMIN']),
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const exportCompanyId = req.user?.exportCompanyAdminId;
        if (!exportCompanyId) {
          return res.status(403).json({
            success: false,
            error: 'Export company admin access required',
          });
        }

        const result = await listCertificatesUseCase.execute({
          exportCompanyId,
          status: OrganicCertificateStatus.PENDING_REVIEW,
        });

        res.json({
          success: true,
          data: result.certificates,
          meta: {
            total: result.total,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/v1/organic-certificates/:id/approve
   * Approve certificate
   * Auth: Export Company Admin JWT
   */
  router.post(
    '/:id/approve',
    authenticate(['EXPORT_COMPANY_ADMIN', 'ADMIN']),
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const reviewerId = req.user?.userId || req.user?.id;
        if (!reviewerId) {
          return res.status(401).json({
            success: false,
            error: 'Reviewer ID not found in token',
          });
        }

        const result = await approveCertificateUseCase.execute({
          certificateId: id,
          reviewerId,
        });

        logger.info('Certificate approved via API', {
          certificateId: id,
          certificateNumber: result.certificate.certificateNumber,
          reviewerId,
        });

        res.json({
          success: true,
          data: result.certificate,
          message: result.message,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/v1/organic-certificates/:id/reject
   * Reject certificate
   * Auth: Export Company Admin JWT
   */
  router.post(
    '/:id/reject',
    authenticate(['EXPORT_COMPANY_ADMIN', 'ADMIN']),
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const reviewerId = req.user?.userId || req.user?.id;
        if (!reviewerId) {
          return res.status(401).json({
            success: false,
            error: 'Reviewer ID not found in token',
          });
        }

        const validation = rejectCertificateSchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: 'Validation error',
            details: validation.error.errors,
          });
        }

        const result = await rejectCertificateUseCase.execute({
          certificateId: id,
          reviewerId,
          reason: validation.data.reason,
        });

        logger.info('Certificate rejected via API', {
          certificateId: id,
          certificateNumber: result.certificate.certificateNumber,
          reviewerId,
          reason: validation.data.reason,
        });

        res.json({
          success: true,
          data: result.certificate,
          message: result.message,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/v1/organic-certificates/:id/revoke
   * Revoke certificate (fraud detected)
   * Auth: Export Company Admin JWT
   */
  router.post(
    '/:id/revoke',
    authenticate(['EXPORT_COMPANY_ADMIN', 'ADMIN']),
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;

        const validation = revokeCertificateSchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: 'Validation error',
            details: validation.error.errors,
          });
        }

        const result = await revokeCertificateUseCase.execute({
          certificateId: id,
          reason: validation.data.reason,
        });

        logger.warn('Certificate revoked via API', {
          certificateId: id,
          certificateNumber: result.certificate.certificateNumber,
          reason: validation.data.reason,
        });

        res.json({
          success: true,
          data: result.certificate,
          message: result.message,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
