import cors, { CorsOptions } from 'cors';
import { Request } from 'express';
import logger from '../../../shared/utils/logger.js';

/**
 * Get allowed origins from environment variables
 * Supports comma-separated list of origins
 */
const getAllowedOrigins = (): string[] => {
  const originsEnv = process.env.ALLOWED_ORIGINS || '';

  // Default origins for development
  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:4200',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
  ];

  if (!originsEnv) {
    // In production without explicit origins, deny all external origins
    return process.env.NODE_ENV === 'production' ? [] : defaultOrigins;
  }

  return originsEnv.split(',').map((origin) => origin.trim()).filter(Boolean);
};

/**
 * CORS configuration with strict whitelist
 * Only allows requests from authorized origins
 */
const corsOptions: CorsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = getAllowedOrigins();

    // Allow requests without origin (mobile apps, Postman, server-to-server, etc.)
    // In production, you might want to restrict this further
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
      callback(new Error(`Origin ${origin} not allowed by CORS policy`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Correlation-ID',
    'X-Request-ID',
    'Accept',
    'Accept-Language',
    'Accept-Encoding',
  ],
  exposedHeaders: [
    'X-Correlation-ID',
    'X-Request-ID',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
  ],
  maxAge: 86400, // 24 hours - browsers cache preflight responses
  optionsSuccessStatus: 200, // For legacy browser support
};

/**
 * Strict CORS middleware for API endpoints
 */
export const corsMiddleware = cors(corsOptions);

/**
 * Permissive CORS for health check endpoints
 * Allows monitoring services to check API health
 */
export const healthCheckCors = cors({
  origin: '*',
  methods: ['GET', 'HEAD'],
  maxAge: 3600,
});
