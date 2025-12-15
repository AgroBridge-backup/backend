import { createDataLoaders } from './dataloaders/index.js';
import { AuthenticationError } from './errors.js';
import jwt from 'jsonwebtoken';
function extractUserFromToken(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    const token = authHeader.substring(7);
    try {
        const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';
        const payload = jwt.verify(token, jwtSecret);
        return {
            id: payload.sub,
            email: payload.email,
            role: payload.role,
        };
    }
    catch {
        return null;
    }
}
function generateRequestId() {
    return `gql-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
export function createContext(prisma) {
    return ({ req, res }) => {
        const user = extractUserFromToken(req);
        const requestId = req.headers['x-request-id'] || generateRequestId();
        const startTime = Date.now();
        return {
            req,
            res,
            prisma,
            loaders: createDataLoaders(prisma),
            user,
            requestId,
            startTime,
        };
    };
}
export function requireAuth(context) {
    if (!context.user) {
        throw new AuthenticationError('Authentication required');
    }
}
export function requireRole(context, allowedRoles) {
    requireAuth(context);
    if (!allowedRoles.includes(context.user.role)) {
        throw new AuthenticationError(`Access denied. Required roles: ${allowedRoles.join(', ')}`);
    }
}
export function hasRole(context, roles) {
    return context.user !== null && roles.includes(context.user.role);
}
export function isAdmin(context) {
    return context.user?.role === 'ADMIN';
}
export function isAdminOrAuditor(context) {
    return context.user?.role === 'ADMIN' || context.user?.role === 'CERTIFIER';
}
export function isOwner(context, ownerId) {
    return context.user?.id === ownerId;
}
export function canAccess(context, ownerId) {
    if (!context.user)
        return false;
    return isOwner(context, ownerId) || isAdminOrAuditor(context);
}
