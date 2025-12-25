/**
 * Export Companies Routes
 * RESTful API endpoints for B2B export company management
 * Primary revenue source: SaaS subscription + per-certificate transaction fees
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { PrismaExportCompanyRepository } from '../../infrastructure/database/prisma/repositories/PrismaExportCompanyRepository.js';
import { ExportCompanyService } from '../../domain/services/ExportCompanyService.js';
import {
  RegisterExportCompanyUseCase,
  GetExportCompanyUseCase,
  ListExportCompaniesUseCase,
  UpdateExportCompanyUseCase,
  UpgradeTierUseCase,
  CheckCapacityUseCase,
} from '../../application/use-cases/export-companies/index.js';
import { ExportCompanyTier, ExportCompanyStatus } from '../../domain/entities/ExportCompany.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { RateLimiterConfig } from '../../infrastructure/http/middleware/rate-limiter.middleware.js';
import { logger } from '../../infrastructure/logging/logger.js';

// Validation schemas
const registerCompanySchema = z.object({
  name: z.string().min(2).max(255),
  legalName: z.string().max(255).optional(),
  rfc: z.string().min(12).max(13),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  country: z.string().default('MX'),
  state: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  postalCode: z.string().max(10).optional(),
  contactName: z.string().min(2).max(255),
  contactEmail: z.string().email(),
  contactPhone: z.string().max(20).optional(),
  tier: z.nativeEnum(ExportCompanyTier).default(ExportCompanyTier.STARTER),
  enabledStandards: z.array(z.string()).optional(),
  logoUrl: z.string().url().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

const updateCompanySchema = z.object({
  name: z.string().min(2).max(255).optional(),
  legalName: z.string().max(255).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  state: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  postalCode: z.string().max(10).optional(),
  contactName: z.string().min(2).max(255).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(20).optional(),
  enabledStandards: z.array(z.string()).optional(),
  logoUrl: z.string().url().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

const listCompaniesSchema = z.object({
  status: z.nativeEnum(ExportCompanyStatus).optional(),
  tier: z.nativeEnum(ExportCompanyTier).optional(),
  search: z.string().max(100).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

const upgradeTierSchema = z.object({
  newTier: z.nativeEnum(ExportCompanyTier),
});

/**
 * Factory function to create export companies router with dependencies
 */
export function createExportCompaniesRouter(prisma: PrismaClient): Router {
  const router = Router();

  // Initialize repository, service, and use cases
  const exportCompanyRepository = new PrismaExportCompanyRepository(prisma);
  const exportCompanyService = new ExportCompanyService(exportCompanyRepository);

  const registerCompanyUseCase = new RegisterExportCompanyUseCase(exportCompanyService);
  const getCompanyUseCase = new GetExportCompanyUseCase(exportCompanyService);
  const listCompaniesUseCase = new ListExportCompaniesUseCase(exportCompanyService);
  const updateCompanyUseCase = new UpdateExportCompanyUseCase(exportCompanyService);
  const upgradeTierUseCase = new UpgradeTierUseCase(exportCompanyService);
  const checkCapacityUseCase = new CheckCapacityUseCase(exportCompanyService);

  /**
   * POST /api/v1/export-companies
   * Register a new export company (14-day trial)
   */
  router.post(
    '/',
    authenticate(['ADMIN']),
    RateLimiterConfig.creation(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const validation = registerCompanySchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: 'Validation error',
            details: validation.error.errors,
          });
        }

        const result = await registerCompanyUseCase.execute(validation.data);

        logger.info('Export company registered via API', {
          companyId: result.company.id,
          name: result.company.name,
          tier: result.company.tier,
        });

        res.status(201).json({
          success: true,
          data: result.company,
          trialEndsAt: result.trialEndsAt,
          message: result.message,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/export-companies
   * List export companies with filtering and pagination
   */
  router.get(
    '/',
    authenticate(['ADMIN']),
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const validation = listCompaniesSchema.safeParse(req.query);
        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: 'Validation error',
            details: validation.error.errors,
          });
        }

        const result = await listCompaniesUseCase.execute(validation.data);

        res.json({
          success: true,
          data: result.companies,
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
   * GET /api/v1/export-companies/:id
   * Get export company details with usage statistics
   */
  router.get(
    '/:id',
    authenticate(['ADMIN']),
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;

        const result = await getCompanyUseCase.execute({
          companyId: id,
          includeStats: true,
        });

        res.json({
          success: true,
          data: result.company,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * PATCH /api/v1/export-companies/:id
   * Update export company details
   */
  router.patch(
    '/:id',
    authenticate(['ADMIN']),
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const validation = updateCompanySchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: 'Validation error',
            details: validation.error.errors,
          });
        }

        const result = await updateCompanyUseCase.execute({
          companyId: id,
          ...validation.data,
        });

        logger.info('Export company updated via API', {
          companyId: id,
        });

        res.json({
          success: true,
          data: result.company,
          message: result.message,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/v1/export-companies/:id/upgrade
   * Upgrade export company tier
   */
  router.post(
    '/:id/upgrade',
    authenticate(['ADMIN']),
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const validation = upgradeTierSchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: 'Validation error',
            details: validation.error.errors,
          });
        }

        const result = await upgradeTierUseCase.execute({
          companyId: id,
          newTier: validation.data.newTier,
        });

        logger.info('Export company tier upgraded via API', {
          companyId: id,
          previousTier: result.previousTier,
          newTier: result.newTier,
        });

        res.json({
          success: true,
          data: result.company,
          previousTier: result.previousTier,
          newTier: result.newTier,
          newLimits: result.newLimits,
          message: result.message,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/export-companies/:id/capacity
   * Check export company capacity for farmers and certificates
   */
  router.get(
    '/:id/capacity',
    authenticate(['ADMIN']),
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;

        const result = await checkCapacityUseCase.execute({ companyId: id });

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/export-companies/tiers/config
   * Get tier configuration and pricing
   */
  router.get(
    '/tiers/config',
    authenticate(['ADMIN']),
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        res.json({
          success: true,
          data: {
            tiers: [
              {
                tier: ExportCompanyTier.STARTER,
                name: 'Starter',
                monthlyFee: 500,
                certificateFee: 10,
                farmersIncluded: 10,
                certsIncluded: 50,
                description: 'Perfect for small export operations',
              },
              {
                tier: ExportCompanyTier.PROFESSIONAL,
                name: 'Professional',
                monthlyFee: 1000,
                certificateFee: 8,
                farmersIncluded: 50,
                certsIncluded: 200,
                description: 'For growing export companies',
              },
              {
                tier: ExportCompanyTier.ENTERPRISE,
                name: 'Enterprise',
                monthlyFee: 2000,
                certificateFee: 5,
                farmersIncluded: -1,
                certsIncluded: -1,
                description: 'Unlimited access for large operations',
              },
            ],
            trialDuration: 14,
            currency: 'USD',
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
