/**
 * Rate Limiter Middleware with Redis + In-Memory Fallback
 *
 * Production-grade rate limiting with automatic fallback to in-memory store
 * if Redis becomes unavailable. Prevents DDoS during Redis outages.
 *
 * @module rate-limiter.middleware
 */

import rateLimit, { RateLimitRequestHandler, Options } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { Request, Response } from 'express';
import logger from '../../../shared/utils/logger.js';
import { redisClient } from '../../cache/RedisClient.js';

// Track active health monitors to prevent duplicates
const activeHealthMonitors = new Set<string>();

// Track store types for metrics/logging
const storeTypes = new Map<string, 'redis' | 'in-memory'>();

/**
 * Create Redis store for rate limiting
 * Falls back gracefully if Redis is unavailable
 */
function createRedisStore(prefix: string): RedisStore | undefined {
  if (!redisClient.isAvailable()) {
    logger.warn(`[RateLimiter] Redis unavailable, using in-memory store for ${prefix}`);
    storeTypes.set(prefix, 'in-memory');
    return undefined;
  }

  try {
    const store = new RedisStore({
      // Type assertion needed: ioredis call() returns unknown, but rate-limit-redis expects specific types
      sendCommand: (async (...args: string[]) => {
        const result = await redisClient.client.call(args[0], ...args.slice(1));
        return result as string | number | (string | number)[];
      }),
      prefix: `rl:${prefix}:`,
    });
    storeTypes.set(prefix, 'redis');
    return store;
  } catch (error) {
    logger.error(`[RateLimiter] Failed to create Redis store: ${error}`);
    storeTypes.set(prefix, 'in-memory');
    return undefined;
  }
}

/**
 * Health check monitor for Redis connection
 * Logs warnings during degraded mode, debug messages when healthy
 */
function startHealthMonitor(storeName: string): void {
  // Prevent duplicate monitors for the same store
  if (activeHealthMonitors.has(storeName)) {
    return;
  }
  activeHealthMonitors.add(storeName);

  const checkInterval = 60000; // 1 minute

  const checkHealth = async (): Promise<void> => {
    try {
      if (!redisClient.isAvailable()) {
        logger.warn(`[RateLimiter] ${storeName} running in degraded mode (in-memory only)`);
        storeTypes.set(storeName, 'in-memory');
        return;
      }

      // Test Redis with PING
      await redisClient.client.ping();
      logger.debug(`[RateLimiter] ${storeName} Redis health check passed`);
      storeTypes.set(storeName, 'redis');
    } catch (error) {
      logger.error(`[RateLimiter] ${storeName} Redis health check failed`, { error });
      storeTypes.set(storeName, 'in-memory');
    }
  };

  // Run initial check
  checkHealth();

  // Schedule periodic checks
  setInterval(checkHealth, checkInterval);
}

/**
 * Custom key generator for authenticated requests
 * Falls back to IP if user ID unavailable
 */
function authenticatedKeyGenerator(req: Request): string {
  const userId = req.user?.userId || req.user?.id;
  return userId || req.ip || 'unknown';
}

/**
 * Get current store type for a prefix (for metrics/testing)
 */
export function getStoreType(prefix: string): 'redis' | 'in-memory' | undefined {
  return storeTypes.get(prefix);
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
    const prefix = 'auth';
    const store = createRedisStore(prefix);
    startHealthMonitor(prefix);

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
        logger.warn(`[RateLimiter] Auth rate limit exceeded`, {
          ip: req.ip,
          email: req.body?.email,
          path: req.path,
          store: storeTypes.get(prefix) || 'unknown',
        });

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
    const prefix = 'api';
    const store = createRedisStore(prefix);
    startHealthMonitor(prefix);

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
        const userId = req.user?.userId;
        return userId ? `user:${userId}` : `ip:${req.ip}`;
      },
    });
  }

  /**
   * Rate limiter for resource creation endpoints
   * Prevents spam creation of batches, producers, events
   */
  static creation(): RateLimitRequestHandler {
    const prefix = 'creation';
    const store = createRedisStore(prefix);
    startHealthMonitor(prefix);

    return rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 50, // 50 creations per hour
      ...(store && { store }),
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_CREATION_EXCEEDED',
          message: 'Has excedido el límite de creación de recursos por hora.',
        },
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipFailedRequests: true,
      keyGenerator: (req: Request): string => {
        const userId = req.user?.userId;
        return userId ? `creation:user:${userId}` : `creation:ip:${req.ip}`;
      },
      handler: (req: Request, res: Response) => {
        logger.warn(`[RateLimiter] Creation rate limit exceeded`, {
          ip: req.ip,
          userId: req.user?.userId,
          path: req.path,
          store: storeTypes.get(prefix) || 'unknown',
        });

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
    const prefix = 'password-reset';
    const store = createRedisStore(prefix);
    startHealthMonitor(prefix);

    return rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 3, // Only 3 attempts per hour
      ...(store && { store }),
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_PASSWORD_RESET_EXCEEDED',
          message: 'Demasiadas solicitudes de restablecimiento. Intenta en 1 hora.',
        },
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipFailedRequests: true,
      keyGenerator: (req: Request): string => {
        const email = req.body?.email || req.ip;
        return `password-reset:${email}`;
      },
      handler: (req: Request, res: Response) => {
        logger.warn(`[RateLimiter] Password reset rate limit exceeded`, {
          ip: req.ip,
          email: req.body?.email,
          store: storeTypes.get(prefix) || 'unknown',
        });

        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_PASSWORD_RESET_EXCEEDED',
            message: 'Demasiadas solicitudes de restablecimiento. Intenta en 1 hora.',
          },
        });
      },
    });
  }

  /**
   * Rate limiter for user registration
   * Prevents mass account creation
   */
  static registration(): RateLimitRequestHandler {
    const prefix = 'registration';
    const store = createRedisStore(prefix);
    startHealthMonitor(prefix);

    return rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 10, // 10 registrations per hour per IP
      ...(store && { store }),
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_REGISTRATION_EXCEEDED',
          message: 'Demasiados registros desde esta IP. Intenta más tarde.',
        },
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipFailedRequests: true,
      keyGenerator: (req: Request): string => {
        return `registration:ip:${req.ip}`;
      },
      handler: (req: Request, res: Response) => {
        logger.warn(`[RateLimiter] Registration rate limit exceeded`, {
          ip: req.ip,
          path: req.path,
          store: storeTypes.get(prefix) || 'unknown',
        });

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
    const prefix = 'token-refresh';
    const store = createRedisStore(prefix);
    startHealthMonitor(prefix);

    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10, // 10 refresh attempts per 15 minutes
      ...(store && { store }),
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_REFRESH_EXCEEDED',
          message: 'Demasiadas solicitudes de renovación de token.',
        },
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipFailedRequests: true,
      keyGenerator: (req: Request): string => {
        return `token-refresh:ip:${req.ip}`;
      },
    });
  }

  /**
   * Rate limiter for sensitive operations (admin actions, verifications)
   */
  static sensitive(): RateLimitRequestHandler {
    const prefix = 'sensitive';
    const store = createRedisStore(prefix);
    startHealthMonitor(prefix);

    return rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 20, // 20 sensitive operations per hour
      ...(store && { store }),
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_SENSITIVE_EXCEEDED',
          message: 'Has excedido el límite de operaciones sensibles.',
        },
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipFailedRequests: true,
      keyGenerator: (req: Request): string => {
        const userId = req.user?.userId;
        return userId ? `sensitive:user:${userId}` : `sensitive:ip:${req.ip}`;
      },
    });
  }

  /**
   * Rate limiter for 2FA verification attempts
   * Very strict to prevent brute force attacks on TOTP codes
   */
  static twoFactor(): RateLimitRequestHandler {
    const prefix = '2fa';
    const store = createRedisStore(prefix);
    startHealthMonitor(prefix);

    return rateLimit({
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 5, // 5 attempts per 5 minutes
      ...(store && { store }),
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
      skipFailedRequests: false, // Count failed attempts for security
      keyGenerator: (req: Request): string => {
        // Rate limit by tempToken for login 2FA, or by IP for setup
        const tempToken = req.body?.tempToken;
        const userId = req.user?.userId;
        if (tempToken) {
          return `2fa:temp:${tempToken}`;
        }
        return userId ? `2fa:user:${userId}` : `2fa:ip:${req.ip}`;
      },
      handler: (req: Request, res: Response) => {
        logger.warn(`[RateLimiter] 2FA rate limit exceeded`, {
          ip: req.ip,
          path: req.path,
          store: storeTypes.get(prefix) || 'unknown',
        });

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
    const prefix = 'oauth';
    const store = createRedisStore(prefix);
    startHealthMonitor(prefix);

    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10, // 10 OAuth operations per 15 minutes
      ...(store && { store }),
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_OAUTH_EXCEEDED',
          message: 'Demasiadas solicitudes de autenticación OAuth. Intenta más tarde.',
        },
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipFailedRequests: true,
      keyGenerator: (req: Request): string => {
        const userId = req.user?.userId;
        return userId ? `oauth:user:${userId}` : `oauth:ip:${req.ip}`;
      },
    });
  }

  /**
   * Rate limiter for public API endpoints (no auth required)
   * Prevents DDoS, scraping, and API abuse on /verify/* routes
   */
  static publicApi(): RateLimitRequestHandler {
    const prefix = 'public';
    const store = createRedisStore(prefix);
    startHealthMonitor(prefix);

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
        logger.warn(`[RateLimiter] Public API rate limit exceeded`, {
          ip: req.ip,
          path: req.path,
          store: storeTypes.get(prefix) || 'unknown',
        });

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
    const prefix = 'authenticated';
    const store = createRedisStore(prefix);
    startHealthMonitor(prefix);

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
      keyGenerator: authenticatedKeyGenerator,
    });
  }

  /**
   * Certificate generation rate limiter (strict)
   * For expensive operations like PDF/blockchain/IPFS
   * 5 certificate generations per farmer per hour
   */
  static certGen(): RateLimitRequestHandler {
    const prefix = 'certgen';
    const store = createRedisStore(prefix);
    startHealthMonitor(prefix);

    return rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 5, // 5 certificate generations per hour
      ...(store && { store }),
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_CERTGEN_EXCEEDED',
          message: 'Límite de generación de certificados alcanzado. Máximo 5 por hora.',
        },
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: false, // Count all attempts
      skipFailedRequests: false,
      keyGenerator: authenticatedKeyGenerator,
      handler: (req: Request, res: Response) => {
        logger.warn(`[RateLimiter] Certificate generation rate limit exceeded`, {
          ip: req.ip,
          userId: req.user?.userId,
          path: req.path,
          store: storeTypes.get(prefix) || 'unknown',
        });

        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_CERTGEN_EXCEEDED',
            message: 'Límite de generación de certificados alcanzado. Máximo 5 por hora.',
          },
        });
      },
    });
  }

  /**
   * Admin API rate limiter (30 req/min per admin)
   * For admin-only endpoints
   */
  static admin(): RateLimitRequestHandler {
    const prefix = 'admin';
    const store = createRedisStore(prefix);
    startHealthMonitor(prefix);

    return rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 30, // 30 requests per minute per admin
      ...(store && { store }),
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_ADMIN_EXCEEDED',
          message: 'Admin rate limit exceeded.',
        },
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipFailedRequests: true,
      keyGenerator: authenticatedKeyGenerator,
    });
  }
}

/**
 * Convenience exports for common rate limiters
 */
export const publicApiLimiter = RateLimiterConfig.publicApi();
export const authenticatedApiLimiter = RateLimiterConfig.authenticated();
export const adminApiLimiter = RateLimiterConfig.admin();
export const certGenLimiter = RateLimiterConfig.certGen();

/**
 * Export for testing
 */
export const __testing__ = {
  createRedisStore,
  authenticatedKeyGenerator,
  startHealthMonitor,
  getStoreType,
  storeTypes,
  activeHealthMonitors,
};
