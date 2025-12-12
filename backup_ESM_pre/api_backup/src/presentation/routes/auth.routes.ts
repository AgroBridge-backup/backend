import { Router } from 'express';
import { z } from 'zod';
import { validateRequest } from '../middlewares/validator.middleware.js';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { AuthUseCases } from '../../application/use-cases/auth/index.js';

// FIX: refactor to a creator function to align with DI pattern
export function createAuthRouter(useCases: AuthUseCases) {
  const router = Router();

  // Schema Definitions
  const loginSchema = z.object({
    body: z.object({
      email: z.string().email('Invalid email format'),
      password: z.string().min(1, 'Password cannot be empty'),
    }),
  });

  const refreshTokenSchema = z.object({
    body: z.object({
      refreshToken: z.string().min(1, 'Refresh token cannot be empty'),
    }),
  });

  // Route Definitions using injected use cases
  router.post('/login', validateRequest(loginSchema), async (req, res, next) => {
    try {
      const result = await useCases.loginUseCase.execute(req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/refresh', validateRequest(refreshTokenSchema), async (req, res, next) => {
    try {
      const result = await useCases.refreshTokenUseCase.execute(req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/logout', authenticate(), async (req: AuthenticatedRequest, res, next) => {
    try {
      if (req.user) {
        await useCases.logoutUseCase.execute({ jti: req.user.jti, exp: req.user.exp });
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.get('/me', authenticate(), async (req: AuthenticatedRequest, res, next) => {
    try {
      const result = await useCases.getCurrentUserUseCase.execute({ userId: req.user?.userId });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}


