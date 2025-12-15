export class ResponseFormatter {
    static success(data) {
        return {
            success: true,
            data,
        };
    }
    static paginated(data, total, page, limit, baseUrl, queryParams) {
        const totalPages = Math.ceil(total / limit);
        const hasNextPage = page < totalPages;
        const hasPreviousPage = page > 1;
        return {
            success: true,
            data,
            meta: {
                page,
                limit,
                total,
                totalPages,
                hasNextPage,
                hasPreviousPage,
            },
            links: this.buildPaginationLinks(baseUrl, page, limit, totalPages, queryParams),
        };
    }
    static error(code, message, details, path, requestId) {
        return {
            success: false,
            error: {
                code,
                message,
                details,
                timestamp: new Date().toISOString(),
                path,
                requestId,
            },
        };
    }
    static validationError(errors, path) {
        return this.error('VALIDATION_ERROR', 'Request validation failed', errors, path);
    }
    static notFound(resource, id, path) {
        const message = id
            ? `${resource} with ID '${id}' not found`
            : `${resource} not found`;
        return this.error('NOT_FOUND', message, undefined, path);
    }
    static unauthorized(message = 'Authentication required', path) {
        return this.error('UNAUTHORIZED', message, undefined, path);
    }
    static forbidden(message = 'Access denied', path) {
        return this.error('FORBIDDEN', message, undefined, path);
    }
    static rateLimited(retryAfter, path) {
        return this.error('RATE_LIMITED', 'Too many requests. Please try again later.', retryAfter ? { retryAfter } : undefined, path);
    }
    static internalError(message = 'An unexpected error occurred', path, requestId) {
        return this.error('INTERNAL_ERROR', message, undefined, path, requestId);
    }
    static conflict(message, details, path) {
        return this.error('CONFLICT', message, details, path);
    }
    static badRequest(message, details, path) {
        return this.error('BAD_REQUEST', message, details, path);
    }
    static buildPaginationLinks(baseUrl, page, limit, totalPages, queryParams) {
        const buildUrl = (p) => {
            const params = new URLSearchParams();
            if (queryParams) {
                Object.entries(queryParams).forEach(([key, value]) => {
                    if (key !== 'page' && key !== 'limit' && value !== undefined) {
                        if (typeof value === 'object') {
                            Object.entries(value).forEach(([nestedKey, nestedValue]) => {
                                if (typeof nestedValue === 'object' && nestedValue !== null) {
                                    Object.entries(nestedValue).forEach(([opKey, opValue]) => {
                                        params.append(`${key}[${nestedKey}][${opKey}]`, String(opValue));
                                    });
                                }
                                else {
                                    params.append(`${key}[${nestedKey}]`, String(nestedValue));
                                }
                            });
                        }
                        else {
                            params.append(key, String(value));
                        }
                    }
                });
            }
            params.set('page', p.toString());
            params.set('limit', limit.toString());
            return `${baseUrl}?${params.toString()}`;
        };
        return {
            self: buildUrl(page),
            first: buildUrl(1),
            prev: page > 1 ? buildUrl(page - 1) : null,
            next: page < totalPages ? buildUrl(page + 1) : null,
            last: buildUrl(Math.max(totalPages, 1)),
        };
    }
    static withStatus(status, response) {
        return { status, body: response };
    }
    static isError(response) {
        return !response.success;
    }
    static fromPrismaError(error, path) {
        if (error && typeof error === 'object' && 'code' in error) {
            const prismaError = error;
            switch (prismaError.code) {
                case 'P2002':
                    return this.conflict('A record with this value already exists', { fields: prismaError.meta?.target }, path);
                case 'P2025':
                    return this.notFound('Record', undefined, path);
                case 'P2003':
                    return this.badRequest('Referenced record does not exist', { fields: prismaError.meta?.target }, path);
                default:
                    return this.internalError('Database operation failed', path);
            }
        }
        return this.internalError('An unexpected error occurred', path);
    }
}
export default ResponseFormatter;
