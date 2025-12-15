/**
 * @file Express Type Extensions
 * @description Extended Express types for authenticated requests and context
 *
 * This file extends the Express Request interface to include:
 * - User authentication data
 * - Request context (correlation ID, timing)
 * - File upload scan results
 *
 * @author AgroBridge Engineering Team
 */

import { Request } from 'express';

/**
 * User role type (matches Prisma UserRole enum)
 */
export type UserRole = 'ADMIN' | 'PRODUCER' | 'CONSUMER' | 'AUDITOR' | 'CERTIFIER' | 'BUYER';

/**
 * Authenticated user data attached to requests
 */
export interface AuthenticatedUser {
  /** User's unique identifier (UUID) */
  userId: string;
  /** User's email address */
  email: string;
  /** User's role in the system */
  role: UserRole;
  /** Producer ID if user is associated with a producer */
  producerId?: string;
  /** JWT token ID for blacklisting */
  jti?: string;
  /** Token expiration timestamp */
  exp?: number;
  /** User's subscription tier */
  subscriptionTier?: 'free' | 'basic' | 'premium' | 'enterprise';
}

/**
 * Request context for tracing and observability
 */
export interface RequestContext {
  /** Unique correlation ID for request tracing */
  correlationId: string;
  /** Unique request ID */
  requestId: string;
  /** Trace ID (alias for correlationId, for compatibility) */
  traceId?: string;
  /** Request start timestamp */
  startTime: number;
  /** Request path */
  path?: string;
  /** HTTP method */
  method?: string;
  /** Client IP address */
  ip?: string;
  /** User agent string */
  userAgent?: string;
  /** User ID (set after authentication) */
  userId?: string;
  /** User role (set after authentication) */
  userRole?: string;
}

/**
 * Virus scan result attached to uploaded files
 */
export interface FileScanResult {
  /** Whether the file is clean (no malware detected) */
  clean: boolean;
  /** Name of detected virus/malware if any */
  virus?: string;
  /** Error message if scan failed */
  error?: string;
  /** Timestamp of scan */
  scannedAt: Date;
  /** Scan duration in milliseconds */
  scanDurationMs: number;
  /** File size in bytes */
  fileSize: number;
  /** Original filename */
  fileName?: string;
}

/**
 * Extended Multer file with scan result
 */
export interface ScannedFile extends Express.Multer.File {
  /** Virus scan result */
  scanResult?: FileScanResult;
}

/**
 * Extended Express Request with authentication and context
 */
export interface AuthenticatedRequest extends Request {
  /** Authenticated user data (set by auth middleware) */
  user?: AuthenticatedUser;
  /** Request correlation ID */
  correlationId?: string;
  /** Request ID */
  requestId?: string;
  /** Full request context */
  context?: RequestContext;
  /** Uploaded file with scan result */
  file?: ScannedFile;
  /** Uploaded files with scan results */
  files?: ScannedFile[] | { [fieldname: string]: ScannedFile[] };
}

// Augment Express namespace
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      correlationId?: string;
      requestId?: string;
      context?: RequestContext;
    }

    namespace Multer {
      interface File {
        scanResult?: FileScanResult;
      }
    }
  }
}

export {};
