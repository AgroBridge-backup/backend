/**
 * Helmet Security Configuration
 * Comprehensive HTTP security headers for production deployment
 */

import helmet from 'helmet';
import { Express, Request, Response, NextFunction } from 'express';
import { logger } from '../logging/logger.js';

// Environment configuration
const isProd = process.env.NODE_ENV === 'production';
const apiDomain = process.env.API_DOMAIN || 'api.agrobridgeint.com';
const cdnDomain = process.env.CDN_DOMAIN || 'cdn.agrobridgeint.com';
const frontendDomain = process.env.FRONTEND_DOMAIN || 'agrobridgeint.com';

/**
 * Content Security Policy configuration
 */
const contentSecurityPolicy = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
      "'unsafe-inline'", // Required for Swagger UI
      "'unsafe-eval'",   // Required for Swagger UI
      'https://cdn.jsdelivr.net',
      'https://unpkg.com',
    ],
    styleSrc: [
      "'self'",
      "'unsafe-inline'",
      'https://cdn.jsdelivr.net',
      'https://fonts.googleapis.com',
    ],
    fontSrc: [
      "'self'",
      'https://fonts.gstatic.com',
      'https://cdn.jsdelivr.net',
    ],
    imgSrc: [
      "'self'",
      'data:',
      'blob:',
      `https://${cdnDomain}`,
      'https://validator.swagger.io',
    ],
    connectSrc: [
      "'self'",
      `https://${apiDomain}`,
      `wss://${apiDomain}`,
    ],
    mediaSrc: ["'self'"],
    objectSrc: ["'none'"],
    frameSrc: ["'none'"],
    frameAncestors: ["'none'"],
    formAction: ["'self'"],
    baseUri: ["'self'"],
    upgradeInsecureRequests: isProd ? [] : null,
    blockAllMixedContent: isProd ? [] : null,
  },
  reportOnly: !isProd,
};

/**
 * Strict Transport Security configuration
 */
const strictTransportSecurity = {
  maxAge: 31536000, // 1 year
  includeSubDomains: true,
  preload: true,
};

/**
 * Referrer Policy configuration
 */
const referrerPolicy = {
  policy: 'strict-origin-when-cross-origin' as const,
};

/**
 * Permissions Policy configuration
 */
const permissionsPolicy = {
  features: {
    accelerometer: ["'none'"],
    ambientLightSensor: ["'none'"],
    autoplay: ["'none'"],
    battery: ["'none'"],
    camera: ["'none'"],
    displayCapture: ["'none'"],
    documentDomain: ["'none'"],
    encryptedMedia: ["'none'"],
    executionWhileNotRendered: ["'none'"],
    executionWhileOutOfViewport: ["'none'"],
    fullscreen: ["'self'"],
    geolocation: ["'none'"],
    gyroscope: ["'none'"],
    layoutAnimations: ["'none'"],
    legacyImageFormats: ["'none'"],
    magnetometer: ["'none'"],
    microphone: ["'none'"],
    midi: ["'none'"],
    navigationOverride: ["'none'"],
    oversizedImages: ["'none'"],
    payment: ["'none'"],
    pictureInPicture: ["'none'"],
    publicKeyCredentialsGet: ["'none'"],
    syncXhr: ["'none'"],
    usb: ["'none'"],
    vr: ["'none'"],
    wakeLock: ["'none'"],
    screenWakeLock: ["'none'"],
    webShare: ["'none'"],
    xrSpatialTracking: ["'none'"],
  },
};

/**
 * Configure Helmet security middleware
 */
export function configureHelmet(app: Express): void {
  // Main Helmet configuration
  app.use(
    helmet({
      contentSecurityPolicy: isProd ? contentSecurityPolicy : false,
      crossOriginEmbedderPolicy: false, // Disabled for API compatibility
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow API access
      dnsPrefetchControl: { allow: false },
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      hsts: isProd ? strictTransportSecurity : false,
      ieNoOpen: true,
      noSniff: true,
      originAgentCluster: true,
      referrerPolicy,
      xssFilter: true,
    })
  );

  // Custom security headers
  app.use(customSecurityHeaders);

  // Permissions Policy (Feature-Policy successor)
  if (isProd) {
    app.use(permissionsPolicyMiddleware);
  }

  logger.info('Helmet security headers configured', {
    environment: process.env.NODE_ENV,
    cspEnabled: isProd,
    hstsEnabled: isProd,
  });
}

/**
 * Custom security headers middleware
 */
function customSecurityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // XSS protection for legacy browsers
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Prevent Flash/PDF embedding
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  // Download options for IE
  res.setHeader('X-Download-Options', 'noopen');

  // Cache control for sensitive endpoints
  if (req.path.includes('/auth/') || req.path.includes('/users/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }

  // Request ID for tracing
  const requestId = req.headers['x-request-id'] || generateRequestId();
  res.setHeader('X-Request-ID', requestId);

  // Server timing (only in development)
  if (!isProd) {
    res.setHeader('Server-Timing', 'miss');
  }

  next();
}

/**
 * Permissions Policy middleware
 */
function permissionsPolicyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const policies: string[] = [];

  for (const [feature, allowList] of Object.entries(permissionsPolicy.features)) {
    const kebabFeature = feature.replace(/([A-Z])/g, '-$1').toLowerCase();
    policies.push(`${kebabFeature}=(${allowList.join(' ')})`);
  }

  res.setHeader('Permissions-Policy', policies.join(', '));
  next();
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Security headers for specific routes
 */
export const routeSecurityHeaders = {
  // For API documentation routes (allow iframes for Swagger UI)
  documentation: (req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com; " +
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; " +
      "img-src 'self' data: https://validator.swagger.io; " +
      "connect-src 'self'"
    );
    next();
  },

  // For file download routes
  download: (req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'attachment');
    next();
  },

  // For public endpoints (relaxed CSP)
  public: (req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    next();
  },

  // For webhook endpoints
  webhook: (req: Request, res: Response, next: NextFunction): void => {
    // Allow webhooks from external services
    res.removeHeader('X-Frame-Options');
    next();
  },
};

/**
 * CORS preflight handler with security checks
 */
export function secureCorsPreflight(allowedOrigins: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;

    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Request-ID, X-API-Key'
      );
      res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
      res.setHeader('Vary', 'Origin');
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  };
}

export default configureHelmet;
