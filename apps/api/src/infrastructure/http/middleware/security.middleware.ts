import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';
import logger from '../../../shared/utils/logger.js';

/**
 * Force HTTPS in production
 * Redirects HTTP requests to HTTPS with 301 status code
 */
export const forceHTTPS = (req: Request, res: Response, next: NextFunction): void => {
  // Only enforce in production
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  // Check if behind proxy (load balancer, CloudFront, etc.)
  const proto = req.headers['x-forwarded-proto'] as string;

  if (proto && proto !== 'https') {
    const secureUrl = `https://${req.hostname}${req.url}`;
    logger.debug(`[Security] Redirecting HTTP to HTTPS: ${secureUrl}`);
    return res.redirect(301, secureUrl);
  }

  next();
};

/**
 * Security middleware using Helmet.js
 * Implements OWASP security headers for enterprise-grade protection
 */
export const securityHeadersMiddleware = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Para Swagger UI
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },

  // Strict Transport Security (HSTS)
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },

  // X-Frame-Options
  frameguard: {
    action: 'deny',
  },

  // X-Content-Type-Options
  noSniff: true,

  // X-XSS-Protection (deprecated but still useful for older browsers)
  xssFilter: true,

  // Referrer-Policy
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },

  // Hide X-Powered-By
  hidePoweredBy: true,
});

/**
 * Additional security headers not covered by Helmet
 */
export const additionalSecurityHeaders = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Permissions Policy (formerly Feature-Policy)
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
  );

  // X-DNS-Prefetch-Control
  res.setHeader('X-DNS-Prefetch-Control', 'off');

  // Cache-Control for API responses (prevent caching of sensitive data)
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }

  next();
};

/**
 * Combined security middleware for easy integration
 * Includes HTTPS enforcement, Helmet headers, and additional security headers
 */
export const securityMiddleware = [
  forceHTTPS,
  securityHeadersMiddleware,
  additionalSecurityHeaders,
];
