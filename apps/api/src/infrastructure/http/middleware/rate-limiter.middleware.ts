import rateLimit, { RateLimitRequestHandler, Options } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { Request, Response } from 'express';
import logger from '../../../shared/utils/logger.js';
import { redisClient } from '../../cache/RedisClient.js';

/**
 * Create Redis store for rate limiting
 * Falls back gracefully if Redis is unavailable
 */
function createRedisStore(prefix: string): RedisStore | undefined {
  if (!redisClient.isAvailable()) {
    logger.warn(`[RateLimiter] Redis unavailable, using in-memory store for ${prefix}`);
    return undefined;
  }

  try {
    return new RedisStore({
      sendCommand: async (...args: string[]) => {
        // Use apply to properly spread arguments to Redis call
        return redisClient.client.call(args[0], ...args.slice(1)) as Promise<any>;
      },
      prefix: `rl:${prefix}:`,
    });
  } catch (error) {
    logger.error(`[RateLimiter] Failed to create Redis store: ${error}`);
    return undefined;
  }
}

/**
 * Rate limiter configuration factory
 * Provides different rate limits for different endpoint types
 */
export class RateLimiterConfig {
  /**
   * Rate limiter for login/auth endpoints
   * Very strict to prevent brute force attacks
   */
  static auth(): RateLimitRequestHandler {
    const store = createRedisStore('auth');
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 attempts per window
      ...(store && { store }),
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
      skipFailedRequests: true, // Don't count failed requests (graceful degradation)
      keyGenerator: (req: Request): string => {
        // Rate limit by IP + email combination for login attempts
        const email = req.body?.email || '';
        return `${req.ip}-${email}`;
      },
      handler: (req: Request, res: Response) => {
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

  /**
   * Rate limiter for general API endpoints
   * Balanced for normal API usage
   */
  static api(): RateLimitRequestHandler {
    const store = createRedisStore('api');
    return rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 100, // 100 requests per minute
      ...(store && { store }),
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_API_EXCEEDED',
          message: 'Límite de solicitudes excedido. Intenta de nuevo más tarde.',
        },
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipFailedRequests: true,
      skip: (req: Request): boolean => {
        // Skip health checks and status endpoints
        return req.path === '/health' ||
               req.path === '/health/ready' ||
               req.path === '/api/v1/status';
      },
      keyGenerator: (req: Request): string => {
        // Use user ID if authenticated, otherwise IP
        const userId = (req as any).user?.userId;
        return userId ? `user:${userId}` : `ip:${req.ip}`;
      },
    });
  }

  /**
   * Rate limiter for resource creation endpoints
   * Prevents spam creation of batches, producers, events
   */
  static creation(): RateLimitRequestHandler {
    return rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 50, // 50 creations per hour
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_CREATION_EXCEEDED',
          message: 'Has excedido el límite de creación de recursos por hora.',
        },
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req: Request): string => {
        const userId = (req as any).user?.userId;
        return userId ? `creation:user:${userId}` : `creation:ip:${req.ip}`;
      },
      handler: (req: Request, res: Response) => {
        logger.warn(`[RateLimiter] Creation rate limit exceeded - IP: ${req.ip}, userId: ${(req as any).user?.userId}, path: ${req.path}`);

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

  /**
   * Rate limiter for password reset requests
   * Very strict to prevent abuse
   */
  static passwordReset(): RateLimitRequestHandler {
    return rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 3, // Only 3 attempts per hour
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_PASSWORD_RESET_EXCEEDED',
          message: 'Demasiadas solicitudes de restablecimiento. Intenta en 1 hora.',
        },
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req: Request): string => {
        const email = req.body?.email || req.ip;
        return `password-reset:${email}`;
      },
    });
  }

  /**
   * Rate limiter for user registration
   * Prevents mass account creation
   */
  static registration(): RateLimitRequestHandler {
    return rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 10, // 10 registrations per hour per IP
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_REGISTRATION_EXCEEDED',
          message: 'Demasiados registros desde esta IP. Intenta más tarde.',
        },
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req: Request): string => {
        return `registration:ip:${req.ip}`;
      },
      handler: (req: Request, res: Response) => {
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

  /**
   * Rate limiter for token refresh endpoint
   * Moderate limit to prevent token farming
   */
  static tokenRefresh(): RateLimitRequestHandler {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10, // 10 refresh attempts per 15 minutes
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_REFRESH_EXCEEDED',
          message: 'Demasiadas solicitudes de renovación de token.',
        },
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req: Request): string => {
        return `token-refresh:ip:${req.ip}`;
      },
    });
  }

  /**
   * Rate limiter for sensitive operations (admin actions, verifications)
   */
  static sensitive(): RateLimitRequestHandler {
    return rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 20, // 20 sensitive operations per hour
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_SENSITIVE_EXCEEDED',
          message: 'Has excedido el límite de operaciones sensibles.',
        },
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req: Request): string => {
        const userId = (req as any).user?.userId;
        return userId ? `sensitive:user:${userId}` : `sensitive:ip:${req.ip}`;
      },
    });
  }

  /**
   * Rate limiter for 2FA verification attempts
   * Very strict to prevent brute force attacks on TOTP codes
   */
  static twoFactor(): RateLimitRequestHandler {
    return rateLimit({
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 5, // 5 attempts per 5 minutes
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_2FA_EXCEEDED',
          message: 'Demasiados intentos de verificación 2FA. Intenta de nuevo en 5 minutos.',
        },
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: true, // Don't count successful verifications
      keyGenerator: (req: Request): string => {
        // Rate limit by tempToken for login 2FA, or by IP for setup
        const tempToken = req.body?.tempToken;
        const userId = (req as any).user?.userId;
        if (tempToken) {
          return `2fa:temp:${tempToken}`;
        }
        return userId ? `2fa:user:${userId}` : `2fa:ip:${req.ip}`;
      },
      handler: (req: Request, res: Response) => {
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

  /**
   * Rate limiter for OAuth operations
   * Prevents rapid OAuth request spam
   */
  static oauth(): RateLimitRequestHandler {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10, // 10 OAuth operations per 15 minutes
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_OAUTH_EXCEEDED',
          message: 'Demasiadas solicitudes de autenticación OAuth. Intenta más tarde.',
        },
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req: Request): string => {
        const userId = (req as any).user?.userId;
        return userId ? `oauth:user:${userId}` : `oauth:ip:${req.ip}`;
      },
    });
  }

  /**
   * Rate limiter for public API endpoints (no auth required)
   * P1-2 FIX: Prevents DDoS, scraping, and API abuse on /verify/* routes
   */
  static publicApi(): RateLimitRequestHandler {
    const store = createRedisStore('public');
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 requests per 15 minutes per IP (for public traceability)
      ...(store && { store }),
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_PUBLIC_API_EXCEEDED',
          message: 'Demasiadas solicitudes. Intenta de nuevo en 15 minutos.',
        },
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipFailedRequests: true,
      keyGenerator: (req: Request): string => {
        return `ip:${req.ip}`;
      },
      handler: (req: Request, res: Response) => {
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

  /**
   * Authenticated user rate limiter (60 req/min per user)
   * For protected endpoints after authentication
   */
  static authenticated(): RateLimitRequestHandler {
    const store = createRedisStore('authenticated');
    return rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 60, // 60 requests per minute per user
      ...(store && { store }),
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded',
        },
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipFailedRequests: true,
      keyGenerator: (req: Request): string => {
        const userId = (req as any).user?.userId;
        return userId ? `user:${userId}` : `ip:${req.ip}`;
      },
    });
  }
}
