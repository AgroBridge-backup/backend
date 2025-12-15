import { Router } from 'express';
import { createAuthRouter } from './auth.routes.js';
import { createBatchesRouter } from './batches.routes.js';
import { createEventsRouter } from './events.routes.js';
import { createProducersRouter } from './producers.routes.js';
import { createNotificationsRouter } from './notifications.routes.js';
import { createUploadRouter } from './upload.routes.js';
import { createPaymentRouter } from './payment.routes.js';
import { createReportRouter } from './report.routes.js';
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
    return router;
}
