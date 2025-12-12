/**
 * Enhanced Security Middleware
 * - Additional security headers
 * - Multiple rate limiters for different endpoint types
 * - Request size validation
 * - XSS protection
 */
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
/**
 * Enhanced Helmet configuration with security headers
 */
export const helmetConfig = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"], // For Swagger UI
            scriptSrc: ["'self'", "'unsafe-inline'"], // For Swagger UI
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", 'data:'],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
    },
    frameguard: {
        action: 'deny',
    },
    referrerPolicy: {
        policy: 'strict-origin-when-cross-origin',
    },
    xssFilter: true,
    noSniff: true,
    ieNoOpen: true,
    hidePoweredBy: true,
});
/**
 * Additional security headers middleware
 */
export const additionalSecurityHeaders = (req, res, next) => {
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    // XSS Protection (legacy but still useful)
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Permissions policy
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
    // Remove server identification
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');
    next();
};
/**
 * Global rate limiter - 100 requests per 15 minutes
 */
export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: 'Too many requests',
            message: 'Please try again later',
            retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() || Date.now()) / 1000),
        });
    },
});
/**
 * Strict rate limiter for authentication endpoints
 * 5 attempts per 15 minutes per IP
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    skipSuccessfulRequests: true,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: 'Too many authentication attempts',
            message: 'Account temporarily locked for security. Please try again later.',
            retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() || Date.now()) / 1000),
        });
    },
});
/**
 * Rate limiter for write operations (POST, PUT, DELETE)
 * 20 requests per 15 minutes
 */
export const writeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    skip: (req) => req.method === 'GET',
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: 'Too many write operations',
            message: 'Please slow down your requests',
        });
    },
});
/**
 * Validate request body size
 */
export const validateRequestSize = (req, res, next) => {
    const contentLength = req.headers['content-length'];
    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
        // 10MB limit
        return res.status(413).json({
            success: false,
            error: 'Payload too large',
            message: 'Request body exceeds 10MB limit',
        });
    }
    next();
};
/**
 * Input sanitization to prevent XSS attacks
 */
export const sanitizeInput = (req, res, next) => {
    const sanitize = (obj) => {
        if (typeof obj === 'string') {
            // Remove potentially dangerous HTML/script tags
            return obj
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '') // Remove inline event handlers
                .trim();
        }
        if (Array.isArray(obj)) {
            return obj.map(sanitize);
        }
        if (obj !== null && typeof obj === 'object') {
            return Object.keys(obj).reduce((acc, key) => {
                acc[key] = sanitize(obj[key]);
                return acc;
            }, {});
        }
        return obj;
    };
    if (req.body) {
        req.body = sanitize(req.body);
    }
    if (req.query) {
        req.query = sanitize(req.query);
    }
    next();
};
/**
 * CORS configuration with multiple allowed origins
 */
export const corsOptions = {
    origin: (origin, callback) => {
        const allowedOrigins = process.env.CORS_ORIGINS
            ? process.env.CORS_ORIGINS.split(',')
            : [
                'http://localhost:3000',
                'http://localhost:3001',
                'https://agrobridge.io',
                'https://www.agrobridge.io',
            ];
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page', 'X-Correlation-ID'],
    maxAge: 86400, // 24 hours
    optionsSuccessStatus: 200,
};
