import { Router } from 'express';
import { validateRequest } from '../middlewares/validator.middleware.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { RateLimiterConfig } from '../../infrastructure/http/middleware/rate-limiter.middleware.js';
import { Password } from '../../domain/value-objects/Password.js';
import { loginSchema, refreshTokenSchema, passwordStrengthSchema, } from '../validators/auth.validator.js';
export function createAuthRouter(useCases) {
    const router = Router();
    router.post('/login', RateLimiterConfig.auth(), validateRequest(loginSchema), async (req, res, next) => {
        try {
            const result = await useCases.loginUseCase.execute(req.body);
            res.json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.post('/refresh', RateLimiterConfig.tokenRefresh(), validateRequest(refreshTokenSchema), async (req, res, next) => {
        try {
            const result = await useCases.refreshTokenUseCase.execute(req.body);
            res.json({
                success: true,
                data: result,
            });
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
        }
        catch (error) {
            next(error);
        }
    });
    router.post('/password-strength', RateLimiterConfig.api(), validateRequest(passwordStrengthSchema), async (req, res) => {
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
    });
    return router;
}
