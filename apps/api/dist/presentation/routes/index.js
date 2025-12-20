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
import whatsappRoutes from '../../modules/whatsapp-bot/whatsapp.routes.js';
import collectionsRoutes from '../../modules/collections/routes/index.js';
import creditScoringRoutes from '../../modules/credit-scoring/routes/index.js';
import repaymentsRoutes from '../../modules/repayments/routes/index.js';
import logger from '../../shared/utils/logger.js';
export function createApiRouter(useCases, prisma) {
    const router = Router();
    router.use('/auth', createAuthRouter(useCases.auth));
    router.use('/batches', createBatchesRouter(useCases.batches));
    router.use('/events', createEventsRouter(useCases.events));
    router.use('/producers', createProducersRouter(useCases.producers));
    router.use('/notifications', createNotificationsRouter());
    router.use('/uploads', createUploadRouter());
    router.use('/payments', createPaymentRouter(prisma));
    router.use('/reports', createReportRouter(prisma));
    router.use('/', createCashFlowBridgeRouter(prisma));
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
