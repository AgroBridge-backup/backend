import sanitizeHtml from 'sanitize-html';
import validator from 'validator';
import hpp from 'hpp';
import { logger } from '../logging/logger.js';
const defaultOptions = {
    allowHtml: false,
    allowedTags: [],
    maxLength: 10000,
    trimWhitespace: true,
};
const SQL_INJECTION_PATTERNS = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/gi,
    /(-{2}|;|\/\*|\*\/)/g,
    /((\%27)|('))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/gi,
    /(\b(AND|OR)\b\s+\d+\s*=\s*\d+)/gi,
    /(\b(AND|OR)\b\s+['"][^'"]+['"]\s*=\s*['"][^'"]+['"])/gi,
];
const NOSQL_INJECTION_PATTERNS = [
    /\$where/gi,
    /\$gt/gi,
    /\$lt/gi,
    /\$ne/gi,
    /\$regex/gi,
    /\$or/gi,
    /\$and/gi,
    /\$nor/gi,
    /\$not/gi,
    /\$exists/gi,
    /\$type/gi,
    /\$expr/gi,
    /\$jsonSchema/gi,
];
const COMMAND_INJECTION_PATTERNS = [
    /[;&|`$(){}[\]<>]/g,
    /\$\(/g,
    /`.*`/g,
];
const XSS_PATTERNS = [
    /<script[^>]*>[\s\S]*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /data:/gi,
    /vbscript:/gi,
    /expression\s*\(/gi,
];
export function detectSqlInjection(value) {
    return SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(value));
}
export function detectNoSqlInjection(value) {
    if (typeof value === 'string') {
        return NOSQL_INJECTION_PATTERNS.some((pattern) => pattern.test(value));
    }
    if (typeof value === 'object' && value !== null) {
        const keys = Object.keys(value);
        return keys.some((key) => key.startsWith('$'));
    }
    return false;
}
export function detectCommandInjection(value) {
    return COMMAND_INJECTION_PATTERNS.some((pattern) => pattern.test(value));
}
export function detectXss(value) {
    return XSS_PATTERNS.some((pattern) => pattern.test(value));
}
export function sanitizeString(value, options = defaultOptions) {
    let sanitized = value;
    if (options.trimWhitespace) {
        sanitized = sanitized.trim();
    }
    if (options.maxLength && sanitized.length > options.maxLength) {
        sanitized = sanitized.substring(0, options.maxLength);
    }
    if (!options.allowHtml) {
        sanitized = sanitizeHtml(sanitized, {
            allowedTags: options.allowedTags || [],
            allowedAttributes: {},
            disallowedTagsMode: 'discard',
        });
    }
    else if (options.allowedTags && options.allowedTags.length > 0) {
        sanitized = sanitizeHtml(sanitized, {
            allowedTags: options.allowedTags,
            allowedAttributes: {
                a: ['href', 'name', 'target', 'rel'],
                img: ['src', 'alt', 'width', 'height'],
            },
        });
    }
    sanitized = validator.escape(sanitized);
    return sanitized;
}
export function sanitizeObject(obj, options = defaultOptions) {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith('$') || key.includes('__')) {
            logger.warn('Dangerous key detected and removed', { key });
            continue;
        }
        if (typeof value === 'string') {
            sanitized[key] = sanitizeString(value, options);
        }
        else if (Array.isArray(value)) {
            sanitized[key] = value.map((item) => {
                if (typeof item === 'string') {
                    return sanitizeString(item, options);
                }
                if (typeof item === 'object' && item !== null) {
                    return sanitizeObject(item, options);
                }
                return item;
            });
        }
        else if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizeObject(value, options);
        }
        else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}
export function inputSanitizer(options = defaultOptions) {
    return (req, res, next) => {
        try {
            if (req.body && typeof req.body === 'object') {
                if (detectNoSqlInjectionDeep(req.body)) {
                    logger.warn('NoSQL injection attempt detected', {
                        ip: req.ip,
                        path: req.path,
                        body: JSON.stringify(req.body).substring(0, 500),
                    });
                    res.status(400).json({
                        success: false,
                        error: {
                            code: 'INVALID_INPUT',
                            message: 'Invalid characters detected in request',
                        },
                    });
                    return;
                }
                req.body = sanitizeObject(req.body, options);
            }
            if (req.query && typeof req.query === 'object') {
                const sanitizedQuery = {};
                for (const [key, value] of Object.entries(req.query)) {
                    if (typeof value === 'string') {
                        if (detectSqlInjection(value)) {
                            logger.warn('SQL injection attempt detected', {
                                ip: req.ip,
                                path: req.path,
                                param: key,
                            });
                            res.status(400).json({
                                success: false,
                                error: {
                                    code: 'INVALID_INPUT',
                                    message: 'Invalid characters detected in query parameter',
                                },
                            });
                            return;
                        }
                        sanitizedQuery[key] = sanitizeString(value, options);
                    }
                    else {
                        sanitizedQuery[key] = value;
                    }
                }
                req.query = sanitizedQuery;
            }
            if (req.params && typeof req.params === 'object') {
                const sanitizedParams = {};
                for (const [key, value] of Object.entries(req.params)) {
                    if (typeof value === 'string') {
                        sanitizedParams[key] = validator.escape(value.trim());
                    }
                }
                req.params = sanitizedParams;
            }
            next();
        }
        catch (error) {
            logger.error('Input sanitization error', { error });
            next(error);
        }
    };
}
function detectNoSqlInjectionDeep(obj, depth = 0) {
    if (depth > 10)
        return false;
    if (typeof obj === 'string') {
        return detectNoSqlInjection(obj);
    }
    if (Array.isArray(obj)) {
        return obj.some((item) => detectNoSqlInjectionDeep(item, depth + 1));
    }
    if (typeof obj === 'object' && obj !== null) {
        const keys = Object.keys(obj);
        if (keys.some((key) => key.startsWith('$'))) {
            return true;
        }
        return Object.values(obj).some((value) => detectNoSqlInjectionDeep(value, depth + 1));
    }
    return false;
}
export function xssProtection() {
    return (req, res, next) => {
        if (req.body) {
            const bodyString = JSON.stringify(req.body);
            if (detectXss(bodyString)) {
                logger.warn('XSS attempt detected', {
                    ip: req.ip,
                    path: req.path,
                    method: req.method,
                });
                res.status(400).json({
                    success: false,
                    error: {
                        code: 'XSS_DETECTED',
                        message: 'Potentially dangerous content detected',
                    },
                });
                return;
            }
        }
        const queryString = JSON.stringify(req.query);
        if (detectXss(queryString)) {
            logger.warn('XSS attempt in query params', {
                ip: req.ip,
                path: req.path,
            });
            res.status(400).json({
                success: false,
                error: {
                    code: 'XSS_DETECTED',
                    message: 'Potentially dangerous content detected in query parameters',
                },
            });
            return;
        }
        next();
    };
}
export const hppProtection = hpp({
    whitelist: [
        'sort',
        'filter',
        'fields',
        'include',
        'page',
        'limit',
        'status',
        'tags',
        'certifications',
    ],
});
export function sanitizeEmail(email) {
    const trimmed = email.trim().toLowerCase();
    if (!validator.isEmail(trimmed)) {
        return null;
    }
    return validator.normalizeEmail(trimmed) || null;
}
export function sanitizeUrl(url) {
    const trimmed = url.trim();
    if (!validator.isURL(trimmed, { require_protocol: true, protocols: ['http', 'https'] })) {
        return null;
    }
    return trimmed;
}
export function isValidUuid(value) {
    return validator.isUUID(value);
}
export function sanitizeFilename(filename) {
    let sanitized = filename.replace(/[\/\\]/g, '');
    sanitized = sanitized.replace(/[<>:"|?*\x00-\x1f]/g, '');
    sanitized = sanitized.replace(/^[\s.]+|[\s.]+$/g, '');
    if (sanitized.length > 255) {
        const ext = sanitized.split('.').pop() || '';
        const name = sanitized.substring(0, 255 - ext.length - 1);
        sanitized = `${name}.${ext}`;
    }
    return sanitized || 'unnamed';
}
export function sanitizePhone(phone) {
    const cleaned = phone.replace(/[^0-9+]/g, '');
    if (cleaned.length < 10 || cleaned.length > 15) {
        return null;
    }
    return cleaned;
}
export function sanitizeJsonPath(path) {
    const dangerous = ['__proto__', 'constructor', 'prototype'];
    const parts = path.split('.');
    if (parts.some((part) => dangerous.includes(part.toLowerCase()))) {
        return null;
    }
    return path;
}
export function validateContentType(allowedTypes) {
    return (req, res, next) => {
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            const contentType = req.headers['content-type'];
            if (!contentType) {
                res.status(415).json({
                    success: false,
                    error: {
                        code: 'MISSING_CONTENT_TYPE',
                        message: 'Content-Type header is required',
                    },
                });
                return;
            }
            const isAllowed = allowedTypes.some((type) => contentType.toLowerCase().includes(type.toLowerCase()));
            if (!isAllowed) {
                res.status(415).json({
                    success: false,
                    error: {
                        code: 'UNSUPPORTED_MEDIA_TYPE',
                        message: `Content-Type must be one of: ${allowedTypes.join(', ')}`,
                    },
                });
                return;
            }
        }
        next();
    };
}
export default inputSanitizer;
