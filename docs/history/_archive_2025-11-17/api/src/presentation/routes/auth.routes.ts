import { Router } from 'express';
import { z } from 'zod';
import { validateRequest } from '@/presentation/middlewares/validator.middleware';
import { authenticate } from '@/presentation/middlewares/auth.middleware';
import { LoginUseCase } from '@/application/use-cases/auth/LoginUseCase';
import { RefreshTokenUseCase } from '@/application/use-cases/auth/RefreshTokenUseCase';
import { LogoutUseCase } from '@/application/use-cases/auth/LogoutUseCase';
import { GetCurrentUserUseCase } from '@/application/use-cases/auth/GetCurrentUserUseCase';

// This file now exports a function that creates the router
export function createAuthRouter(useCases: {
  loginUseCase: LoginUseCase;
  refreshTokenUseCase: RefreshTokenUseCase;
  logoutUseCase: LogoutUseCase;
  getCurrentUserUseCase: GetCurrentUserUseCase;
}): Router {
  const authRoutes: Router = Router();

  const loginSchema = z.object({
    body: z.object({
      email: z.string().email(),
      password: z.string(),
    }),
  });
  const refreshTokenSchema = z.object({
    body: z.object({
      refreshToken: z.string(),
    }),
  });

  authRoutes.post('/login', validateRequest(loginSchema), async (req, res, next) => {
    try {
      const result = await useCases.loginUseCase.execute(req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  authRoutes.post('/refresh', validateRequest(refreshTokenSchema), async (req, res, next) => {
    try {
      const result = await useCases.refreshTokenUseCase.execute(req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  authRoutes.post('/logout', authenticate(), async (req: AuthenticatedRequest, res, next) => {
    try {
      if (req.user) {
        await useCases.logoutUseCase.execute({ jti: req.user.jti, exp: req.user.exp });
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  authRoutes.get('/me', authenticate(), async (req, res, next) => {
    try {
      const result = await useCases.getCurrentUserUseCase.execute({ userId: req.user?.userId });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return authRoutes;
}

