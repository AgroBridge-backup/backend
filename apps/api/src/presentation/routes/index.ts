import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { createAuthRouter } from "./auth.routes.js";
import { createBatchesRouter } from "./batches.routes.js";
import { createEventsRouter } from "./events.routes.js";
import { createProducersRouter } from "./producers.routes.js";
import { createNotificationsRouter } from "./notifications.routes.js";
import { createUploadRouter } from "./upload.routes.js";
import { createPaymentRouter } from "./payment.routes.js";
import { createReportRouter } from "./report.routes.js";
import { createCashFlowBridgeRouter } from "./cash-flow-bridge.routes.js";
import { AllUseCases } from "../../application/use-cases/index.js";

// Traceability 2.0 Routes
import { createVerificationStagesRouter } from "./verification-stages.routes.js";
import {
  createCertificatesRouter,
  CertificatesUseCases,
} from "./certificates.routes.js";
import { createTransitRouter } from "./transit.routes.js";
import { createTemperatureRoutes } from "./temperature.routes.js";
// Satellite Compliance Analysis (NDVI-based organic verification)
import {
  createSatelliteAnalysisRouter,
  createSatelliteAnalysisDirectRouter,
} from "./satellite-analysis.routes.js";

// FinTech Module Routes
import whatsappRoutes from "../../modules/whatsapp-bot/whatsapp.routes.js";
import collectionsRoutes from "../../modules/collections/routes/index.js";
import creditScoringRoutes from "../../modules/credit-scoring/routes/index.js";
import repaymentsRoutes from "../../modules/repayments/routes/index.js";
import logger from "../../shared/utils/logger.js";

// Invoicing & Referrals Module Routes
import createInvoicingRouter from "./invoicing.routes.js";
import createReferralsRouter from "./referrals.routes.js";

// API Key Management Routes
import { createApiKeysRouter } from "./api-keys.routes.js";

// Public Traceability Routes (Consumer-Facing)
import { createPublicRoutes, createPublicLinkRoutes } from "./public.routes.js";

// Organic Certification Infrastructure Routes
import { createExportCompaniesRouter } from "./export-companies.routes.js";
import {
  createFarmerInvitationsRouter,
  createPublicInvitationRouter,
} from "./farmer-invitations.routes.js";
import { createOrganicFieldsRouter } from "./organic-fields.routes.js";
import {
  createFieldInspectionsRouter,
  createInspectionRoutes,
} from "./field-inspections.routes.js";
import { createOrganicCertificatesRouter } from "./organic-certificates.routes.js";
import { createPublicVerifyRouter } from "./public-verify.routes.js";

// B2B Admin Portal - Export Company Dashboard
import { createExportCompanyDashboardRouter } from "./export-company-dashboard.routes.js";

// Smart-Cold Chain Protocol
import {
  createColdChainRouter,
  createColdChainWebhookRouter,
} from "./cold-chain.routes.js";
import { createQualityMetricsRouter } from "./quality-metrics.routes.js";

export function createApiRouter(
  useCases: AllUseCases,
  prisma: PrismaClient,
): Router {
  const router = Router();

  router.use("/auth", createAuthRouter(useCases.auth));
  router.use("/batches", createBatchesRouter(useCases.batches));
  // Mount verification stages routes under /batches for RESTful pattern
  router.use(
    "/batches",
    createVerificationStagesRouter(useCases.verificationStages),
  );
  // Traceability 2.0 - Quality Certificates
  // Mounts both /batches/:id/certificates and /certificates/:id routes
  router.use("/", createCertificatesRouter(useCases.certificates));
  // Traceability 2.0 - Real-Time Transit Tracking
  // Mounts /batches/:id/transit and /transit/:sessionId routes
  router.use("/", createTransitRouter(useCases.transit));
  // Traceability 2.0 - Cold Chain Temperature Monitoring
  router.use("/temperature", createTemperatureRoutes(prisma));
  // Note: NFC Seals and Satellite Imagery are POST-MVP features
  router.use("/events", createEventsRouter(useCases.events));
  router.use("/producers", createProducersRouter(useCases.producers));
  router.use("/notifications", createNotificationsRouter());
  router.use("/uploads", createUploadRouter());
  router.use("/payments", createPaymentRouter(prisma));
  router.use("/reports", createReportRouter(prisma));

  // Cash Flow Bridge Routes (Credit Scoring, Advances, Liquidity Pools, Orders)
  router.use("/", createCashFlowBridgeRouter(prisma));

  // ═══════════════════════════════════════════════════════════════════════════════
  // INVOICING & REFERRALS MODULE ROUTES
  // Integrated: 2025-12-21
  // ═══════════════════════════════════════════════════════════════════════════════

  // Invoicing (Invoice management with blockchain verification)
  router.use("/invoices", createInvoicingRouter(prisma));

  // Referrals (Referral program with leaderboard)
  router.use("/referrals", createReferralsRouter(prisma));

  // ═══════════════════════════════════════════════════════════════════════════════
  // API KEY MANAGEMENT ROUTES
  // Enterprise-grade programmatic access for integrations
  // ═══════════════════════════════════════════════════════════════════════════════
  router.use("/api-keys", createApiKeysRouter(prisma));

  logger.info("✅ API Key Management routes mounted", {
    routes: [
      "POST /api/v1/api-keys",
      "GET /api/v1/api-keys",
      "GET /api/v1/api-keys/:id",
      "PATCH /api/v1/api-keys/:id",
      "DELETE /api/v1/api-keys/:id",
    ],
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // ORGANIC CERTIFICATION INFRASTRUCTURE
  // B2B Export Company Management - Primary Revenue Source
  // ═══════════════════════════════════════════════════════════════════════════════
  router.use("/export-companies", createExportCompaniesRouter(prisma));

  logger.info("✅ Export Companies routes mounted", {
    routes: [
      "POST /api/v1/export-companies",
      "GET /api/v1/export-companies",
      "GET /api/v1/export-companies/:id",
      "PATCH /api/v1/export-companies/:id",
      "POST /api/v1/export-companies/:id/upgrade",
      "GET /api/v1/export-companies/:id/capacity",
      "GET /api/v1/export-companies/tiers/config",
    ],
  });

  // Farmer Invitations (nested under export-companies for RESTful pattern)
  router.use("/export-companies", createFarmerInvitationsRouter(prisma));

  // Public invitation validation (for signup flow)
  router.use("/invitations", createPublicInvitationRouter(prisma));

  logger.info("✅ Farmer Invitations routes mounted", {
    routes: [
      "POST /api/v1/export-companies/:companyId/invitations",
      "GET /api/v1/export-companies/:companyId/invitations",
      "GET /api/v1/export-companies/:companyId/invitations/stats",
      "POST /api/v1/export-companies/:companyId/invitations/:id/resend",
      "DELETE /api/v1/export-companies/:companyId/invitations/:id",
      "GET /api/v1/invitations/validate/:token (public)",
    ],
  });

  // Organic Fields (nested under producers for RESTful pattern)
  router.use("/producers", createOrganicFieldsRouter(prisma));
  // Also mount for direct field access
  router.use("/organic-fields", createOrganicFieldsRouter(prisma));

  logger.info("✅ Organic Fields routes mounted", {
    routes: [
      "POST /api/v1/producers/:producerId/organic-fields",
      "GET /api/v1/producers/:producerId/organic-fields",
      "GET /api/v1/producers/:producerId/organic-fields/stats",
      "GET /api/v1/organic-fields/:id",
      "PATCH /api/v1/organic-fields/:id",
      "POST /api/v1/organic-fields/:id/certify",
      "POST /api/v1/organic-fields/:id/verify-location",
      "GET /api/v1/organic-fields/config/options",
    ],
  });

  // Field Inspections (nested under organic-fields for RESTful pattern)
  router.use("/organic-fields", createFieldInspectionsRouter(prisma));
  // Also mount for direct inspection access
  router.use("/inspections", createInspectionRoutes(prisma));

  logger.info("✅ Field Inspections routes mounted", {
    routes: [
      "POST /api/v1/organic-fields/:fieldId/inspections",
      "GET /api/v1/organic-fields/:fieldId/inspections",
      "GET /api/v1/organic-fields/:fieldId/inspections/stats",
      "GET /api/v1/inspections/:id",
      "PATCH /api/v1/inspections/:id/notes",
      "POST /api/v1/inspections/:id/verify",
      "GET /api/v1/inspections/:id/details",
      "POST /api/v1/inspections/:id/photos",
      "POST /api/v1/inspections/:id/organic-inputs",
      "POST /api/v1/inspections/organic-inputs/:inputId/verify",
      "POST /api/v1/inspections/:id/activities",
      "GET /api/v1/inspections/config/options",
    ],
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SATELLITE COMPLIANCE ANALYSIS (AI-Powered)
  // NDVI-based organic compliance verification using Sentinel-2 satellite data
  // Replaces $200-500 soil tests with instant satellite verification
  // ═══════════════════════════════════════════════════════════════════════════════
  router.use("/organic-fields", createSatelliteAnalysisRouter(prisma));
  router.use(
    "/satellite-analyses",
    createSatelliteAnalysisDirectRouter(prisma),
  );

  logger.info("✅ Satellite Compliance Analysis routes mounted", {
    routes: [
      "POST /api/v1/organic-fields/:fieldId/satellite-compliance",
      "GET /api/v1/organic-fields/:fieldId/satellite-analyses",
      "GET /api/v1/organic-fields/:fieldId/satellite-analyses/latest",
      "GET /api/v1/satellite-analyses/:id",
      "GET /api/v1/satellite-analyses/stats",
      "GET /api/v1/satellite-analyses/health",
    ],
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // ORGANIC CERTIFICATES (Revenue-Critical: $5-20/certificate)
  // Blockchain-anchored organic certificates for Mexican exports
  // ═══════════════════════════════════════════════════════════════════════════════
  router.use("/organic-certificates", createOrganicCertificatesRouter(prisma));

  // Public certificate verification (NO AUTH - for QR code scanning)
  router.use("/verify", createPublicVerifyRouter(prisma));

  logger.info("✅ Organic Certificates routes mounted", {
    routes: [
      "POST /api/v1/organic-certificates/generate",
      "GET /api/v1/organic-certificates",
      "GET /api/v1/organic-certificates/:id",
      "GET /api/v1/organic-certificates/:id/download-pdf",
      "GET /api/v1/organic-certificates/pending-review",
      "POST /api/v1/organic-certificates/:id/approve",
      "POST /api/v1/organic-certificates/:id/reject",
      "POST /api/v1/organic-certificates/:id/revoke",
      "GET /api/v1/verify/:certificateNumber (public)",
      "GET /api/v1/verify/:certificateNumber/blockchain-proof (public)",
      "GET /api/v1/verify/:certificateNumber/qr (public)",
    ],
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // B2B ADMIN PORTAL - EXPORT COMPANY DASHBOARD
  // Week 4: Dashboard analytics, certificate review, farmer management, billing
  // ═══════════════════════════════════════════════════════════════════════════════
  router.use("/dashboard", createExportCompanyDashboardRouter(prisma));

  logger.info("✅ Export Company Dashboard routes mounted", {
    routes: [
      "GET /api/v1/dashboard/stats",
      "GET /api/v1/dashboard/certificate-analytics",
      "GET /api/v1/dashboard/certificates/pending",
      "POST /api/v1/dashboard/certificates/:id/review",
      "POST /api/v1/dashboard/certificates/bulk-approve",
      "GET /api/v1/dashboard/farmers",
      "GET /api/v1/dashboard/farmers/:farmerId",
      "POST /api/v1/dashboard/farmers/invite-bulk",
      "GET /api/v1/dashboard/invitations/status",
      "POST /api/v1/dashboard/invitations/:invitationId/resend",
      "GET /api/v1/dashboard/billing/usage",
      "POST /api/v1/dashboard/billing/generate-invoice",
      "GET /api/v1/dashboard/billing/invoices",
      "GET /api/v1/dashboard/billing/invoices/:invoiceId/download",
      "GET /api/v1/dashboard/settings/profile",
      "PUT /api/v1/dashboard/settings/profile",
      "PUT /api/v1/dashboard/settings/branding",
    ],
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // PUBLIC TRACEABILITY ROUTES (Consumer-Facing)
  // Farmer Storytelling & QR Traceability Pages
  // ═══════════════════════════════════════════════════════════════════════════════

  // Public unauthenticated routes
  router.use("/public", createPublicRoutes(prisma));

  // Authenticated routes for generating public links
  router.use("/batches", createPublicLinkRoutes(prisma));

  logger.info("✅ Public Traceability routes mounted", {
    routes: [
      "GET /api/v1/public/farmers/:farmerId",
      "GET /api/v1/public/batches/:shortCode",
      "POST /api/v1/public/events/scan",
      "POST /api/v1/batches/:id/public-link",
      "GET /api/v1/batches/:id/public-stats",
    ],
  });

  logger.info("✅ Invoicing & Referrals routes mounted", {
    routes: [
      "POST /api/v1/invoices",
      "GET /api/v1/invoices/:id",
      "GET /api/v1/invoices",
      "PATCH /api/v1/invoices/:id/paid",
      "POST /api/v1/referrals/register",
      "GET /api/v1/referrals/stats",
      "GET /api/v1/referrals/leaderboard",
    ],
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SMART-COLD CHAIN PROTOCOL
  // IoT-enabled cold chain monitoring + Brix/pH quality verification
  // ═══════════════════════════════════════════════════════════════════════════════

  // Cold Chain (IoT sensors, sessions, readings)
  router.use("/cold-chain", createColdChainRouter(prisma));

  // Quality Metrics (Brix/pH verification)
  router.use("/quality-metrics", createQualityMetricsRouter(prisma));

  // Cold Chain Webhooks (for IoT device callbacks)
  router.use("/webhooks/cold-chain", createColdChainWebhookRouter(prisma));

  logger.info("✅ Smart-Cold Chain Protocol routes mounted", {
    routes: [
      // Sensors
      "POST /api/v1/cold-chain/sensors",
      "GET /api/v1/cold-chain/sensors",
      "GET /api/v1/cold-chain/sensors/:id",
      "PATCH /api/v1/cold-chain/sensors/:id/assign",
      // Sessions
      "POST /api/v1/cold-chain/sessions",
      "GET /api/v1/cold-chain/sessions",
      "GET /api/v1/cold-chain/sessions/:id",
      "POST /api/v1/cold-chain/sessions/:id/end",
      "GET /api/v1/cold-chain/sessions/:id/readings",
      "GET /api/v1/cold-chain/sessions/:id/report",
      // Readings
      "POST /api/v1/cold-chain/readings",
      "POST /api/v1/cold-chain/readings/bulk",
      // Dashboard
      "GET /api/v1/cold-chain/dashboard",
      // Quality Metrics
      "POST /api/v1/quality-metrics",
      "GET /api/v1/quality-metrics",
      "GET /api/v1/quality-metrics/stats",
      "GET /api/v1/quality-metrics/thresholds",
      "GET /api/v1/quality-metrics/:id",
      "POST /api/v1/quality-metrics/:id/verify",
      // Webhook
      "POST /api/v1/webhooks/cold-chain/readings",
    ],
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // FINTECH MODULE ROUTES
  // Integrated: 2025-12-19
  // ═══════════════════════════════════════════════════════════════════════════════

  // WhatsApp Bot (Meta Cloud API webhooks)
  router.use("/", whatsappRoutes);

  // Collections (Automated payment reminders)
  router.use("/collections", collectionsRoutes);

  // Credit Scoring (Alternative credit assessment)
  router.use("/credit", creditScoringRoutes);

  // Repayments (Payment processing and tracking)
  router.use("/repayments", repaymentsRoutes);

  // FinTech Health Check (consolidated status)
  router.get("/fintech/health", (req, res) => {
    res.json({
      status: "operational",
      timestamp: new Date().toISOString(),
      version: "2.0.0",
      modules: {
        whatsapp: {
          status: process.env.META_WHATSAPP_TOKEN
            ? "configured"
            : "not_configured",
          webhookPath: "/api/v1/webhook/whatsapp",
        },
        collections: {
          status: "operational",
          cronEnabled: process.env.COLLECTIONS_ENABLED === "true",
        },
        creditScoring: {
          status: "operational",
          modelVersion: "v1.0-rules",
        },
        repayments: {
          status: "operational",
          webhooks: {
            stripe: "/api/v1/repayments/webhook/stripe",
            mercadopago: "/api/v1/repayments/webhook/mercadopago",
          },
        },
      },
    });
  });

  logger.info("✅ FinTech routes mounted", {
    routes: [
      "GET/POST /api/v1/webhook/whatsapp",
      "GET /api/v1/collections/*",
      "GET /api/v1/credit/*",
      "GET/POST /api/v1/repayments/*",
      "GET /api/v1/fintech/health",
    ],
  });

  return router;
}
