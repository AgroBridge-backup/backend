import jwt from 'jsonwebtoken';
import * as fs from 'node:fs';
import * as path from 'node:path';
import logger from '../../../shared/utils/logger.js';
import { ErrorCode, getErrorMessage, getErrorStatus } from '../../../shared/errors/error-codes.js';
const ADMIN_USERNAME = process.env.ADMIN_DASHBOARD_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_DASHBOARD_PASSWORD;
const ADMIN_IP_ALLOWLIST = process.env.ADMIN_IP_ALLOWLIST?.split(',').map(ip => ip.trim()) || [];
const ENFORCE_IP_ALLOWLIST = process.env.ADMIN_ENFORCE_IP_ALLOWLIST === 'true';
let JWT_PUBLIC_KEY = null;
function getJwtPublicKey() {
    if (JWT_PUBLIC_KEY) {
        return JWT_PUBLIC_KEY;
    }
    const publicKeyPath = process.env.JWT_PUBLIC_KEY_PATH || './jwtRS256.key.pub';
    const resolvedPath = path.resolve(process.cwd(), publicKeyPath);
    try {
        JWT_PUBLIC_KEY = fs.readFileSync(resolvedPath, 'utf-8');
        return JWT_PUBLIC_KEY;
    }
    catch (error) {
        logger.error('[AdminAuth] Failed to load JWT public key', {
            path: resolvedPath,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw new Error(`JWT public key not found at ${resolvedPath}`);
    }
}
function isIpAllowed(req) {
    if (!ENFORCE_IP_ALLOWLIST || ADMIN_IP_ALLOWLIST.length === 0) {
        return true;
    }
    const clientIp = req.ip || req.socket?.remoteAddress || '';
    const normalizedIp = clientIp === '::1' ? '127.0.0.1' : clientIp.replace(/^::ffff:/, '');
    const allowed = ADMIN_IP_ALLOWLIST.includes(normalizedIp) ||
        ADMIN_IP_ALLOWLIST.includes('*');
    if (!allowed) {
        logger.warn('[AdminAuth] SECURITY: IP not in allowlist', {
            clientIp: normalizedIp,
            allowlist: ADMIN_IP_ALLOWLIST,
        });
    }
    return allowed;
}
function verifyToken(token) {
    try {
        const publicKey = getJwtPublicKey();
        const decoded = jwt.verify(token, publicKey, {
            algorithms: ['RS256'],
        });
        return {
            userId: decoded.sub,
            email: decoded.email,
            role: decoded.role,
            jti: decoded.jti,
            exp: decoded.exp,
            producerId: decoded.producerId,
        };
    }
    catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            logger.debug('[AdminAuth] Token expired');
        }
        else if (error instanceof jwt.JsonWebTokenError) {
            logger.debug('[AdminAuth] Invalid token');
        }
        return null;
    }
}
function parseBasicAuth(authHeader) {
    if (!authHeader.startsWith('Basic ')) {
        return null;
    }
    try {
        const base64Credentials = authHeader.slice(6);
        const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
        const [username, password] = credentials.split(':');
        return { username, password };
    }
    catch {
        return null;
    }
}
export function adminAuthMiddleware(req, res, next) {
    if (!isIpAllowed(req)) {
        res.status(getErrorStatus(ErrorCode.SECURITY_IP_BLOCKED)).json({
            success: false,
            error: {
                code: ErrorCode.SECURITY_IP_BLOCKED,
                message: getErrorMessage(ErrorCode.SECURITY_IP_BLOCKED),
                timestamp: new Date().toISOString(),
            },
        });
        return;
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(getErrorStatus(ErrorCode.AUTH_TOKEN_MISSING)).json({
            success: false,
            error: {
                code: ErrorCode.AUTH_TOKEN_MISSING,
                message: getErrorMessage(ErrorCode.AUTH_TOKEN_MISSING),
                timestamp: new Date().toISOString(),
            },
        });
        return;
    }
    const token = authHeader.slice(7);
    const user = verifyToken(token);
    if (!user) {
        res.status(getErrorStatus(ErrorCode.AUTH_TOKEN_INVALID)).json({
            success: false,
            error: {
                code: ErrorCode.AUTH_TOKEN_INVALID,
                message: getErrorMessage(ErrorCode.AUTH_TOKEN_INVALID),
                timestamp: new Date().toISOString(),
            },
        });
        return;
    }
    if (user.role !== 'ADMIN') {
        logger.warn('[AdminAuth] SECURITY: Non-admin access attempt', {
            userId: user.userId,
            email: user.email,
            role: user.role,
            path: req.path,
        });
        res.status(getErrorStatus(ErrorCode.FORBIDDEN_ADMIN_ONLY)).json({
            success: false,
            error: {
                code: ErrorCode.FORBIDDEN_ADMIN_ONLY,
                message: getErrorMessage(ErrorCode.FORBIDDEN_ADMIN_ONLY),
                timestamp: new Date().toISOString(),
            },
        });
        return;
    }
    req.user = user;
    logger.info('[AdminAuth] Admin access granted', {
        userId: user.userId,
        email: user.email,
        path: req.path,
        method: req.method,
    });
    next();
}
export function basicAuthMiddleware(req, res, next) {
    if (!isIpAllowed(req)) {
        res.status(403).send('Access denied');
        return;
    }
    if (process.env.NODE_ENV === 'development' && !ADMIN_PASSWORD) {
        logger.warn('[AdminAuth] Dashboard accessed without auth in development');
        next();
        return;
    }
    if (!ADMIN_PASSWORD) {
        logger.error('[AdminAuth] ADMIN_DASHBOARD_PASSWORD not set');
        res.status(500).send('Admin dashboard not configured');
        return;
    }
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Admin Dashboard"');
        res.status(401).send('Authentication required');
        return;
    }
    const credentials = parseBasicAuth(authHeader);
    if (!credentials) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Admin Dashboard"');
        res.status(401).send('Invalid authentication format');
        return;
    }
    const usernameMatch = credentials.username === ADMIN_USERNAME;
    const passwordMatch = credentials.password === ADMIN_PASSWORD;
    if (!usernameMatch || !passwordMatch) {
        logger.warn('[AdminAuth] SECURITY: Failed dashboard login attempt', {
            username: credentials.username,
            ip: req.ip,
        });
        res.setHeader('WWW-Authenticate', 'Basic realm="Admin Dashboard"');
        res.status(401).send('Invalid credentials');
        return;
    }
    logger.info('[AdminAuth] Dashboard access granted', {
        username: credentials.username,
        path: req.path,
    });
    next();
}
export function adminAuthWithFallback(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        return adminAuthMiddleware(req, res, next);
    }
    return basicAuthMiddleware(req, res, next);
}
export function requireRole(...allowedRoles) {
    return (req, res, next) => {
        const user = req.user;
        if (!user) {
            res.status(getErrorStatus(ErrorCode.AUTH_TOKEN_MISSING)).json({
                success: false,
                error: {
                    code: ErrorCode.AUTH_TOKEN_MISSING,
                    message: getErrorMessage(ErrorCode.AUTH_TOKEN_MISSING),
                    timestamp: new Date().toISOString(),
                },
            });
            return;
        }
        if (!allowedRoles.includes(user.role)) {
            logger.warn('[AdminAuth] SECURITY: Insufficient role', {
                userId: user.userId,
                role: user.role,
                requiredRoles: allowedRoles,
                path: req.path,
            });
            res.status(getErrorStatus(ErrorCode.FORBIDDEN_INSUFFICIENT_ROLE)).json({
                success: false,
                error: {
                    code: ErrorCode.FORBIDDEN_INSUFFICIENT_ROLE,
                    message: getErrorMessage(ErrorCode.FORBIDDEN_INSUFFICIENT_ROLE),
                    timestamp: new Date().toISOString(),
                },
            });
            return;
        }
        next();
    };
}
export default {
    adminAuthMiddleware,
    basicAuthMiddleware,
    adminAuthWithFallback,
    requireRole,
};
