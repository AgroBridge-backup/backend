import { Router } from 'express';
import { HealthController } from '../controllers/health.controller.js';
import { prisma } from '../../infrastructure/database/prisma/client.js';

const router = Router();
const healthController = new HealthController(prisma);

/**
 * Health Check Routes
 * No rate limiting, no auth - must be accessible for probes
 */

// Liveness probe - is the container alive?
router.get('/', healthController.liveness.bind(healthController));

// Readiness probe - is the container ready to serve traffic?
router.get('/ready', healthController.readiness.bind(healthController));

// Startup probe - has the container started successfully?
router.get('/startup', healthController.startup.bind(healthController));

// Metrics endpoint for monitoring
router.get('/metrics', healthController.metrics.bind(healthController));

export default router;
