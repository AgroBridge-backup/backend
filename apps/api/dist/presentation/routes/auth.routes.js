import { Router } from 'express';
import { z } from 'zod';
import { validateRequest } from '../middlewares/validator.middleware.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authLimiter } from '../middlewares/security.middleware.js';
// FIX: refactor to a creator function to align with DI pattern
export function createAuthRouter(useCases) {
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
    // Apply strict rate limiting to login endpoint (5 attempts per 15 min)
    router.post('/login', authLimiter, validateRequest(loginSchema), async (req, res, next) => {
        try {
            const result = await useCases.loginUseCase.execute(req.body);
            res.json(result);
        }
        catch (error) {
            next(error);
        }
    });
    // Apply rate limiting to token refresh (prevent token abuse)
    router.post('/refresh', authLimiter, validateRequest(refreshTokenSchema), async (req, res, next) => {
        try {
            const result = await useCases.refreshTokenUseCase.execute(req.body);
            res.json(result);
        }
        catch (error) {
            next(error);
        }
    });
    router.post('/logout', authenticate(), async (req, res, next) => {
        try {
            if (req.user) {
                await useCases.logoutUseCase.execute({ jti: req.user.jti, exp: req.user.exp });
            }
            res.status(204).send();
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/me', authenticate(), async (req, res, next) => {
        try {
            if (!req.user?.userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }
            const result = await useCases.getCurrentUserUseCase.execute({ userId: req.user.userId });
            res.json(result);
        }
        catch (error) {
            next(error);
        }
    });
    return router;
}
