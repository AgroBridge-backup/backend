/**
 * Export Company Dashboard Routes
 * B2B Admin Portal API - All endpoints require EXPORT_COMPANY_ADMIN role
 *
 * Endpoints:
 * - Dashboard Analytics (2)
 * - Certificate Review (3)
 * - Farmer Management (5)
 * - Billing & Invoicing (4)
 * - Company Settings (3)
 */

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import {
  GetDashboardStatsUseCase,
  GetCertificateAnalyticsUseCase,
  GetPendingCertificatesUseCase,
  ReviewCertificateUseCase,
  BulkApproveCertificatesUseCase,
  ListCompanyFarmersUseCase,
  GetFarmerDetailsUseCase,
  InviteFarmersBulkUseCase,
  GetInvitationStatsUseCase,
  GetCurrentUsageUseCase,
  GenerateInvoiceUseCase,
  GetInvoiceHistoryUseCase,
  GetCompanyProfileUseCase,
  UpdateCompanyProfileUseCase,
  UpdateBrandingSettingsUseCase,
} from "../../application/use-cases/export-company-dashboard/index.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { RateLimiterConfig } from "../../infrastructure/http/middleware/rate-limiter.middleware.js";
import { logger } from "../../infrastructure/logging/logger.js";

// ════════════════════════════════════════════════════════════════════════════════
// VALIDATION SCHEMAS
// ════════════════════════════════════════════════════════════════════════════════

const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const requiredDateRangeSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "farmerName", "cropType"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

const farmerFilterSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const bulkInviteFarmersSchema = z.object({
  farmers: z
    .array(
      z.object({
        email: z.string().email(),
        name: z.string().min(2).max(100).optional(),
      }),
    )
    .min(1)
    .max(500),
});

const bulkApproveSchema = z.object({
  certificateIds: z.array(z.string().uuid()).min(1).max(50),
});

const reviewCertificateSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().min(10).max(500).optional(),
});

const generateInvoiceSchema = z.object({
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
});

const updateProfileSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  phone: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  contactName: z.string().min(2).max(255).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(20).optional(),
});

const updateBrandingSchema = z.object({
  logoUrl: z.string().url().optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
});

// ════════════════════════════════════════════════════════════════════════════════
// HELPER: Get company ID from authenticated user
// ════════════════════════════════════════════════════════════════════════════════

function getCompanyId(req: Request): string {
  const user = req.user;
  if (!user?.exportCompanyId) {
    throw new Error("Export company ID not found in token");
  }
  return user.exportCompanyId;
}

function getUserId(req: Request): string {
  const user = req.user;
  return user?.userId || user?.id || "";
}

// ════════════════════════════════════════════════════════════════════════════════
// ROUTER FACTORY
// ════════════════════════════════════════════════════════════════════════════════

export function createExportCompanyDashboardRouter(
  prisma: PrismaClient,
): Router {
  const router = Router();

  // Initialize use cases
  const getDashboardStatsUseCase = new GetDashboardStatsUseCase(prisma);
  const getCertificateAnalyticsUseCase = new GetCertificateAnalyticsUseCase(
    prisma,
  );
  const getPendingCertificatesUseCase = new GetPendingCertificatesUseCase(
    prisma,
  );
  const reviewCertificateUseCase = new ReviewCertificateUseCase(prisma);
  const bulkApproveCertificatesUseCase = new BulkApproveCertificatesUseCase(
    prisma,
  );
  const listCompanyFarmersUseCase = new ListCompanyFarmersUseCase(prisma);
  const getFarmerDetailsUseCase = new GetFarmerDetailsUseCase(prisma);
  const inviteFarmersBulkUseCase = new InviteFarmersBulkUseCase(prisma);
  const getInvitationStatsUseCase = new GetInvitationStatsUseCase(prisma);
  const getCurrentUsageUseCase = new GetCurrentUsageUseCase(prisma);
  const generateInvoiceUseCase = new GenerateInvoiceUseCase(prisma);
  const getInvoiceHistoryUseCase = new GetInvoiceHistoryUseCase(prisma);
  const getCompanyProfileUseCase = new GetCompanyProfileUseCase(prisma);
  const updateCompanyProfileUseCase = new UpdateCompanyProfileUseCase(prisma);
  const updateBrandingSettingsUseCase = new UpdateBrandingSettingsUseCase(
    prisma,
  );

  // All routes require EXPORT_COMPANY_ADMIN authentication
  router.use(authenticate(["EXPORT_COMPANY_ADMIN", "ADMIN"]));

  // ════════════════════════════════════════════════════════════════════════════════
  // DASHBOARD ANALYTICS
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/v1/export-company/dashboard/stats
   * Get comprehensive dashboard statistics
   */
  router.get(
    "/stats",
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = getCompanyId(req);
        const validation = dateRangeSchema.safeParse(req.query);

        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: "Validation error",
            details: validation.error.errors,
          });
        }

        const { startDate, endDate } = validation.data;
        const dateRange =
          startDate && endDate
            ? { start: new Date(startDate), end: new Date(endDate) }
            : undefined;

        const stats = await getDashboardStatsUseCase.execute(
          companyId,
          dateRange,
        );

        res.json({
          success: true,
          data: stats,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/export-company/dashboard/certificate-analytics
   * Get detailed certificate analytics
   */
  router.get(
    "/certificate-analytics",
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = getCompanyId(req);
        const validation = requiredDateRangeSchema.safeParse(req.query);

        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: "Validation error",
            details: validation.error.errors,
          });
        }

        const { startDate, endDate } = validation.data;
        const analytics = await getCertificateAnalyticsUseCase.execute(
          companyId,
          {
            start: new Date(startDate),
            end: new Date(endDate),
          },
        );

        res.json({
          success: true,
          data: analytics,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  // ════════════════════════════════════════════════════════════════════════════════
  // CERTIFICATE REVIEW
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/v1/export-company/dashboard/certificates/pending
   * Get pending certificates for review
   */
  router.get(
    "/certificates/pending",
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = getCompanyId(req);
        const validation = paginationSchema.safeParse(req.query);

        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: "Validation error",
            details: validation.error.errors,
          });
        }

        const result = await getPendingCertificatesUseCase.execute(
          companyId,
          validation.data,
        );

        res.json({
          success: true,
          ...result,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/export-company/dashboard/certificates/:id/review
   * Review a single certificate (approve/reject)
   */
  router.post(
    "/certificates/:id/review",
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = getCompanyId(req);
        const reviewerId = getUserId(req);
        const { id } = req.params;
        const validation = reviewCertificateSchema.safeParse(req.body);

        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: "Validation error",
            details: validation.error.errors,
          });
        }

        const { action, reason } = validation.data;

        if (action === "reject" && !reason) {
          return res.status(400).json({
            success: false,
            error: "Rejection reason is required",
          });
        }

        const certificate = await reviewCertificateUseCase.execute(
          { certificateId: id, action, reviewerId, reason },
          companyId,
        );

        logger.info("Certificate reviewed via dashboard", {
          certificateId: id,
          action,
          reviewerId,
        });

        res.json({
          success: true,
          data: certificate,
          message:
            action === "approve"
              ? "Certificate approved successfully"
              : "Certificate rejected",
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/export-company/dashboard/certificates/bulk-approve
   * Bulk approve multiple certificates
   */
  router.post(
    "/certificates/bulk-approve",
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = getCompanyId(req);
        const reviewerId = getUserId(req);
        const validation = bulkApproveSchema.safeParse(req.body);

        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: "Validation error",
            details: validation.error.errors,
          });
        }

        const result = await bulkApproveCertificatesUseCase.execute(
          validation.data.certificateIds,
          reviewerId,
          companyId,
        );

        logger.info("Bulk certificate approval via dashboard", {
          companyId,
          total: result.total,
          success: result.success,
          failed: result.failed,
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

  // ════════════════════════════════════════════════════════════════════════════════
  // FARMER MANAGEMENT
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/v1/export-company/dashboard/farmers
   * List company farmers with filtering and pagination
   */
  router.get(
    "/farmers",
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = getCompanyId(req);
        const validation = farmerFilterSchema.safeParse(req.query);

        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: "Validation error",
            details: validation.error.errors,
          });
        }

        const result = await listCompanyFarmersUseCase.execute(
          companyId,
          validation.data,
        );

        res.json({
          success: true,
          ...result,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/export-company/dashboard/farmers/:farmerId
   * Get farmer details with full statistics
   */
  router.get(
    "/farmers/:farmerId",
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = getCompanyId(req);
        const { farmerId } = req.params;

        const farmer = await getFarmerDetailsUseCase.execute(
          farmerId,
          companyId,
        );

        res.json({
          success: true,
          data: farmer,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/export-company/dashboard/farmers/invite-bulk
   * Bulk invite farmers (CSV upload)
   */
  router.post(
    "/farmers/invite-bulk",
    RateLimiterConfig.creation(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = getCompanyId(req);
        const validation = bulkInviteFarmersSchema.safeParse(req.body);

        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: "Validation error",
            details: validation.error.errors,
          });
        }

        const result = await inviteFarmersBulkUseCase.execute(
          companyId,
          validation.data.farmers,
        );

        logger.info("Bulk farmer invitation via dashboard", {
          companyId,
          total: result.total,
          success: result.success,
          failed: result.failed,
        });

        res.status(201).json({
          success: true,
          data: result,
          message:
            "Invitations processed: " +
            result.success +
            " sent, " +
            result.failed +
            " failed",
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/export-company/dashboard/invitations/status
   * Get invitation statistics
   */
  router.get(
    "/invitations/status",
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = getCompanyId(req);

        const stats = await getInvitationStatsUseCase.execute(companyId);

        res.json({
          success: true,
          data: stats,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/export-company/dashboard/invitations/:invitationId/resend
   * Resend farmer invitation
   */
  router.post(
    "/invitations/:invitationId/resend",
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = getCompanyId(req);
        const { invitationId } = req.params;

        // Update invitation with new expiry
        const newExpiresAt = new Date();
        newExpiresAt.setDate(newExpiresAt.getDate() + 7);

        const invitation = await prisma.farmerInvitation.updateMany({
          where: {
            id: invitationId,
            exportCompanyId: companyId,
            status: "PENDING",
          },
          data: {
            expiresAt: newExpiresAt,
            sentAt: new Date(),
          },
        });

        if (invitation.count === 0) {
          return res.status(404).json({
            success: false,
            error: "Invitation not found or already processed",
          });
        }

        logger.info("Invitation resent", { invitationId, companyId });

        res.json({
          success: true,
          message: "Invitation resent successfully",
        });
      } catch (error) {
        next(error);
      }
    },
  );

  // ════════════════════════════════════════════════════════════════════════════════
  // BILLING & INVOICING
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/v1/export-company/dashboard/billing/usage
   * Get current billing period usage
   */
  router.get(
    "/billing/usage",
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = getCompanyId(req);

        const usage = await getCurrentUsageUseCase.execute(companyId);

        res.json({
          success: true,
          data: usage,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/export-company/dashboard/billing/generate-invoice
   * Generate invoice for specified period
   */
  router.post(
    "/billing/generate-invoice",
    RateLimiterConfig.creation(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = getCompanyId(req);
        const validation = generateInvoiceSchema.safeParse(req.body);

        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: "Validation error",
            details: validation.error.errors,
          });
        }

        const { periodStart, periodEnd } = validation.data;

        const invoice = await generateInvoiceUseCase.execute(
          companyId,
          new Date(periodStart),
          new Date(periodEnd),
        );

        logger.info("Invoice generated via dashboard", {
          companyId,
          invoiceNumber: invoice.invoiceNumber,
          total: invoice.total,
        });

        res.status(201).json({
          success: true,
          data: invoice,
          message: "Invoice generated successfully",
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/export-company/dashboard/billing/invoices
   * Get invoice history
   */
  router.get(
    "/billing/invoices",
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = getCompanyId(req);

        const invoices = await getInvoiceHistoryUseCase.execute(companyId);

        res.json({
          success: true,
          data: invoices,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/export-company/dashboard/billing/invoices/:invoiceId/download
   * Download invoice PDF
   */
  router.get(
    "/billing/invoices/:invoiceId/download",
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = getCompanyId(req);
        const { invoiceId } = req.params;

        const invoice = await prisma.exportCompanyInvoice.findFirst({
          where: { id: invoiceId, exportCompanyId: companyId },
        });

        if (!invoice) {
          return res.status(404).json({
            success: false,
            error: "Invoice not found",
          });
        }

        if (!invoice.pdfUrl) {
          return res.status(404).json({
            success: false,
            error: "Invoice PDF not yet generated",
          });
        }

        res.redirect(invoice.pdfUrl);
      } catch (error) {
        next(error);
      }
    },
  );

  // ════════════════════════════════════════════════════════════════════════════════
  // COMPANY SETTINGS
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/v1/export-company/dashboard/settings/profile
   * Get company profile
   */
  router.get(
    "/settings/profile",
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = getCompanyId(req);

        const profile = await getCompanyProfileUseCase.execute(companyId);

        res.json({
          success: true,
          data: profile,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * PUT /api/v1/export-company/dashboard/settings/profile
   * Update company profile
   */
  router.put(
    "/settings/profile",
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = getCompanyId(req);
        const validation = updateProfileSchema.safeParse(req.body);

        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: "Validation error",
            details: validation.error.errors,
          });
        }

        const updated = await updateCompanyProfileUseCase.execute(
          companyId,
          validation.data,
        );

        logger.info("Company profile updated via dashboard", { companyId });

        res.json({
          success: true,
          data: updated,
          message: "Profile updated successfully",
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * PUT /api/v1/export-company/dashboard/settings/branding
   * Update white-label branding settings
   */
  router.put(
    "/settings/branding",
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = getCompanyId(req);
        const validation = updateBrandingSchema.safeParse(req.body);

        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: "Validation error",
            details: validation.error.errors,
          });
        }

        const updated = await updateBrandingSettingsUseCase.execute(
          companyId,
          validation.data,
        );

        logger.info("Company branding updated via dashboard", { companyId });

        res.json({
          success: true,
          data: {
            logoUrl: updated.logoUrl,
            primaryColor: updated.primaryColor,
          },
          message: "Branding updated successfully",
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
