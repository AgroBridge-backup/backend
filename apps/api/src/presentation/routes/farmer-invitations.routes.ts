/**
 * Farmer Invitations Routes
 * RESTful API endpoints for B2B2C farmer enrollment flow
 * Export companies invite farmers → farmers receive email → farmers register
 */

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { PrismaFarmerInvitationRepository } from "../../infrastructure/database/prisma/repositories/PrismaFarmerInvitationRepository.js";
import { PrismaExportCompanyRepository } from "../../infrastructure/database/prisma/repositories/PrismaExportCompanyRepository.js";
import { FarmerInvitationService } from "../../domain/services/FarmerInvitationService.js";
import {
  SendInvitationUseCase,
  ValidateInvitationUseCase,
  ListInvitationsUseCase,
  CancelInvitationUseCase,
  ResendInvitationUseCase,
  GetInvitationStatsUseCase,
} from "../../application/use-cases/farmer-invitations/index.js";
import { FarmerInvitationStatus } from "../../domain/entities/FarmerInvitation.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { RateLimiterConfig } from "../../infrastructure/http/middleware/rate-limiter.middleware.js";
import { logger } from "../../infrastructure/logging/logger.js";

// Validation schemas
const sendInvitationSchema = z.object({
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  farmerName: z.string().max(255).optional(),
});

const listInvitationsSchema = z.object({
  status: z.nativeEnum(FarmerInvitationStatus).optional(),
  email: z.string().max(255).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

/**
 * Factory function to create farmer invitations router with dependencies
 */
export function createFarmerInvitationsRouter(prisma: PrismaClient): Router {
  const router = Router();

  // Initialize repositories and services
  const invitationRepository = new PrismaFarmerInvitationRepository(prisma);
  const companyRepository = new PrismaExportCompanyRepository(prisma);
  const invitationService = new FarmerInvitationService(
    invitationRepository,
    companyRepository,
  );

  // Initialize use cases
  const sendInvitationUseCase = new SendInvitationUseCase(invitationService);
  const validateInvitationUseCase = new ValidateInvitationUseCase(
    invitationService,
  );
  const listInvitationsUseCase = new ListInvitationsUseCase(invitationService);
  const cancelInvitationUseCase = new CancelInvitationUseCase(
    invitationService,
  );
  const resendInvitationUseCase = new ResendInvitationUseCase(
    invitationService,
  );
  const getInvitationStatsUseCase = new GetInvitationStatsUseCase(
    invitationService,
  );

  /**
   * POST /api/v1/export-companies/:companyId/invitations
   * Send a new invitation to a farmer
   */
  router.post(
    "/:companyId/invitations",
    authenticate(["ADMIN"]),
    RateLimiterConfig.creation(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { companyId } = req.params;
        const validation = sendInvitationSchema.safeParse(req.body);

        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: "Validation error",
            details: validation.error.errors,
          });
        }

        // Get base URL from request
        const baseUrl = `${req.protocol}://${req.get("host")}`;

        const result = await sendInvitationUseCase.execute({
          exportCompanyId: companyId,
          email: validation.data.email,
          phone: validation.data.phone,
          farmerName: validation.data.farmerName,
          baseUrl,
        });

        logger.info("Farmer invitation sent via API", {
          invitationId: result.invitation.id,
          companyId,
          email: validation.data.email,
        });

        res.status(201).json({
          success: true,
          data: {
            invitation: result.invitation,
            signupUrl: result.signupUrl,
          },
          message: result.message,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/export-companies/:companyId/invitations
   * List invitations for an export company
   */
  router.get(
    "/:companyId/invitations",
    authenticate(["ADMIN"]),
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { companyId } = req.params;
        const validation = listInvitationsSchema.safeParse(req.query);

        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: "Validation error",
            details: validation.error.errors,
          });
        }

        const result = await listInvitationsUseCase.execute({
          exportCompanyId: companyId,
          ...validation.data,
        });

        res.json({
          success: true,
          data: result.invitations,
          meta: {
            total: result.total,
            limit: result.limit,
            offset: result.offset,
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/export-companies/:companyId/invitations/stats
   * Get invitation statistics for an export company
   */
  router.get(
    "/:companyId/invitations/stats",
    authenticate(["ADMIN"]),
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { companyId } = req.params;

        const result = await getInvitationStatsUseCase.execute({
          exportCompanyId: companyId,
        });

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/export-companies/:companyId/invitations/:id/resend
   * Resend an invitation with a new token
   */
  router.post(
    "/:companyId/invitations/:id/resend",
    authenticate(["ADMIN"]),
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { companyId, id } = req.params;
        const baseUrl = `${req.protocol}://${req.get("host")}`;

        const result = await resendInvitationUseCase.execute({
          invitationId: id,
          exportCompanyId: companyId,
          baseUrl,
        });

        logger.info("Farmer invitation resent via API", {
          invitationId: id,
          companyId,
        });

        res.json({
          success: true,
          data: {
            invitation: result.invitation,
            signupUrl: result.signupUrl,
          },
          message: result.message,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * DELETE /api/v1/export-companies/:companyId/invitations/:id
   * Cancel a pending invitation
   */
  router.delete(
    "/:companyId/invitations/:id",
    authenticate(["ADMIN"]),
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { companyId, id } = req.params;

        const result = await cancelInvitationUseCase.execute({
          invitationId: id,
          exportCompanyId: companyId,
        });

        logger.info("Farmer invitation cancelled via API", {
          invitationId: id,
          companyId,
        });

        res.json({
          success: true,
          data: result.invitation,
          message: result.message,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}

/**
 * Factory function to create public invitation validation routes
 * These routes are used during farmer signup flow
 */
export function createPublicInvitationRouter(prisma: PrismaClient): Router {
  const router = Router();

  // Initialize repositories and services
  const invitationRepository = new PrismaFarmerInvitationRepository(prisma);
  const companyRepository = new PrismaExportCompanyRepository(prisma);
  const invitationService = new FarmerInvitationService(
    invitationRepository,
    companyRepository,
  );
  const validateInvitationUseCase = new ValidateInvitationUseCase(
    invitationService,
  );

  /**
   * GET /api/v1/invitations/validate/:token
   * Validate an invitation token (public endpoint for signup flow)
   */
  router.get(
    "/validate/:token",
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { token } = req.params;

        const result = await validateInvitationUseCase.execute({ token });

        if (!result.valid) {
          return res.status(400).json({
            success: false,
            valid: false,
            reason: result.reason,
          });
        }

        res.json({
          success: true,
          valid: true,
          data: {
            email: result.invitation?.email,
            farmerName: result.invitation?.farmerName,
            phone: result.invitation?.phone,
            exportCompany: result.invitation?.exportCompany,
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
