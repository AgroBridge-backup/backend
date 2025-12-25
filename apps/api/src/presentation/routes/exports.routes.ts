/**
 * Export Automation Routes
 *
 * POST-MVP: Automated export documentation generation planned for Q3 2026.
 * See docs/POST_MVP_FEATURES.md for full implementation details.
 *
 * Current export functionality is handled via organic-certificates
 * which include export-grade certifications.
 */
import { Router, Request, Response } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import * as Prisma from '@prisma/client';

const exportsRouter = Router();

// POST-MVP: Automated export documentation - see docs/POST_MVP_FEATURES.md
exportsRouter.post('/', authenticate([Prisma.UserRole.ADMIN, Prisma.UserRole.PRODUCER]), (req: Request, res: Response) => {
  res.status(501).json({
    message: 'Export automation planned for Q3 2026. See roadmap.',
    roadmap: '/docs/POST_MVP_FEATURES.md',
  });
});

// POST-MVP: Export details retrieval - see docs/POST_MVP_FEATURES.md
exportsRouter.get('/:exportId', authenticate([Prisma.UserRole.ADMIN, Prisma.UserRole.PRODUCER]), (req: Request, res: Response) => {
  res.status(501).json({
    message: 'Export details API planned for Q3 2026. See roadmap.',
    roadmap: '/docs/POST_MVP_FEATURES.md',
  });
});

export { exportsRouter };
