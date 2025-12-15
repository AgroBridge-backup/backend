import { Router } from 'express';
import { validateRequest } from '../middlewares/validator.middleware.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { RateLimiterConfig } from '../../infrastructure/http/middleware/rate-limiter.middleware.js';
import { Password } from '../../domain/value-objects/Password.js';
import { oAuthService } from '../../infrastructure/auth/oauth/OAuthService.js';
import { loginSchema, refreshTokenSchema, passwordStrengthSchema, verify2FASchema, enable2FASchema, disable2FASchema, regenerateBackupCodesSchema, oauthCallbackSchema, } from '../validators/auth.validator.js';
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
            if (req.user?.jti && req.user?.exp) {
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
    router.post('/2fa/verify', RateLimiterConfig.twoFactor(), validateRequest(verify2FASchema), async (req, res, next) => {
        try {
            const result = await useCases.verify2FAUseCase.execute(req.body);
            res.json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.post('/2fa/setup', authenticate(), async (req, res, next) => {
        try {
            if (!req.user?.userId) {
                return res.status(401).json({
                    success: false,
                    error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
                });
            }
            const result = await useCases.setup2FAUseCase.execute({ userId: req.user.userId });
            res.json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.post('/2fa/enable', authenticate(), validateRequest(enable2FASchema), async (req, res, next) => {
        try {
            if (!req.user?.userId) {
                return res.status(401).json({
                    success: false,
                    error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
                });
            }
            const result = await useCases.enable2FAUseCase.execute({
                userId: req.user.userId,
                token: req.body.token,
            });
            res.json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.post('/2fa/disable', authenticate(), validateRequest(disable2FASchema), async (req, res, next) => {
        try {
            if (!req.user?.userId) {
                return res.status(401).json({
                    success: false,
                    error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
                });
            }
            const result = await useCases.disable2FAUseCase.execute({
                userId: req.user.userId,
                token: req.body.token,
            });
            res.json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/2fa/status', authenticate(), async (req, res, next) => {
        try {
            if (!req.user?.userId) {
                return res.status(401).json({
                    success: false,
                    error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
                });
            }
            const result = await useCases.get2FAStatusUseCase.execute({ userId: req.user.userId });
            res.json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.post('/2fa/backup-codes', authenticate(), validateRequest(regenerateBackupCodesSchema), async (req, res, next) => {
        try {
            if (!req.user?.userId) {
                return res.status(401).json({
                    success: false,
                    error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
                });
            }
            const result = await useCases.regenerateBackupCodesUseCase.execute({
                userId: req.user.userId,
                token: req.body.token,
            });
            res.json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/oauth/google', RateLimiterConfig.oauth(), async (req, res, next) => {
        try {
            const authUrl = await oAuthService.getLoginUrl('google');
            res.redirect(authUrl);
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/oauth/google/callback', validateRequest(oauthCallbackSchema), async (req, res, next) => {
        try {
            const { code, state } = req.query;
            const result = await oAuthService.handleCallback(code, state);
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            if (!result.success) {
                res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent(result.error || 'Authentication failed')}`);
                return;
            }
            if ('accessToken' in result && result.accessToken && result.refreshToken) {
                const exchangeCode = await oAuthService.storeTokensForExchange(result.accessToken, result.refreshToken, {
                    isNewUser: result.isNewUser,
                    requires2FA: result.requires2FA,
                    tempToken: result.tempToken,
                });
                if (result.requires2FA) {
                    res.redirect(`${frontendUrl}/auth/callback?code=${exchangeCode}&requires2FA=true`);
                }
                else {
                    res.redirect(`${frontendUrl}/auth/callback?code=${exchangeCode}${result.isNewUser ? '&newUser=true' : ''}`);
                }
            }
            else {
                res.redirect(`${frontendUrl}/auth/callback?linked=true&provider=google`);
            }
        }
        catch (error) {
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
            res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent(errorMessage)}`);
        }
    });
    router.get('/oauth/github', RateLimiterConfig.oauth(), async (req, res, next) => {
        try {
            const authUrl = await oAuthService.getLoginUrl('github');
            res.redirect(authUrl);
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/oauth/github/callback', validateRequest(oauthCallbackSchema), async (req, res, next) => {
        try {
            const { code, state } = req.query;
            const result = await oAuthService.handleCallback(code, state);
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            if (!result.success) {
                res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent(result.error || 'Authentication failed')}`);
                return;
            }
            if ('accessToken' in result && result.accessToken && result.refreshToken) {
                const exchangeCode = await oAuthService.storeTokensForExchange(result.accessToken, result.refreshToken, {
                    isNewUser: result.isNewUser,
                    requires2FA: result.requires2FA,
                    tempToken: result.tempToken,
                });
                if (result.requires2FA) {
                    res.redirect(`${frontendUrl}/auth/callback?code=${exchangeCode}&requires2FA=true`);
                }
                else {
                    res.redirect(`${frontendUrl}/auth/callback?code=${exchangeCode}${result.isNewUser ? '&newUser=true' : ''}`);
                }
            }
            else {
                res.redirect(`${frontendUrl}/auth/callback?linked=true&provider=github`);
            }
        }
        catch (error) {
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
            res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent(errorMessage)}`);
        }
    });
    router.post('/oauth/link/google', authenticate(), async (req, res, next) => {
        try {
            if (!req.user?.userId) {
                return res.status(401).json({
                    success: false,
                    error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
                });
            }
            const authUrl = await oAuthService.getLinkUrl('google', req.user.userId);
            res.json({
                success: true,
                data: { authUrl },
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.post('/oauth/link/github', authenticate(), async (req, res, next) => {
        try {
            if (!req.user?.userId) {
                return res.status(401).json({
                    success: false,
                    error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
                });
            }
            const authUrl = await oAuthService.getLinkUrl('github', req.user.userId);
            res.json({
                success: true,
                data: { authUrl },
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.delete('/oauth/unlink/:provider', authenticate(), async (req, res, next) => {
        try {
            if (!req.user?.userId) {
                return res.status(401).json({
                    success: false,
                    error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
                });
            }
            const provider = req.params.provider;
            if (!['google', 'github'].includes(provider)) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'INVALID_PROVIDER', message: 'Invalid OAuth provider' },
                });
            }
            const result = await oAuthService.unlinkAccount(req.user.userId, provider);
            res.json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/oauth/providers', authenticate(), async (req, res, next) => {
        try {
            if (!req.user?.userId) {
                return res.status(401).json({
                    success: false,
                    error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
                });
            }
            const providers = await oAuthService.getLinkedProviders(req.user.userId);
            res.json({
                success: true,
                data: { providers },
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.post('/oauth/exchange', RateLimiterConfig.auth(), async (req, res, next) => {
        try {
            const { code } = req.body;
            if (!code || typeof code !== 'string') {
                return res.status(400).json({
                    success: false,
                    error: { code: 'INVALID_REQUEST', message: 'Authorization code is required' },
                });
            }
            const result = await oAuthService.exchangeCodeForTokens(code);
            if (!result) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'INVALID_CODE',
                        message: 'Invalid or expired authorization code. Please try logging in again.',
                    },
                });
            }
            res.json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    });
    return router;
}
