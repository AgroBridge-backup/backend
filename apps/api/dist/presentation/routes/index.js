import { Router } from 'express';
import { createAuthRouter } from './auth.routes.js';
import { createBatchesRouter } from './batches.routes.js';
import { createEventsRouter } from './events.routes.js';
import { createProducersRouter } from './producers.routes.js';
import { createNotificationsRouter } from './notifications.routes.js';
import { createUploadRouter } from './upload.routes.js';
import { createPaymentRouter } from './payment.routes.js';
import { createReportRouter } from './report.routes.js';
import { createCashFlowBridgeRouter } from './cash-flow-bridge.routes.js';
import { createVerificationStagesRouter } from './verification-stages.routes.js';
import { createCertificatesRouter } from './certificates.routes.js';
import { createTransitRouter } from './transit.routes.js';
import { createTemperatureRoutes } from './temperature.routes.js';
import { createNfcSealsRouter } from './nfc-seals.routes.js';
import { createSatelliteImageryRouter } from './satellite-imagery.routes.js';
import whatsappRoutes from '../../modules/whatsapp-bot/whatsapp.routes.js';
import collectionsRoutes from '../../modules/collections/routes/index.js';
import creditScoringRoutes from '../../modules/credit-scoring/routes/index.js';
import repaymentsRoutes from '../../modules/repayments/routes/index.js';
import logger from '../../shared/utils/logger.js';
import createInvoicingRouter from './invoicing.routes.js';
import createReferralsRouter from './referrals.routes.js';
import { createApiKeysRouter } from './api-keys.routes.js';
import { createPublicRoutes, createPublicLinkRoutes } from './public.routes.js';
import { createExportCompaniesRouter } from './export-companies.routes.js';
export function createApiRouter(useCases, prisma) {
    const router = Router();
    router.use('/auth', createAuthRouter(useCases.auth));
    router.use('/batches', createBatchesRouter(useCases.batches));
    router.use('/batches', createVerificationStagesRouter(useCases.verificationStages));
    router.use('/', createCertificatesRouter(useCases.certificates));
    router.use('/', createTransitRouter(useCases.transit));
    router.use('/temperature', createTemperatureRoutes(prisma));
    router.use('/nfc-seals', createNfcSealsRouter(prisma));
    router.use('/satellite', createSatelliteImageryRouter(prisma));
    router.use('/events', createEventsRouter(useCases.events));
    router.use('/producers', createProducersRouter(useCases.producers));
    router.use('/notifications', createNotificationsRouter());
    router.use('/uploads', createUploadRouter());
    router.use('/payments', createPaymentRouter(prisma));
    router.use('/reports', createReportRouter(prisma));
    router.use('/', createCashFlowBridgeRouter(prisma));
    router.use('/invoices', createInvoicingRouter(prisma));
    router.use('/referrals', createReferralsRouter(prisma));
    router.use('/api-keys', createApiKeysRouter(prisma));
    logger.info('✅ API Key Management routes mounted', {
        routes: [
            'POST /api/v1/api-keys',
            'GET /api/v1/api-keys',
            'GET /api/v1/api-keys/:id',
            'PATCH /api/v1/api-keys/:id',
            'DELETE /api/v1/api-keys/:id',
        ],
    });
    router.use('/export-companies', createExportCompaniesRouter(prisma));
    logger.info('✅ Export Companies routes mounted', {
        routes: [
            'POST /api/v1/export-companies',
            'GET /api/v1/export-companies',
            'GET /api/v1/export-companies/:id',
            'PATCH /api/v1/export-companies/:id',
            'POST /api/v1/export-companies/:id/upgrade',
            'GET /api/v1/export-companies/:id/capacity',
            'GET /api/v1/export-companies/tiers/config',
        ],
    });
    router.use('/public', createPublicRoutes(prisma));
    router.use('/batches', createPublicLinkRoutes(prisma));
    logger.info('✅ Public Traceability routes mounted', {
        routes: [
            'GET /api/v1/public/farmers/:farmerId',
            'GET /api/v1/public/batches/:shortCode',
            'POST /api/v1/public/events/scan',
            'POST /api/v1/batches/:id/public-link',
            'GET /api/v1/batches/:id/public-stats',
        ],
    });
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
    router.use('/', whatsappRoutes);
    router.use('/collections', collectionsRoutes);
    router.use('/credit', creditScoringRoutes);
    router.use('/repayments', repaymentsRoutes);
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
