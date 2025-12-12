import { Router } from 'express';
import { createAuthRouter } from './auth.routes';
import { createBatchesRouter } from './batches.routes';
import { createEventsRouter } from './events.routes';
import { createProducersRouter } from './producers.routes';
export function createApiRouter(useCases) {
    const router = Router();
    router.use('/auth', createAuthRouter(useCases.auth));
    router.use('/batches', createBatchesRouter(useCases.batches));
    router.use('/events', createEventsRouter(useCases.events));
    router.use('/producers', createProducersRouter(useCases.producers));
    return router;
}
//# sourceMappingURL=index.js.map