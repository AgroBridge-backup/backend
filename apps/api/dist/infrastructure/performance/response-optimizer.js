import compression from 'compression';
import crypto from 'crypto';
import { logger } from '../logging/logger.js';
export const compressionMiddleware = compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    },
});
export function generateETag(body) {
    const content = typeof body === 'string' ? body : JSON.stringify(body);
    const hash = crypto.createHash('md5').update(content).digest('hex');
    return `"${hash}"`;
}
export function generateWeakETag(body, version) {
    const content = typeof body === 'string' ? body : JSON.stringify(body);
    const hash = crypto.createHash('md5').update(content).digest('hex').substring(0, 16);
    return `W/"${version || 'v1'}-${hash}"`;
}
export function etagMiddleware() {
    return (req, res, next) => {
        if (!['GET', 'HEAD'].includes(req.method)) {
            next();
            return;
        }
        const originalJson = res.json.bind(res);
        res.json = function (body) {
            const etag = generateETag(body);
            res.setHeader('ETag', etag);
            const ifNoneMatch = req.headers['if-none-match'];
            if (ifNoneMatch === etag) {
                res.status(304).end();
                return this;
            }
            return originalJson(body);
        };
        next();
    };
}
export function selectFields(data, fields) {
    if (fields.length === 0)
        return data;
    const result = {};
    for (const field of fields) {
        if (field.includes('.')) {
            const [parent, ...rest] = field.split('.');
            if (parent in data) {
                const nestedPath = rest.join('.');
                const parentValue = data[parent];
                if (typeof parentValue === 'object' && parentValue !== null) {
                    result[parent] = {
                        ...result[parent],
                        ...selectFields(parentValue, [nestedPath]),
                    };
                }
            }
        }
        else if (field in data) {
            result[field] = data[field];
        }
    }
    if ('id' in data && !('id' in result)) {
        result.id = data.id;
    }
    return result;
}
export function fieldSelectionMiddleware() {
    return (req, res, next) => {
        const fieldsParam = req.query.fields;
        if (!fieldsParam) {
            next();
            return;
        }
        const requestedFields = fieldsParam.split(',').map((f) => f.trim());
        const originalJson = res.json.bind(res);
        res.json = function (body) {
            if (body && typeof body === 'object') {
                if (Array.isArray(body)) {
                    body = body.map((item) => typeof item === 'object' && item !== null
                        ? selectFields(item, requestedFields)
                        : item);
                }
                else if ('data' in body) {
                    const response = body;
                    if (Array.isArray(response.data)) {
                        response.data = response.data.map((item) => typeof item === 'object' && item !== null
                            ? selectFields(item, requestedFields)
                            : item);
                    }
                    else if (typeof response.data === 'object' && response.data !== null) {
                        response.data = selectFields(response.data, requestedFields);
                    }
                    body = response;
                }
                else {
                    body = selectFields(body, requestedFields);
                }
            }
            return originalJson(body);
        };
        next();
    };
}
export function responseTimeMiddleware() {
    return (req, res, next) => {
        const startTime = process.hrtime.bigint();
        res.on('finish', () => {
            const endTime = process.hrtime.bigint();
            const durationNs = endTime - startTime;
            const durationMs = Number(durationNs) / 1_000_000;
            res.setHeader('X-Response-Time', `${durationMs.toFixed(2)}ms`);
            if (durationMs > 1000) {
                logger.warn('Slow response', {
                    path: req.path,
                    method: req.method,
                    duration: `${durationMs.toFixed(2)}ms`,
                    statusCode: res.statusCode,
                });
            }
        });
        next();
    };
}
export function cacheControl(options) {
    return (req, res, next) => {
        const directives = [];
        if (options.noStore) {
            directives.push('no-store');
        }
        else if (options.noCache) {
            directives.push('no-cache');
        }
        else {
            if (options.private) {
                directives.push('private');
            }
            else {
                directives.push('public');
            }
            if (options.maxAge !== undefined) {
                directives.push(`max-age=${options.maxAge}`);
            }
            if (options.sMaxAge !== undefined) {
                directives.push(`s-maxage=${options.sMaxAge}`);
            }
            if (options.staleWhileRevalidate !== undefined) {
                directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
            }
            if (options.staleIfError !== undefined) {
                directives.push(`stale-if-error=${options.staleIfError}`);
            }
            if (options.mustRevalidate) {
                directives.push('must-revalidate');
            }
            if (options.immutable) {
                directives.push('immutable');
            }
        }
        res.setHeader('Cache-Control', directives.join(', '));
        next();
    };
}
export const cacheControlPolicies = {
    noCache: cacheControl({ noStore: true }),
    short: cacheControl({
        maxAge: 60,
        staleWhileRevalidate: 30,
    }),
    medium: cacheControl({
        maxAge: 300,
        sMaxAge: 600,
        staleWhileRevalidate: 60,
    }),
    long: cacheControl({
        maxAge: 86400,
        sMaxAge: 604800,
        staleWhileRevalidate: 86400,
        immutable: true,
    }),
    private: cacheControl({
        private: true,
        maxAge: 60,
        mustRevalidate: true,
    }),
};
export function successResponse(data, meta, links) {
    return {
        success: true,
        data,
        meta,
        links,
        timestamp: new Date().toISOString(),
    };
}
export function errorResponse(code, message, details) {
    return {
        success: false,
        error: {
            code,
            message,
            details,
        },
        timestamp: new Date().toISOString(),
    };
}
export function responseEnvelopeMiddleware() {
    return (req, res, next) => {
        const originalJson = res.json.bind(res);
        res.json = function (body) {
            if (body && typeof body === 'object' && 'success' in body) {
                const requestId = req.headers['x-request-id'];
                if (requestId) {
                    body.requestId = requestId;
                }
                return originalJson(body);
            }
            const envelope = {
                success: res.statusCode < 400,
                data: body,
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'],
            };
            return originalJson(envelope);
        };
        next();
    };
}
export function streamJsonArray(res, items) {
    return new Promise(async (resolve, reject) => {
        res.setHeader('Content-Type', 'application/json');
        res.write('{"success":true,"data":[');
        let first = true;
        try {
            for await (const item of items) {
                if (!first) {
                    res.write(',');
                }
                res.write(JSON.stringify(item));
                first = false;
            }
            res.write(`],"timestamp":"${new Date().toISOString()}"}`);
            res.end();
            resolve();
        }
        catch (error) {
            reject(error);
        }
    });
}
export function negotiateContent(req) {
    const accept = req.headers.accept || 'application/json';
    if (accept.includes('application/xml') || accept.includes('text/xml')) {
        return 'xml';
    }
    if (accept.includes('text/csv')) {
        return 'csv';
    }
    return 'json';
}
export function responseSizeLimiter(maxSizeBytes = 10 * 1024 * 1024) {
    return (req, res, next) => {
        const originalJson = res.json.bind(res);
        res.json = function (body) {
            const json = JSON.stringify(body);
            if (json.length > maxSizeBytes) {
                logger.warn('Response size limit exceeded', {
                    path: req.path,
                    size: json.length,
                    limit: maxSizeBytes,
                });
                return originalJson({
                    success: false,
                    error: {
                        code: 'RESPONSE_TOO_LARGE',
                        message: 'Response exceeds maximum size limit',
                    },
                });
            }
            return originalJson(body);
        };
        next();
    };
}
export function setCorsHeaders(res, origin, methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', methods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');
}
export default {
    compressionMiddleware,
    generateETag,
    generateWeakETag,
    etagMiddleware,
    selectFields,
    fieldSelectionMiddleware,
    responseTimeMiddleware,
    cacheControl,
    cacheControlPolicies,
    successResponse,
    errorResponse,
    responseEnvelopeMiddleware,
    streamJsonArray,
    negotiateContent,
    responseSizeLimiter,
    setCorsHeaders,
};
