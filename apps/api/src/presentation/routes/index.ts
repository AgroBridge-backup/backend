import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuthRouter } from './auth.routes.js';
import { createBatchesRouter } from './batches.routes.js';
import { createEventsRouter } from './events.routes.js';
import { createProducersRouter } from './producers.routes.js';
import { createNotificationsRouter } from './notifications.routes.js';
import { createUploadRouter } from './upload.routes.js';
import { createPaymentRouter } from './payment.routes.js';
import { createReportRouter } from './report.routes.js';
import { createCashFlowBridgeRouter } from './cash-flow-bridge.routes.js';
import { AllUseCases } from '../../application/use-cases/index.js';

// FinTech Module Routes
import whatsappRoutes from '../../modules/whatsapp-bot/whatsapp.routes.js';
import collectionsRoutes from '../../modules/collections/routes/index.js';
import creditScoringRoutes from '../../modules/credit-scoring/routes/index.js';
import repaymentsRoutes from '../../modules/repayments/routes/index.js';
import logger from '../../shared/utils/logger.js';

// Invoicing & Referrals Module Routes
import createInvoicingRouter from './invoicing.routes.js';
import createReferralsRouter from './referrals.routes.js';

export function createApiRouter(useCases: AllUseCases, prisma: PrismaClient): Router {
  const router = Router();

  router.use('/auth', createAuthRouter(useCases.auth));
  router.use('/batches', createBatchesRouter(useCases.batches));
  router.use('/events', createEventsRouter(useCases.events));
  router.use('/producers', createProducersRouter(useCases.producers));
  router.use('/notifications', createNotificationsRouter());
  router.use('/uploads', createUploadRouter());
  router.use('/payments', createPaymentRouter(prisma));
  router.use('/reports', createReportRouter(prisma));

  // Cash Flow Bridge Routes (Credit Scoring, Advances, Liquidity Pools, Orders)
  router.use('/', createCashFlowBridgeRouter(prisma));

  // ═══════════════════════════════════════════════════════════════════════════════
  // INVOICING & REFERRALS MODULE ROUTES
  // Integrated: 2025-12-21
  // ═══════════════════════════════════════════════════════════════════════════════

  // Invoicing (Invoice management with blockchain verification)
  router.use('/invoices', createInvoicingRouter(prisma));

  // Referrals (Referral program with leaderboard)
  router.use('/referrals', createReferralsRouter(prisma));

  logger.info('✅ Invoicing & Referrals routes mounted', {
    routes: [
      'POST /api/v1/invoices',
      'GET /api/v1/invoices/:id',
      'GET /api/v1/invoices',
      'PATCH /api/v1/invoices/:id/paid',
      'POST /api/v1/referrals/register',
      'GET /api/v1/referrals/stats',
      'GET /api/v1/referrals/leaderboard',
    ],
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // FINTECH MODULE ROUTES
  // Integrated: 2025-12-19
  // ═══════════════════════════════════════════════════════════════════════════════

  // WhatsApp Bot (Meta Cloud API webhooks)
  router.use('/', whatsappRoutes);

  // Collections (Automated payment reminders)
  router.use('/collections', collectionsRoutes);

  // Credit Scoring (Alternative credit assessment)
  router.use('/credit', creditScoringRoutes);

  // Repayments (Payment processing and tracking)
  router.use('/repayments', repaymentsRoutes);

  // FinTech Health Check (consolidated status)
  router.get('/fintech/health', (req, res) => {
    res.json({
      status: 'operational',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      modules: {
        whatsapp: {
          status: process.env.META_WHATSAPP_TOKEN ? 'configured' : 'not_configured',
          webhookPath: '/api/v1/webhook/whatsapp',
        },
        collections: {
          status: 'operational',
          cronEnabled: process.env.COLLECTIONS_ENABLED === 'true',
        },
        creditScoring: {
          status: 'operational',
          modelVersion: 'v1.0-rules',
        },
        repayments: {
          status: 'operational',
          webhooks: {
            stripe: '/api/v1/repayments/webhook/stripe',
            mercadopago: '/api/v1/repayments/webhook/mercadopago',
          },
        },
      },
    });
  });

  logger.info('✅ FinTech routes mounted', {
    routes: [
      'GET/POST /api/v1/webhook/whatsapp',
      'GET /api/v1/collections/*',
      'GET /api/v1/credit/*',
      'GET/POST /api/v1/repayments/*',
      'GET /api/v1/fintech/health',
    ],
  });

  return router;
}
