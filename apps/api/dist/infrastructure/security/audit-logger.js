import { logger } from '../logging/logger.js';
let prisma = null;
let redis = null;
export function initAuditLogger(prismaClient, redisClient) {
    prisma = prismaClient;
    redis = redisClient || null;
    logger.info('Audit logger initialized');
}
export var AuditEventType;
(function (AuditEventType) {
    AuditEventType["AUTH_LOGIN_SUCCESS"] = "AUTH_LOGIN_SUCCESS";
    AuditEventType["AUTH_LOGIN_FAILURE"] = "AUTH_LOGIN_FAILURE";
    AuditEventType["AUTH_LOGOUT"] = "AUTH_LOGOUT";
    AuditEventType["AUTH_TOKEN_REFRESH"] = "AUTH_TOKEN_REFRESH";
    AuditEventType["AUTH_PASSWORD_CHANGE"] = "AUTH_PASSWORD_CHANGE";
    AuditEventType["AUTH_PASSWORD_RESET_REQUEST"] = "AUTH_PASSWORD_RESET_REQUEST";
    AuditEventType["AUTH_PASSWORD_RESET_COMPLETE"] = "AUTH_PASSWORD_RESET_COMPLETE";
    AuditEventType["AUTH_2FA_ENABLED"] = "AUTH_2FA_ENABLED";
    AuditEventType["AUTH_2FA_DISABLED"] = "AUTH_2FA_DISABLED";
    AuditEventType["AUTH_2FA_VERIFIED"] = "AUTH_2FA_VERIFIED";
    AuditEventType["AUTH_SESSION_INVALIDATED"] = "AUTH_SESSION_INVALIDATED";
    AuditEventType["USER_CREATED"] = "USER_CREATED";
    AuditEventType["USER_UPDATED"] = "USER_UPDATED";
    AuditEventType["USER_DELETED"] = "USER_DELETED";
    AuditEventType["USER_ROLE_CHANGED"] = "USER_ROLE_CHANGED";
    AuditEventType["USER_PERMISSIONS_CHANGED"] = "USER_PERMISSIONS_CHANGED";
    AuditEventType["USER_SUSPENDED"] = "USER_SUSPENDED";
    AuditEventType["USER_REACTIVATED"] = "USER_REACTIVATED";
    AuditEventType["DATA_READ"] = "DATA_READ";
    AuditEventType["DATA_CREATED"] = "DATA_CREATED";
    AuditEventType["DATA_UPDATED"] = "DATA_UPDATED";
    AuditEventType["DATA_DELETED"] = "DATA_DELETED";
    AuditEventType["DATA_EXPORTED"] = "DATA_EXPORTED";
    AuditEventType["DATA_BULK_OPERATION"] = "DATA_BULK_OPERATION";
    AuditEventType["SECURITY_RATE_LIMIT_EXCEEDED"] = "SECURITY_RATE_LIMIT_EXCEEDED";
    AuditEventType["SECURITY_INVALID_TOKEN"] = "SECURITY_INVALID_TOKEN";
    AuditEventType["SECURITY_UNAUTHORIZED_ACCESS"] = "SECURITY_UNAUTHORIZED_ACCESS";
    AuditEventType["SECURITY_SUSPICIOUS_ACTIVITY"] = "SECURITY_SUSPICIOUS_ACTIVITY";
    AuditEventType["SECURITY_INJECTION_ATTEMPT"] = "SECURITY_INJECTION_ATTEMPT";
    AuditEventType["SECURITY_XSS_ATTEMPT"] = "SECURITY_XSS_ATTEMPT";
    AuditEventType["SECURITY_CSRF_ATTEMPT"] = "SECURITY_CSRF_ATTEMPT";
    AuditEventType["API_REQUEST"] = "API_REQUEST";
    AuditEventType["API_ERROR"] = "API_ERROR";
    AuditEventType["API_KEY_CREATED"] = "API_KEY_CREATED";
    AuditEventType["API_KEY_REVOKED"] = "API_KEY_REVOKED";
    AuditEventType["SYSTEM_CONFIG_CHANGED"] = "SYSTEM_CONFIG_CHANGED";
    AuditEventType["SYSTEM_MAINTENANCE_MODE"] = "SYSTEM_MAINTENANCE_MODE";
    AuditEventType["SYSTEM_BACKUP_CREATED"] = "SYSTEM_BACKUP_CREATED";
    AuditEventType["SYSTEM_BACKUP_RESTORED"] = "SYSTEM_BACKUP_RESTORED";
    AuditEventType["GDPR_DATA_ACCESS_REQUEST"] = "GDPR_DATA_ACCESS_REQUEST";
    AuditEventType["GDPR_DATA_DELETION_REQUEST"] = "GDPR_DATA_DELETION_REQUEST";
    AuditEventType["GDPR_DATA_EXPORT_REQUEST"] = "GDPR_DATA_EXPORT_REQUEST";
    AuditEventType["GDPR_CONSENT_GIVEN"] = "GDPR_CONSENT_GIVEN";
    AuditEventType["GDPR_CONSENT_WITHDRAWN"] = "GDPR_CONSENT_WITHDRAWN";
})(AuditEventType || (AuditEventType = {}));
export var AuditSeverity;
(function (AuditSeverity) {
    AuditSeverity["LOW"] = "LOW";
    AuditSeverity["MEDIUM"] = "MEDIUM";
    AuditSeverity["HIGH"] = "HIGH";
    AuditSeverity["CRITICAL"] = "CRITICAL";
})(AuditSeverity || (AuditSeverity = {}));
const EVENT_SEVERITY_MAP = {
    [AuditEventType.AUTH_LOGIN_SUCCESS]: AuditSeverity.LOW,
    [AuditEventType.AUTH_LOGIN_FAILURE]: AuditSeverity.MEDIUM,
    [AuditEventType.AUTH_LOGOUT]: AuditSeverity.LOW,
    [AuditEventType.AUTH_TOKEN_REFRESH]: AuditSeverity.LOW,
    [AuditEventType.AUTH_PASSWORD_CHANGE]: AuditSeverity.HIGH,
    [AuditEventType.AUTH_PASSWORD_RESET_REQUEST]: AuditSeverity.MEDIUM,
    [AuditEventType.AUTH_PASSWORD_RESET_COMPLETE]: AuditSeverity.HIGH,
    [AuditEventType.AUTH_2FA_ENABLED]: AuditSeverity.HIGH,
    [AuditEventType.AUTH_2FA_DISABLED]: AuditSeverity.HIGH,
    [AuditEventType.AUTH_2FA_VERIFIED]: AuditSeverity.LOW,
    [AuditEventType.AUTH_SESSION_INVALIDATED]: AuditSeverity.MEDIUM,
    [AuditEventType.USER_CREATED]: AuditSeverity.MEDIUM,
    [AuditEventType.USER_UPDATED]: AuditSeverity.LOW,
    [AuditEventType.USER_DELETED]: AuditSeverity.HIGH,
    [AuditEventType.USER_ROLE_CHANGED]: AuditSeverity.HIGH,
    [AuditEventType.USER_PERMISSIONS_CHANGED]: AuditSeverity.HIGH,
    [AuditEventType.USER_SUSPENDED]: AuditSeverity.HIGH,
    [AuditEventType.USER_REACTIVATED]: AuditSeverity.MEDIUM,
    [AuditEventType.DATA_READ]: AuditSeverity.LOW,
    [AuditEventType.DATA_CREATED]: AuditSeverity.LOW,
    [AuditEventType.DATA_UPDATED]: AuditSeverity.LOW,
    [AuditEventType.DATA_DELETED]: AuditSeverity.MEDIUM,
    [AuditEventType.DATA_EXPORTED]: AuditSeverity.MEDIUM,
    [AuditEventType.DATA_BULK_OPERATION]: AuditSeverity.HIGH,
    [AuditEventType.SECURITY_RATE_LIMIT_EXCEEDED]: AuditSeverity.MEDIUM,
    [AuditEventType.SECURITY_INVALID_TOKEN]: AuditSeverity.MEDIUM,
    [AuditEventType.SECURITY_UNAUTHORIZED_ACCESS]: AuditSeverity.HIGH,
    [AuditEventType.SECURITY_SUSPICIOUS_ACTIVITY]: AuditSeverity.CRITICAL,
    [AuditEventType.SECURITY_INJECTION_ATTEMPT]: AuditSeverity.CRITICAL,
    [AuditEventType.SECURITY_XSS_ATTEMPT]: AuditSeverity.HIGH,
    [AuditEventType.SECURITY_CSRF_ATTEMPT]: AuditSeverity.HIGH,
    [AuditEventType.API_REQUEST]: AuditSeverity.LOW,
    [AuditEventType.API_ERROR]: AuditSeverity.MEDIUM,
    [AuditEventType.API_KEY_CREATED]: AuditSeverity.HIGH,
    [AuditEventType.API_KEY_REVOKED]: AuditSeverity.HIGH,
    [AuditEventType.SYSTEM_CONFIG_CHANGED]: AuditSeverity.CRITICAL,
    [AuditEventType.SYSTEM_MAINTENANCE_MODE]: AuditSeverity.HIGH,
    [AuditEventType.SYSTEM_BACKUP_CREATED]: AuditSeverity.MEDIUM,
    [AuditEventType.SYSTEM_BACKUP_RESTORED]: AuditSeverity.CRITICAL,
    [AuditEventType.GDPR_DATA_ACCESS_REQUEST]: AuditSeverity.HIGH,
    [AuditEventType.GDPR_DATA_DELETION_REQUEST]: AuditSeverity.CRITICAL,
    [AuditEventType.GDPR_DATA_EXPORT_REQUEST]: AuditSeverity.HIGH,
    [AuditEventType.GDPR_CONSENT_GIVEN]: AuditSeverity.MEDIUM,
    [AuditEventType.GDPR_CONSENT_WITHDRAWN]: AuditSeverity.HIGH,
};
export async function createAuditLog(entry) {
    const timestamp = new Date();
    const severity = entry.eventType ? EVENT_SEVERITY_MAP[entry.eventType] : AuditSeverity.LOW;
    const fullEntry = {
        timestamp,
        eventType: entry.eventType || AuditEventType.API_REQUEST,
        severity,
        action: entry.action || 'unknown',
        description: entry.description || '',
        success: entry.success ?? true,
        ...entry,
    };
    try {
        logger.info('Audit event', {
            audit: true,
            ...fullEntry,
            metadata: fullEntry.metadata ? JSON.stringify(fullEntry.metadata) : undefined,
        });
        if (redis) {
            const key = `audit:${timestamp.toISOString().split('T')[0]}`;
            await redis.lpush(key, JSON.stringify(fullEntry));
            await redis.expire(key, 90 * 24 * 60 * 60);
        }
        if (prisma) {
            await prisma.auditLog?.create({
                data: {
                    eventType: fullEntry.eventType,
                    severity: fullEntry.severity,
                    userId: fullEntry.userId,
                    userEmail: fullEntry.userEmail,
                    userRole: fullEntry.userRole,
                    ipAddress: fullEntry.ipAddress,
                    userAgent: fullEntry.userAgent,
                    resourceType: fullEntry.resourceType,
                    resourceId: fullEntry.resourceId,
                    action: fullEntry.action,
                    description: fullEntry.description,
                    metadata: fullEntry.metadata ? JSON.stringify(fullEntry.metadata) : null,
                    requestId: fullEntry.requestId,
                    sessionId: fullEntry.sessionId,
                    success: fullEntry.success,
                    errorMessage: fullEntry.errorMessage,
                    timestamp: fullEntry.timestamp,
                },
            }).catch(() => {
            });
        }
    }
    catch (error) {
        logger.error('Failed to create audit log', { error, entry: fullEntry });
    }
}
export class AuditLogger {
    entry = {};
    eventType(type) {
        this.entry.eventType = type;
        return this;
    }
    user(userId, email, role) {
        this.entry.userId = userId;
        this.entry.userEmail = email;
        this.entry.userRole = role;
        return this;
    }
    request(req) {
        this.entry.ipAddress = req.ip || req.socket.remoteAddress;
        this.entry.userAgent = req.headers['user-agent'];
        this.entry.requestId = req.headers['x-request-id'];
        const user = req.user;
        if (user) {
            this.entry.userId = user.id;
            this.entry.userEmail = user.email;
            this.entry.userRole = user.role;
        }
        return this;
    }
    resource(type, id) {
        this.entry.resourceType = type;
        this.entry.resourceId = id;
        return this;
    }
    action(action) {
        this.entry.action = action;
        return this;
    }
    description(desc) {
        this.entry.description = desc;
        return this;
    }
    metadata(data) {
        this.entry.metadata = { ...this.entry.metadata, ...data };
        return this;
    }
    session(sessionId) {
        this.entry.sessionId = sessionId;
        return this;
    }
    success() {
        this.entry.success = true;
        return this;
    }
    failure(errorMessage) {
        this.entry.success = false;
        this.entry.errorMessage = errorMessage;
        return this;
    }
    async log() {
        await createAuditLog(this.entry);
    }
}
export function audit() {
    return new AuditLogger();
}
export function auditMiddleware(options = {}) {
    const { logAllRequests = false, excludePaths = ['/health', '/metrics', '/favicon.ico'], sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'refreshToken'], } = options;
    return (req, res, next) => {
        if (excludePaths.some((path) => req.path.startsWith(path))) {
            next();
            return;
        }
        const startTime = Date.now();
        const originalEnd = res.end;
        res.end = function (chunk, encoding, callback) {
            const duration = Date.now() - startTime;
            const shouldLog = logAllRequests ||
                res.statusCode >= 400 ||
                ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
            if (shouldLog) {
                const entry = {
                    eventType: res.statusCode >= 400 ? AuditEventType.API_ERROR : AuditEventType.API_REQUEST,
                    ipAddress: req.ip || req.socket.remoteAddress,
                    userAgent: req.headers['user-agent'],
                    requestId: req.headers['x-request-id'],
                    action: `${req.method} ${req.path}`,
                    description: `${req.method} ${req.originalUrl}`,
                    success: res.statusCode < 400,
                    metadata: {
                        method: req.method,
                        path: req.path,
                        statusCode: res.statusCode,
                        duration,
                        query: sanitizeMetadata(req.query, sensitiveFields),
                        body: sanitizeMetadata(req.body, sensitiveFields),
                    },
                };
                const user = req.user;
                if (user) {
                    entry.userId = user.id;
                    entry.userEmail = user.email;
                    entry.userRole = user.role;
                }
                createAuditLog(entry).catch(() => { });
            }
            return originalEnd.call(this, chunk, encoding, callback);
        };
        next();
    };
}
function sanitizeMetadata(data, sensitiveFields) {
    if (!data || typeof data !== 'object') {
        return undefined;
    }
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
        if (sensitiveFields.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
            sanitized[key] = '[REDACTED]';
        }
        else if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizeMetadata(value, sensitiveFields);
        }
        else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}
export async function queryAuditLogs(filters) {
    if (!prisma) {
        return [];
    }
    const { startDate, endDate, userId, eventType, severity, resourceType, resourceId, success, limit = 100, offset = 0, } = filters;
    try {
        const logs = await prisma.auditLog?.findMany({
            where: {
                timestamp: {
                    gte: startDate,
                    lte: endDate,
                },
                userId,
                eventType,
                severity,
                resourceType,
                resourceId,
                success,
            },
            orderBy: { timestamp: 'desc' },
            take: limit,
            skip: offset,
        }) || [];
        return logs.map((log) => ({
            ...log,
            metadata: log.metadata ? JSON.parse(log.metadata) : undefined,
        }));
    }
    catch (error) {
        logger.error('Failed to query audit logs', { error, filters });
        return [];
    }
}
export async function getAuditStats(period = 'day') {
    const now = new Date();
    const startDate = new Date();
    switch (period) {
        case 'week':
            startDate.setDate(now.getDate() - 7);
            break;
        case 'month':
            startDate.setMonth(now.getMonth() - 1);
            break;
        default:
            startDate.setDate(now.getDate() - 1);
    }
    if (!prisma) {
        return {
            totalEvents: 0,
            byEventType: {},
            bySeverity: {},
            failureRate: 0,
        };
    }
    try {
        const logs = await prisma.auditLog?.findMany({
            where: {
                timestamp: { gte: startDate },
            },
            select: {
                eventType: true,
                severity: true,
                success: true,
            },
        }) || [];
        const byEventType = {};
        const bySeverity = {};
        let failures = 0;
        for (const log of logs) {
            byEventType[log.eventType] = (byEventType[log.eventType] || 0) + 1;
            bySeverity[log.severity] = (bySeverity[log.severity] || 0) + 1;
            if (!log.success)
                failures++;
        }
        return {
            totalEvents: logs.length,
            byEventType,
            bySeverity,
            failureRate: logs.length > 0 ? failures / logs.length : 0,
        };
    }
    catch (error) {
        logger.error('Failed to get audit stats', { error });
        return {
            totalEvents: 0,
            byEventType: {},
            bySeverity: {},
            failureRate: 0,
        };
    }
}
export default {
    audit,
    createAuditLog,
    auditMiddleware,
    queryAuditLogs,
    getAuditStats,
    initAuditLogger,
    AuditEventType,
    AuditSeverity,
};
