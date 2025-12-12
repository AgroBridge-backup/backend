import { Router } from 'express';
import { z } from 'zod';
import { validateRequest } from '@/presentation/middlewares/validator.middleware';
import { authenticate } from '@/presentation/middlewares/auth.middleware';
// This file now exports a function that creates the router
export function createAuthRouter(useCases) {
    const authRoutes = Router();
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
        }
        catch (error) {
            next(error);
        }
    });
    authRoutes.post('/refresh', validateRequest(refreshTokenSchema), async (req, res, next) => {
        try {
            const result = await useCases.refreshTokenUseCase.execute(req.body);
            res.json(result);
        }
        catch (error) {
            next(error);
        }
    });
    authRoutes.post('/logout', authenticate(), async (req, res, next) => {
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
    authRoutes.get('/me', authenticate(), async (req, res, next) => {
        try {
            const result = await useCases.getCurrentUserUseCase.execute({ userId: req.user?.userId });
            res.json(result);
        }
        catch (error) {
            next(error);
        }
    });
    return authRoutes;
}
//# sourceMappingURL=auth.routes.js.map