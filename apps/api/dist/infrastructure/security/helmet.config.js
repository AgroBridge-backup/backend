import helmet from 'helmet';
import { logger } from '../logging/logger.js';
const isProd = process.env.NODE_ENV === 'production';
const apiDomain = process.env.API_DOMAIN || 'api.agrobridgeint.com';
const cdnDomain = process.env.CDN_DOMAIN || 'cdn.agrobridgeint.com';
const frontendDomain = process.env.FRONTEND_DOMAIN || 'agrobridgeint.com';
const contentSecurityPolicy = {
    directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            "'unsafe-eval'",
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
const strictTransportSecurity = {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
};
const referrerPolicy = {
    policy: 'strict-origin-when-cross-origin',
};
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
export function configureHelmet(app) {
    app.use(helmet({
        contentSecurityPolicy: isProd ? contentSecurityPolicy : false,
        crossOriginEmbedderPolicy: false,
        crossOriginOpenerPolicy: { policy: 'same-origin' },
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        dnsPrefetchControl: { allow: false },
        frameguard: { action: 'deny' },
        hidePoweredBy: true,
        hsts: isProd ? strictTransportSecurity : false,
        ieNoOpen: true,
        noSniff: true,
        originAgentCluster: true,
        referrerPolicy,
        xssFilter: true,
    }));
    app.use(customSecurityHeaders);
    if (isProd) {
        app.use(permissionsPolicyMiddleware);
    }
    logger.info('Helmet security headers configured', {
        environment: process.env.NODE_ENV,
        cspEnabled: isProd,
        hstsEnabled: isProd,
    });
}
function customSecurityHeaders(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('X-Download-Options', 'noopen');
    if (req.path.includes('/auth/') || req.path.includes('/users/')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
    }
    const requestId = req.headers['x-request-id'] || generateRequestId();
    res.setHeader('X-Request-ID', requestId);
    if (!isProd) {
        res.setHeader('Server-Timing', 'miss');
    }
    next();
}
function permissionsPolicyMiddleware(req, res, next) {
    const policies = [];
    for (const [feature, allowList] of Object.entries(permissionsPolicy.features)) {
        const kebabFeature = feature.replace(/([A-Z])/g, '-$1').toLowerCase();
        policies.push(`${kebabFeature}=(${allowList.join(' ')})`);
    }
    res.setHeader('Permissions-Policy', policies.join(', '));
    next();
}
function generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}
export const routeSecurityHeaders = {
    documentation: (req, res, next) => {
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        res.setHeader('Content-Security-Policy', "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com; " +
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; " +
            "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; " +
            "img-src 'self' data: https://validator.swagger.io; " +
            "connect-src 'self'");
        next();
    },
    download: (req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Disposition', 'attachment');
        next();
    },
    public: (req, res, next) => {
        res.setHeader('Cache-Control', 'public, max-age=3600');
        next();
    },
    webhook: (req, res, next) => {
        res.removeHeader('X-Frame-Options');
        next();
    },
};
export function secureCorsPreflight(allowedOrigins) {
    return (req, res, next) => {
        const origin = req.headers.origin;
        if (origin && allowedOrigins.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID, X-API-Key');
            res.setHeader('Access-Control-Max-Age', '86400');
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
