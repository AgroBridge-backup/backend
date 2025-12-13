import { Router, Request, Response } from 'express';
import { validateRequest } from '../middlewares/validator.middleware.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { AuthUseCases } from '../../application/use-cases/auth/index.js';
import { RateLimiterConfig } from '../../infrastructure/http/middleware/rate-limiter.middleware.js';
import { Password } from '../../domain/value-objects/Password.js';
import {
  loginSchema,
  refreshTokenSchema,
  passwordStrengthSchema,
} from '../validators/auth.validator.js';

// FIX: refactor to a creator function to align with DI pattern
export function createAuthRouter(useCases: AuthUseCases) {
  const router = Router();

  /**
   * POST /api/v1/auth/login
   * Login with email and password
   * Rate limited: 5 attempts per 15 minutes
   */
  router.post(
    '/login',
    RateLimiterConfig.auth(),
    validateRequest(loginSchema),
    async (req: Request, res: Response, next) => {
      try {
        const result = await useCases.loginUseCase.execute(req.body);
        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/v1/auth/refresh
   * Refresh access token using refresh token
   * Rate limited: 10 attempts per 15 minutes
   */
  router.post(
    '/refresh',
    RateLimiterConfig.tokenRefresh(),
    validateRequest(refreshTokenSchema),
    async (req: Request, res: Response, next) => {
      try {
        const result = await useCases.refreshTokenUseCase.execute(req.body);
        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/v1/auth/logout
   * Logout and revoke current token
   */
  router.post('/logout', authenticate(), async (req: Request, res: Response, next) => {
    try {
      if (req.user) {
        await useCases.logoutUseCase.execute({ jti: req.user.jti, exp: req.user.exp });
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/v1/auth/me
   * Get current authenticated user info
   */
  router.get('/me', authenticate(), async (req: Request, res: Response, next) => {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      }
      const result = await useCases.getCurrentUserUseCase.execute({ userId: req.user.userId });
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/v1/auth/password-strength
   * Check password strength (for frontend real-time validation)
   * Public endpoint, moderately rate limited
   */
  router.post(
    '/password-strength',
    RateLimiterConfig.api(),
    validateRequest(passwordStrengthSchema),
    async (req: Request, res: Response) => {
      const { password } = req.body;
      const strength = Password.calculateStrength(password);
      const errors = Password.validate(password);

      res.json({
        success: true,
        data: {
          valid: strength.valid,
          score: strength.score,
          level: strength.level,
          errors: errors.length > 0 ? errors : undefined,
        },
      });
    }
  );

  return router;
}


