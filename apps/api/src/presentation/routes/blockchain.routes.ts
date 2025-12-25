/**
 * Blockchain Routes
 *
 * POST-MVP: Direct blockchain integration planned for Series A roadmap.
 * See docs/POST_MVP_FEATURES.md for full implementation details.
 *
 * Current organic certificate blockchain anchoring is handled via
 * the organic-certificates routes with hash storage.
 */
import { Router, Request, Response } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import * as Prisma from '@prisma/client';

const blockchainRouter = Router();

// POST-MVP: Direct blockchain submission - see docs/POST_MVP_FEATURES.md
blockchainRouter.post('/submit', authenticate([Prisma.UserRole.ADMIN]), (req: Request, res: Response) => {
  res.status(501).json({
    message: 'Blockchain direct submission planned for Series A. See roadmap.',
    roadmap: '/docs/POST_MVP_FEATURES.md',
  });
});

// POST-MVP: Blockchain transaction verification - see docs/POST_MVP_FEATURES.md
blockchainRouter.get('/transaction/:txId', authenticate([Prisma.UserRole.ADMIN]), (req: Request, res: Response) => {
  res.status(501).json({
    message: 'Blockchain transaction verification planned for Series A. See roadmap.',
    roadmap: '/docs/POST_MVP_FEATURES.md',
  });
});

export { blockchainRouter };
