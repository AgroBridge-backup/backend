import rateLimit, { RateLimitRequestHandler, Options } from 'express-rate-limit';
import { Request, Response } from 'express';
import logger from '../../../shared/utils/logger.js';

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
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 attempts per window
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
      keyGenerator: (req: Request): string => {
        // Rate limit by IP + email combination for login attempts
        const email = req.body?.email || '';
        return `auth:${req.ip}-${email}`;
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
    return rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 100, // 100 requests per minute
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_API_EXCEEDED',
          message: 'Límite de solicitudes excedido. Intenta de nuevo más tarde.',
        },
      },
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req: Request): boolean => {
        // Skip health checks and status endpoints
        return req.path === '/health' ||
               req.path === '/health/ready' ||
               req.path === '/api/v1/status';
      },
      keyGenerator: (req: Request): string => {
        // Use user ID if authenticated, otherwise IP
        const userId = (req as any).user?.userId;
        return userId ? `api:user:${userId}` : `api:ip:${req.ip}`;
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
}
