/**
 * Input Sanitization Middleware
 * Protection against XSS, SQL Injection, NoSQL Injection, and more
 */

import { Request, Response, NextFunction } from 'express';
import sanitizeHtml from 'sanitize-html';
import validator from 'validator';
import hpp from 'hpp';
import { logger } from '../logging/logger.js';

/**
 * Sanitization options
 */
interface SanitizeOptions {
  allowHtml?: boolean;
  allowedTags?: string[];
  maxLength?: number;
  trimWhitespace?: boolean;
}

const defaultOptions: SanitizeOptions = {
  allowHtml: false,
  allowedTags: [],
  maxLength: 10000,
  trimWhitespace: true,
};

/**
 * Dangerous patterns for SQL injection detection (using 'i' flag only)
 */
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/i,
  /(-{2}|;|\/\*|\*\/)/,
  /((\%27)|('))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
  /(\b(AND|OR)\b\s+\d+\s*=\s*\d+)/i,
  /(\b(AND|OR)\b\s+['"][^'"]+['"]\s*=\s*['"][^'"]+['"])/i,
  // Additional patterns for common SQL injection attempts
  /'\s*(OR|AND)\s*'/i,  // ' OR ' or ' AND '
  /'\s*=\s*'/i,         // '=' pattern
];

/**
 * Dangerous patterns for NoSQL injection detection (using 'i' flag only)
 */
const NOSQL_INJECTION_PATTERNS = [
  /\$where/i,
  /\$gt/i,
  /\$lt/i,
  /\$ne/i,
  /\$regex/i,
  /\$or/i,
  /\$and/i,
  /\$nor/i,
  /\$not/i,
  /\$exists/i,
  /\$type/i,
  /\$expr/i,
  /\$jsonSchema/i,
];

/**
 * Dangerous patterns for command injection
 */
const COMMAND_INJECTION_PATTERNS = [
  /[;&|`$(){}[\]<>]/g,
  /\$\(/g,
  /`.*`/g,
];

/**
 * XSS patterns (using 'i' flag only, not 'g' to avoid lastIndex issues with .test())
 */
const XSS_PATTERNS = [
  /<script[^>]*>[\s\S]*?<\/script>/i,
  /javascript:/i,
  /on\w+\s*=/i,
  /data:/i,
  /vbscript:/i,
  /expression\s*\(/i,
];

/**
 * Check for SQL injection attempts
 */
export function detectSqlInjection(value: string): boolean {
  return SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Check for NoSQL injection attempts
 */
export function detectNoSqlInjection(value: unknown): boolean {
  if (typeof value === 'string') {
    return NOSQL_INJECTION_PATTERNS.some((pattern) => pattern.test(value));
  }
  if (typeof value === 'object' && value !== null) {
    const keys = Object.keys(value);
    return keys.some((key) => key.startsWith('$'));
  }
  return false;
}

/**
 * Check for command injection attempts
 */
export function detectCommandInjection(value: string): boolean {
  return COMMAND_INJECTION_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Check for XSS attempts
 */
export function detectXss(value: string): boolean {
  return XSS_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Sanitize string value
 */
export function sanitizeString(
  value: string,
  options: SanitizeOptions = defaultOptions
): string {
  let sanitized = value;

  // Trim whitespace
  if (options.trimWhitespace) {
    sanitized = sanitized.trim();
  }

  // Enforce max length
  if (options.maxLength && sanitized.length > options.maxLength) {
    sanitized = sanitized.substring(0, options.maxLength);
  }

  // HTML sanitization
  if (!options.allowHtml) {
    sanitized = sanitizeHtml(sanitized, {
      allowedTags: options.allowedTags || [],
      allowedAttributes: {},
      disallowedTagsMode: 'discard',
    });
  } else if (options.allowedTags && options.allowedTags.length > 0) {
    sanitized = sanitizeHtml(sanitized, {
      allowedTags: options.allowedTags,
      allowedAttributes: {
        a: ['href', 'name', 'target', 'rel'],
        img: ['src', 'alt', 'width', 'height'],
      },
    });
  }

  // Escape special characters
  sanitized = validator.escape(sanitized);

  return sanitized;
}

/**
 * Recursively sanitize object
 */
export function sanitizeObject(
  obj: Record<string, unknown>,
  options: SanitizeOptions = defaultOptions
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Skip dangerous keys
    if (key.startsWith('$') || key.includes('__')) {
      logger.warn('Dangerous key detected and removed', { key });
      continue;
    }

    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value, options);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) => {
        if (typeof item === 'string') {
          return sanitizeString(item, options);
        }
        if (typeof item === 'object' && item !== null) {
          return sanitizeObject(item as Record<string, unknown>, options);
        }
        return item;
      });
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>, options);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Input sanitizer middleware
 */
export function inputSanitizer(
  options: SanitizeOptions = defaultOptions
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Sanitize body
      if (req.body && typeof req.body === 'object') {
        // Check for NoSQL injection in body
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

      // Sanitize query parameters
      if (req.query && typeof req.query === 'object') {
        const sanitizedQuery: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(req.query)) {
          if (typeof value === 'string') {
            // Check for SQL injection in query params
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
          } else {
            sanitizedQuery[key] = value;
          }
        }
        req.query = sanitizedQuery as any;
      }

      // Sanitize params
      if (req.params && typeof req.params === 'object') {
        const sanitizedParams: Record<string, string> = {};
        for (const [key, value] of Object.entries(req.params)) {
          if (typeof value === 'string') {
            sanitizedParams[key] = validator.escape(value.trim());
          }
        }
        req.params = sanitizedParams;
      }

      next();
    } catch (error) {
      logger.error('Input sanitization error', { error });
      next(error);
    }
  };
}

/**
 * Deep check for NoSQL injection
 */
function detectNoSqlInjectionDeep(obj: unknown, depth = 0): boolean {
  if (depth > 10) return false; // Prevent infinite recursion

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

/**
 * XSS protection middleware
 */
export function xssProtection(): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Check body for XSS
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

    // Check query params for XSS
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

/**
 * HTTP Parameter Pollution protection
 */
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

/**
 * Validate and sanitize email
 */
export function sanitizeEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  if (!validator.isEmail(trimmed)) {
    return null;
  }
  return validator.normalizeEmail(trimmed) || null;
}

/**
 * Validate and sanitize URL
 */
export function sanitizeUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!validator.isURL(trimmed, { require_protocol: true, protocols: ['http', 'https'] })) {
    return null;
  }
  return trimmed;
}

/**
 * Validate UUID
 */
export function isValidUuid(value: string): boolean {
  return validator.isUUID(value);
}

/**
 * Sanitize filename
 */
export function sanitizeFilename(filename: string): string {
  // Remove path traversal attempts
  let sanitized = filename.replace(/[\/\\]/g, '');
  // Remove dangerous characters
  sanitized = sanitized.replace(/[<>:"|?*\x00-\x1f]/g, '');
  // Remove leading/trailing dots and spaces
  sanitized = sanitized.replace(/^[\s.]+|[\s.]+$/g, '');
  // Limit length
  if (sanitized.length > 255) {
    const ext = sanitized.split('.').pop() || '';
    const name = sanitized.substring(0, 255 - ext.length - 1);
    sanitized = `${name}.${ext}`;
  }
  return sanitized || 'unnamed';
}

/**
 * Validate phone number
 */
export function sanitizePhone(phone: string): string | null {
  const cleaned = phone.replace(/[^0-9+]/g, '');
  if (cleaned.length < 10 || cleaned.length > 15) {
    return null;
  }
  return cleaned;
}

/**
 * Sanitize JSON path (prevent prototype pollution)
 */
export function sanitizeJsonPath(path: string): string | null {
  const dangerous = ['__proto__', 'constructor', 'prototype'];
  const parts = path.split('.');
  if (parts.some((part) => dangerous.includes(part.toLowerCase()))) {
    return null;
  }
  return path;
}

/**
 * Content type validation middleware
 */
export function validateContentType(
  allowedTypes: string[]
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
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

      const isAllowed = allowedTypes.some((type) =>
        contentType.toLowerCase().includes(type.toLowerCase())
      );

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
