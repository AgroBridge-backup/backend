import { AuditLogger, AuditAction } from '../../logging/audit.logger.js';
import { prisma } from '../../database/prisma/client.js';
import logger from '../../../shared/utils/logger.js';
const auditLogger = new AuditLogger(prisma);
const METHOD_TO_ACTION = {
    POST: AuditAction.CREATE,
    PUT: AuditAction.UPDATE,
    PATCH: AuditAction.UPDATE,
    DELETE: AuditAction.DELETE,
    GET: AuditAction.READ,
};
const PATH_TO_RESOURCE = {
    '/auth': 'Auth',
    '/producers': 'Producer',
    '/batches': 'Batch',
    '/events': 'Event',
    '/certifications': 'Certification',
    '/certificates': 'Certificate',
    '/notifications': 'Notification',
};
const EXCLUDED_PATHS = [
    '/api/v1/status',
    '/health',
    '/health/ready',
    '/admin/queues',
];
const MUTATION_ONLY_PATHS = [
    '/batches',
    '/producers',
    '/events',
];
export const auditMiddleware = (req, res, next) => {
    if (EXCLUDED_PATHS.some((path) => req.path.includes(path))) {
        return next();
    }
    const startTime = Date.now();
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    let logged = false;
    const logAudit = (responseBody) => {
        if (logged)
            return;
        logged = true;
        const durationMs = Date.now() - startTime;
        const method = req.method;
        const isSuccess = res.statusCode >= 200 && res.statusCode < 400;
        const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
        const shouldAudit = isMutation || !MUTATION_ONLY_PATHS.some((p) => req.path.includes(p));
        if (!shouldAudit)
            return;
        const requestInfo = AuditLogger.extractRequestInfo(req);
        const userId = req.user?.userId;
        const action = determineAction(req, responseBody);
        const resource = extractResourceFromPath(req.path);
        const resourceId = extractResourceIdFromPath(req.path, responseBody);
        auditLogger.log({
            userId,
            action,
            resource,
            resourceId,
            details: {
                method,
                path: req.path,
                statusCode: res.statusCode,
                query: sanitizeData(req.query),
                body: isMutation ? sanitizeBody(req.body) : undefined,
                responseId: typeof responseBody === 'object' && responseBody !== null
                    ? responseBody.id || responseBody.data?.id
                    : undefined,
            },
            success: isSuccess,
            errorMessage: !isSuccess ? extractErrorMessage(responseBody) : undefined,
            durationMs,
            ...requestInfo,
        }).catch((err) => {
            logger.error(`[AuditMiddleware] Failed to log audit entry: ${err}`);
        });
    };
    res.json = function (data) {
        logAudit(data);
        return originalJson(data);
    };
    res.send = function (data) {
        logAudit(data);
        return originalSend(data);
    };
    res.on('finish', () => {
        logAudit();
    });
    next();
};
function determineAction(req, responseBody) {
    const method = req.method;
    const path = req.path.toLowerCase();
    if (path.includes('/auth/login'))
        return AuditAction.LOGIN;
    if (path.includes('/auth/logout'))
        return AuditAction.LOGOUT;
    if (path.includes('/auth/register'))
        return AuditAction.REGISTER;
    if (path.includes('/auth/refresh'))
        return AuditAction.TOKEN_REFRESH;
    if (path.includes('/password-reset'))
        return AuditAction.PASSWORD_RESET;
    if (path.includes('/password') && method === 'PUT')
        return AuditAction.PASSWORD_CHANGE;
    if (path.includes('/whitelist'))
        return AuditAction.WHITELIST_PRODUCER;
    if (path.includes('/verify') && path.includes('/producer'))
        return AuditAction.VERIFY_PRODUCER;
    if (path.includes('/verify') && path.includes('/event'))
        return AuditAction.VERIFY_EVENT;
    if (path.includes('/suspend'))
        return AuditAction.SUSPEND_PRODUCER;
    if (path.includes('/qr'))
        return AuditAction.GENERATE_QR;
    if (path.includes('/status') && method === 'PUT')
        return AuditAction.UPDATE_BATCH_STATUS;
    if (path.includes('/events') && method === 'POST')
        return AuditAction.REGISTER_EVENT;
    if (path.includes('/certifications') && method === 'POST')
        return AuditAction.ADD_CERTIFICATION;
    if (path.includes('/export'))
        return AuditAction.EXPORT_DATA;
    return METHOD_TO_ACTION[method] || AuditAction.READ;
}
function extractResourceFromPath(path) {
    for (const [pattern, resource] of Object.entries(PATH_TO_RESOURCE)) {
        if (path.includes(pattern)) {
            return resource;
        }
    }
    const match = path.match(/\/api\/v\d+\/(\w+)/);
    if (match) {
        const resource = match[1];
        return resource.charAt(0).toUpperCase() + resource.slice(1);
    }
    return 'Unknown';
}
function extractResourceIdFromPath(path, responseBody) {
    const uuidMatch = path.match(/\/([a-f0-9-]{36})/i);
    if (uuidMatch) {
        return uuidMatch[1];
    }
    if (typeof responseBody === 'object' && responseBody !== null) {
        const body = responseBody;
        if (typeof body.id === 'string')
            return body.id;
        if (typeof body.data === 'object' && body.data !== null) {
            const data = body.data;
            if (typeof data.id === 'string')
                return data.id;
        }
    }
    return undefined;
}
function sanitizeBody(body) {
    if (!body || typeof body !== 'object')
        return undefined;
    const sanitized = { ...body };
    const sensitiveFields = [
        'password',
        'passwordHash',
        'passwordConfirm',
        'newPassword',
        'currentPassword',
        'token',
        'refreshToken',
        'accessToken',
        'secret',
        'apiKey',
        'privateKey',
    ];
    for (const field of sensitiveFields) {
        if (field in sanitized) {
            sanitized[field] = '[REDACTED]';
        }
    }
    return sanitized;
}
function sanitizeData(data) {
    if (!data || typeof data !== 'object')
        return data;
    const sanitized = { ...data };
    const sensitiveParams = ['token', 'key', 'secret', 'password'];
    for (const param of sensitiveParams) {
        if (param in sanitized) {
            sanitized[param] = '[REDACTED]';
        }
    }
    return sanitized;
}
function extractErrorMessage(responseBody) {
    if (!responseBody || typeof responseBody !== 'object')
        return undefined;
    const body = responseBody;
    if (typeof body.error === 'string')
        return body.error;
    if (typeof body.message === 'string')
        return body.message;
    if (typeof body.error === 'object' && body.error !== null) {
        const error = body.error;
        if (typeof error.message === 'string')
            return error.message;
    }
    return undefined;
}
export { auditLogger };
