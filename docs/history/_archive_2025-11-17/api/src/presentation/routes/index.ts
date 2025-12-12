import { Router } from 'express';
import { createAuthRouter } from './auth.routes';
import { createBatchesRouter } from './batches.routes';
import { createEventsRouter } from './events.routes';
import { createProducersRouter } from './producers.routes';
import { AllUseCases } from '@/application/use-cases';

export function createApiRouter(useCases: AllUseCases): Router {
  const router = Router();

  router.use('/auth', createAuthRouter(useCases.auth));
  router.use('/batches', createBatchesRouter(useCases.batches));
  router.use('/events', createEventsRouter(useCases.events));
  router.use('/producers', createProducersRouter(useCases.producers));

  return router;
}
