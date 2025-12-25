import rateLimit from 'express-rate-limit';
import logger from '../../../shared/utils/logger.js';
export class RateLimiterConfig {
    static auth() {
        return rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 5,
            message: {
                success: false,
                error: {
                    code: 'RATE_LIMIT_AUTH_EXCEEDED',
                    message: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.',
                },
            },
            standardHeaders: true,
            legacyHeaders: false,
            skipSuccessfulRequests: false,
            keyGenerator: (req) => {
                const email = req.body?.email || '';
                return `auth:${req.ip}-${email}`;
            },
            handler: (req, res) => {
                logger.warn(`[RateLimiter] Auth rate limit exceeded - IP: ${req.ip}, email: ${req.body?.email}, path: ${req.path}`);
                res.status(429).json({
                    success: false,
                    error: {
                        code: 'RATE_LIMIT_AUTH_EXCEEDED',
                        message: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.',
                    },
                });
            },
        });
    }
    static api() {
        return rateLimit({
            windowMs: 60 * 1000,
            max: 100,
            message: {
                success: false,
                error: {
                    code: 'RATE_LIMIT_API_EXCEEDED',
                    message: 'Límite de solicitudes excedido. Intenta de nuevo más tarde.',
                },
            },
            standardHeaders: true,
            legacyHeaders: false,
            skip: (req) => {
                return req.path === '/health' ||
                    req.path === '/health/ready' ||
                    req.path === '/api/v1/status';
            },
            keyGenerator: (req) => {
                const userId = req.user?.userId;
                return userId ? `api:user:${userId}` : `api:ip:${req.ip}`;
            },
        });
    }
    static creation() {
        return rateLimit({
            windowMs: 60 * 60 * 1000,
            max: 50,
            message: {
                success: false,
                error: {
                    code: 'RATE_LIMIT_CREATION_EXCEEDED',
                    message: 'Has excedido el límite de creación de recursos por hora.',
                },
            },
            standardHeaders: true,
            legacyHeaders: false,
            keyGenerator: (req) => {
                const userId = req.user?.userId;
                return userId ? `creation:user:${userId}` : `creation:ip:${req.ip}`;
            },
            handler: (req, res) => {
                logger.warn(`[RateLimiter] Creation rate limit exceeded - IP: ${req.ip}, userId: ${req.user?.userId}, path: ${req.path}`);
                res.status(429).json({
                    success: false,
                    error: {
                        code: 'RATE_LIMIT_CREATION_EXCEEDED',
                        message: 'Has excedido el límite de creación de recursos por hora.',
                    },
                });
            },
        });
    }
    static passwordReset() {
        return rateLimit({
            windowMs: 60 * 60 * 1000,
            max: 3,
            message: {
                success: false,
                error: {
                    code: 'RATE_LIMIT_PASSWORD_RESET_EXCEEDED',
                    message: 'Demasiadas solicitudes de restablecimiento. Intenta en 1 hora.',
                },
            },
            standardHeaders: true,
            legacyHeaders: false,
            keyGenerator: (req) => {
                const email = req.body?.email || req.ip;
                return `password-reset:${email}`;
            },
        });
    }
    static registration() {
        return rateLimit({
            windowMs: 60 * 60 * 1000,
            max: 10,
            message: {
                success: false,
                error: {
                    code: 'RATE_LIMIT_REGISTRATION_EXCEEDED',
                    message: 'Demasiados registros desde esta IP. Intenta más tarde.',
                },
            },
            standardHeaders: true,
            legacyHeaders: false,
            keyGenerator: (req) => {
                return `registration:ip:${req.ip}`;
            },
            handler: (req, res) => {
                logger.warn(`[RateLimiter] Registration rate limit exceeded - IP: ${req.ip}, path: ${req.path}`);
                res.status(429).json({
                    success: false,
                    error: {
                        code: 'RATE_LIMIT_REGISTRATION_EXCEEDED',
                        message: 'Demasiados registros desde esta IP. Intenta más tarde.',
                    },
                });
            },
        });
    }
    static tokenRefresh() {
        return rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 10,
            message: {
                success: false,
                error: {
                    code: 'RATE_LIMIT_REFRESH_EXCEEDED',
                    message: 'Demasiadas solicitudes de renovación de token.',
                },
            },
            standardHeaders: true,
            legacyHeaders: false,
            keyGenerator: (req) => {
                return `token-refresh:ip:${req.ip}`;
            },
        });
    }
    static sensitive() {
        return rateLimit({
            windowMs: 60 * 60 * 1000,
            max: 20,
            message: {
                success: false,
                error: {
                    code: 'RATE_LIMIT_SENSITIVE_EXCEEDED',
                    message: 'Has excedido el límite de operaciones sensibles.',
                },
            },
            standardHeaders: true,
            legacyHeaders: false,
            keyGenerator: (req) => {
                const userId = req.user?.userId;
                return userId ? `sensitive:user:${userId}` : `sensitive:ip:${req.ip}`;
            },
        });
    }
    static twoFactor() {
        return rateLimit({
            windowMs: 5 * 60 * 1000,
            max: 5,
            message: {
                success: false,
                error: {
                    code: 'RATE_LIMIT_2FA_EXCEEDED',
                    message: 'Demasiados intentos de verificación 2FA. Intenta de nuevo en 5 minutos.',
                },
            },
            standardHeaders: true,
            legacyHeaders: false,
            skipSuccessfulRequests: true,
            keyGenerator: (req) => {
                const tempToken = req.body?.tempToken;
                const userId = req.user?.userId;
                if (tempToken) {
                    return `2fa:temp:${tempToken}`;
                }
                return userId ? `2fa:user:${userId}` : `2fa:ip:${req.ip}`;
            },
            handler: (req, res) => {
                logger.warn(`[RateLimiter] 2FA rate limit exceeded - IP: ${req.ip}, path: ${req.path}`);
                res.status(429).json({
                    success: false,
                    error: {
                        code: 'RATE_LIMIT_2FA_EXCEEDED',
                        message: 'Demasiados intentos de verificación 2FA. Intenta de nuevo en 5 minutos.',
                    },
                });
            },
        });
    }
    static oauth() {
        return rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 10,
            message: {
                success: false,
                error: {
                    code: 'RATE_LIMIT_OAUTH_EXCEEDED',
                    message: 'Demasiadas solicitudes de autenticación OAuth. Intenta más tarde.',
                },
            },
            standardHeaders: true,
            legacyHeaders: false,
            keyGenerator: (req) => {
                const userId = req.user?.userId;
                return userId ? `oauth:user:${userId}` : `oauth:ip:${req.ip}`;
            },
        });
    }
    static publicApi() {
        return rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 50,
            message: {
                success: false,
                error: {
                    code: 'RATE_LIMIT_PUBLIC_API_EXCEEDED',
                    message: 'Demasiadas solicitudes. Intenta de nuevo en 15 minutos.',
                },
            },
            standardHeaders: true,
            legacyHeaders: false,
            keyGenerator: (req) => {
                return `public:ip:${req.ip}`;
            },
            handler: (req, res) => {
                logger.warn(`[RateLimiter] Public API rate limit exceeded - IP: ${req.ip}, path: ${req.path}`);
                res.status(429).json({
                    success: false,
                    error: {
                        code: 'RATE_LIMIT_PUBLIC_API_EXCEEDED',
                        message: 'Demasiadas solicitudes. Intenta de nuevo en 15 minutos.',
                    },
                });
            },
        });
    }
}
