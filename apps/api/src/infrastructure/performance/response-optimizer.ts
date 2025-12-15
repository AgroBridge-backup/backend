/**
 * Response Optimizer
 * Compression, ETags, field selection, and response optimization
 */

import { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import crypto from 'crypto';
import { logger } from '../logging/logger.js';

/**
 * Compression middleware configuration
 */
export const compressionMiddleware = compression({
  level: 6, // Balance between speed and compression ratio
  threshold: 1024, // Only compress responses larger than 1KB
  filter: (req: Request, res: Response) => {
    // Don't compress if client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }

    // Use default filter (checks Accept-Encoding)
    return compression.filter(req, res);
  },
});

/**
 * Generate ETag for response body
 */
export function generateETag(body: unknown): string {
  const content = typeof body === 'string' ? body : JSON.stringify(body);
  const hash = crypto.createHash('md5').update(content).digest('hex');
  return `"${hash}"`;
}

/**
 * Weak ETag generator (for semantic equivalence)
 */
export function generateWeakETag(body: unknown, version?: string): string {
  const content = typeof body === 'string' ? body : JSON.stringify(body);
  const hash = crypto.createHash('md5').update(content).digest('hex').substring(0, 16);
  return `W/"${version || 'v1'}-${hash}"`;
}

/**
 * ETag middleware
 */
export function etagMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Only for GET and HEAD requests
    if (!['GET', 'HEAD'].includes(req.method)) {
      next();
      return;
    }

    const originalJson = res.json.bind(res);

    res.json = function (body: unknown): Response {
      const etag = generateETag(body);
      res.setHeader('ETag', etag);

      // Check If-None-Match header
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

/**
 * Field selection - filter response to only include requested fields
 */
export function selectFields<T extends Record<string, unknown>>(
  data: T,
  fields: string[]
): Partial<T> {
  if (fields.length === 0) return data;

  const result: Partial<T> = {};
  for (const field of fields) {
    if (field.includes('.')) {
      // Handle nested fields
      const [parent, ...rest] = field.split('.');
      if (parent in data) {
        const nestedPath = rest.join('.');
        const parentValue = data[parent];
        if (typeof parentValue === 'object' && parentValue !== null) {
          (result as any)[parent] = {
            ...(result as any)[parent],
            ...selectFields(parentValue as Record<string, unknown>, [nestedPath]),
          };
        }
      }
    } else if (field in data) {
      (result as any)[field] = data[field];
    }
  }

  // Always include id if present
  if ('id' in data && !('id' in result)) {
    (result as any).id = data.id;
  }

  return result;
}

/**
 * Field selection middleware
 */
export function fieldSelectionMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const fieldsParam = req.query.fields as string;

    if (!fieldsParam) {
      next();
      return;
    }

    const requestedFields = fieldsParam.split(',').map((f) => f.trim());
    const originalJson = res.json.bind(res);

    res.json = function (body: unknown): Response {
      if (body && typeof body === 'object') {
        if (Array.isArray(body)) {
          body = body.map((item) =>
            typeof item === 'object' && item !== null
              ? selectFields(item as Record<string, unknown>, requestedFields)
              : item
          );
        } else if ('data' in (body as any)) {
          // Handle standard response format { success, data, ... }
          const response = body as Record<string, unknown>;
          if (Array.isArray(response.data)) {
            response.data = response.data.map((item) =>
              typeof item === 'object' && item !== null
                ? selectFields(item as Record<string, unknown>, requestedFields)
                : item
            );
          } else if (typeof response.data === 'object' && response.data !== null) {
            response.data = selectFields(response.data as Record<string, unknown>, requestedFields);
          }
          body = response;
        } else {
          body = selectFields(body as Record<string, unknown>, requestedFields);
        }
      }

      return originalJson(body);
    };

    next();
  };
}

/**
 * Response time header middleware
 */
export function responseTimeMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = process.hrtime.bigint();

    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const durationNs = endTime - startTime;
      const durationMs = Number(durationNs) / 1_000_000;

      res.setHeader('X-Response-Time', `${durationMs.toFixed(2)}ms`);

      // Log slow responses
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

/**
 * Cache control middleware
 */
export interface CacheOptions {
  maxAge?: number; // Seconds
  sMaxAge?: number; // Shared cache max age
  staleWhileRevalidate?: number;
  staleIfError?: number;
  private?: boolean;
  noStore?: boolean;
  noCache?: boolean;
  mustRevalidate?: boolean;
  immutable?: boolean;
}

export function cacheControl(options: CacheOptions): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const directives: string[] = [];

    if (options.noStore) {
      directives.push('no-store');
    } else if (options.noCache) {
      directives.push('no-cache');
    } else {
      if (options.private) {
        directives.push('private');
      } else {
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

/**
 * Pre-defined cache control policies
 */
export const cacheControlPolicies = {
  // No caching for dynamic/sensitive content
  noCache: cacheControl({ noStore: true }),

  // Short cache for frequently changing data
  short: cacheControl({
    maxAge: 60,
    staleWhileRevalidate: 30,
  }),

  // Medium cache for semi-static content
  medium: cacheControl({
    maxAge: 300,
    sMaxAge: 600,
    staleWhileRevalidate: 60,
  }),

  // Long cache for static content
  long: cacheControl({
    maxAge: 86400,
    sMaxAge: 604800,
    staleWhileRevalidate: 86400,
    immutable: true,
  }),

  // Private cache for user-specific data
  private: cacheControl({
    private: true,
    maxAge: 60,
    mustRevalidate: true,
  }),
};

/**
 * Response envelope wrapper
 */
export interface ResponseEnvelope<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
  links?: {
    self?: string;
    first?: string;
    prev?: string;
    next?: string;
    last?: string;
  };
  timestamp: string;
  requestId?: string;
}

/**
 * Create success response
 */
export function successResponse<T>(
  data: T,
  meta?: ResponseEnvelope<T>['meta'],
  links?: ResponseEnvelope<T>['links']
): ResponseEnvelope<T> {
  return {
    success: true,
    data,
    meta,
    links,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create error response
 */
export function errorResponse(
  code: string,
  message: string,
  details?: unknown
): ResponseEnvelope<never> {
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

/**
 * Response envelope middleware
 */
export function responseEnvelopeMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const originalJson = res.json.bind(res);

    res.json = function (body: unknown): Response {
      // Skip if already enveloped
      if (body && typeof body === 'object' && 'success' in (body as object)) {
        // Add request ID if available
        const requestId = req.headers['x-request-id'] as string;
        if (requestId) {
          (body as any).requestId = requestId;
        }
        return originalJson(body);
      }

      // Wrap response
      const envelope: ResponseEnvelope<unknown> = {
        success: res.statusCode < 400,
        data: body,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string,
      };

      return originalJson(envelope);
    };

    next();
  };
}

/**
 * JSON streaming for large responses
 */
export function streamJsonArray<T>(
  res: Response,
  items: AsyncIterable<T> | T[]
): Promise<void> {
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
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Content negotiation helper
 */
export function negotiateContent(req: Request): 'json' | 'xml' | 'csv' {
  const accept = req.headers.accept || 'application/json';

  if (accept.includes('application/xml') || accept.includes('text/xml')) {
    return 'xml';
  }

  if (accept.includes('text/csv')) {
    return 'csv';
  }

  return 'json';
}

/**
 * Response size limiter
 */
export function responseSizeLimiter(maxSizeBytes: number = 10 * 1024 * 1024): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const originalJson = res.json.bind(res);

    res.json = function (body: unknown): Response {
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

/**
 * CORS headers helper
 */
export function setCorsHeaders(
  res: Response,
  origin: string,
  methods: string[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
): void {
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
