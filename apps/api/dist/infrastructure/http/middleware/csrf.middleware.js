import crypto from 'crypto';
import logger from '../../../shared/utils/logger.js';
const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_TOKEN_TTL = 3600000;
const tokenStore = new Map();
setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of tokenStore.entries()) {
        if (now - entry.createdAt > CSRF_TOKEN_TTL) {
            tokenStore.delete(key);
            cleaned++;
        }
    }
    if (cleaned > 0) {
        logger.debug('[CSRF] Cleaned expired tokens', { count: cleaned });
    }
}, 300000);
export function generateCSRFToken() {
    return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}
export function csrfProtection(options = {}) {
    const { excludePaths = [], excludePatterns = [], cookieOptions = {}, } = options;
    const defaultExcludePaths = [
        '/health',
        '/api/v1/public',
        '/api/v2/public',
        '/webhooks',
    ];
    const allExcludePaths = [...defaultExcludePaths, ...excludePaths];
    return (req, res, next) => {
        const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
        if (safeMethods.includes(req.method)) {
            ensureCSRFToken(req, res, cookieOptions);
            return next();
        }
        const isExcluded = allExcludePaths.some(path => req.path.startsWith(path)) ||
            excludePatterns.some(pattern => pattern.test(req.path));
        if (isExcluded) {
            return next();
        }
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return next();
        }
        const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
        const headerToken = req.headers[CSRF_HEADER_NAME];
        if (!cookieToken || !headerToken) {
            logger.warn('[CSRF] Missing token', {
                path: req.path,
                method: req.method,
                hasCookie: !!cookieToken,
                hasHeader: !!headerToken,
                ip: req.ip,
            });
            res.status(403).json({
                error: {
                    code: 'CSRF_TOKEN_MISSING',
                    message: 'CSRF token is required for this request',
                },
            });
            return;
        }
        if (!timingSafeEqual(cookieToken, headerToken)) {
            logger.warn('[CSRF] Token mismatch', {
                path: req.path,
                method: req.method,
                ip: req.ip,
            });
            res.status(403).json({
                error: {
                    code: 'CSRF_TOKEN_INVALID',
                    message: 'Invalid CSRF token',
                },
            });
            return;
        }
        const storedEntry = tokenStore.get(cookieToken);
        if (!storedEntry || Date.now() - storedEntry.createdAt > CSRF_TOKEN_TTL) {
            logger.warn('[CSRF] Token expired or not found', {
                path: req.path,
                method: req.method,
                ip: req.ip,
            });
            res.status(403).json({
                error: {
                    code: 'CSRF_TOKEN_EXPIRED',
                    message: 'CSRF token has expired. Please refresh and try again.',
                },
            });
            return;
        }
        ensureCSRFToken(req, res, cookieOptions);
        next();
    };
}
function ensureCSRFToken(req, res, cookieOptions) {
    const existingToken = req.cookies?.[CSRF_COOKIE_NAME];
    if (existingToken && tokenStore.has(existingToken)) {
        const entry = tokenStore.get(existingToken);
        if (Date.now() - entry.createdAt < CSRF_TOKEN_TTL / 2) {
            return;
        }
    }
    const newToken = generateCSRFToken();
    const userId = req.user?.id;
    tokenStore.set(newToken, {
        token: newToken,
        createdAt: Date.now(),
        userId,
    });
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie(CSRF_COOKIE_NAME, newToken, {
        httpOnly: cookieOptions.httpOnly ?? false,
        secure: cookieOptions.secure ?? isProduction,
        sameSite: cookieOptions.sameSite ?? 'strict',
        maxAge: CSRF_TOKEN_TTL,
        path: '/',
    });
    res.setHeader('X-CSRF-Token', newToken);
}
function timingSafeEqual(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return crypto.timingSafeEqual(bufA, bufB);
}
export function csrfTokenEndpoint(req, res) {
    const token = generateCSRFToken();
    const userId = req.user?.id;
    tokenStore.set(token, {
        token,
        createdAt: Date.now(),
        userId,
    });
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie(CSRF_COOKIE_NAME, token, {
        httpOnly: false,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: CSRF_TOKEN_TTL,
        path: '/',
    });
    res.json({
        csrfToken: token,
        expiresIn: CSRF_TOKEN_TTL,
    });
}
export function clearCSRFToken(req, res) {
    const token = req.cookies?.[CSRF_COOKIE_NAME];
    if (token) {
        tokenStore.delete(token);
    }
    res.clearCookie(CSRF_COOKIE_NAME);
}
export default csrfProtection;
