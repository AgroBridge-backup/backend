import { Router } from 'express';
import { createAuthRouter } from './auth.routes.js';
import { createBatchesRouter } from './batches.routes.js';
import { createEventsRouter } from './events.routes.js';
import { createProducersRouter } from './producers.routes.js';
import { createNotificationsRouter } from './notifications.routes.js';
export function createApiRouter(useCases) {
    const router = Router();
    router.use('/auth', createAuthRouter(useCases.auth));
    router.use('/batches', createBatchesRouter(useCases.batches));
    router.use('/events', createEventsRouter(useCases.events));
    router.use('/producers', createProducersRouter(useCases.producers));
    router.use('/notifications', createNotificationsRouter());
    return router;
}
