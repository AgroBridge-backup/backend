/**
 * @file Admin Authentication Middleware
 * @description Protects admin-only routes with authentication and authorization
 *
 * Features:
 * - JWT token validation for admin routes
 * - Role-based access control (ADMIN only)
 * - IP allowlist for sensitive operations
 * - Basic auth fallback for queue dashboards
 * - Audit logging for admin access
 *
 * @author AgroBridge Engineering Team
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import * as fs from "node:fs";
import * as path from "node:path";
import logger from "../../../shared/utils/logger.js";
import {
  ErrorCode,
  getErrorMessage,
  getErrorStatus,
} from "../../../shared/errors/error-codes.js";
import type {
  AuthenticatedUser,
  UserRole,
} from "../../../shared/types/express.js";

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/** Admin basic auth credentials (for queue dashboards) */
const ADMIN_USERNAME = process.env.ADMIN_DASHBOARD_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_DASHBOARD_PASSWORD;

/** IP allowlist for admin access (comma-separated) */
const ADMIN_IP_ALLOWLIST =
  process.env.ADMIN_IP_ALLOWLIST?.split(",").map((ip) => ip.trim()) || [];

/** Whether to enforce IP allowlist */
const ENFORCE_IP_ALLOWLIST = process.env.ADMIN_ENFORCE_IP_ALLOWLIST === "true";

/** JWT public key for token verification */
let JWT_PUBLIC_KEY: string | null = null;

/**
 * Load JWT public key for token verification
 */
function getJwtPublicKey(): string {
  if (JWT_PUBLIC_KEY) {
    return JWT_PUBLIC_KEY;
  }

  const publicKeyPath = process.env.JWT_PUBLIC_KEY_PATH || "./jwtRS256.key.pub";
  const resolvedPath = path.resolve(process.cwd(), publicKeyPath);

  try {
    JWT_PUBLIC_KEY = fs.readFileSync(resolvedPath, "utf-8");
    return JWT_PUBLIC_KEY;
  } catch (error) {
    logger.error("[AdminAuth] Failed to load JWT public key", {
      path: resolvedPath,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw new Error(`JWT public key not found at ${resolvedPath}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// JWT TOKEN PAYLOAD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * JWT payload structure
 */
interface JWTPayload {
  sub: string;
  email: string;
  role: string;
  jti: string;
  exp: number;
  producerId?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if client IP is in allowlist
 */
function isIpAllowed(req: Request): boolean {
  if (!ENFORCE_IP_ALLOWLIST || ADMIN_IP_ALLOWLIST.length === 0) {
    return true;
  }

  const clientIp = req.ip || req.socket?.remoteAddress || "";

  // Handle IPv6 localhost
  const normalizedIp =
    clientIp === "::1" ? "127.0.0.1" : clientIp.replace(/^::ffff:/, "");

  const allowed =
    ADMIN_IP_ALLOWLIST.includes(normalizedIp) ||
    ADMIN_IP_ALLOWLIST.includes("*");

  if (!allowed) {
    logger.warn("[AdminAuth] SECURITY: IP not in allowlist", {
      clientIp: normalizedIp,
      allowlist: ADMIN_IP_ALLOWLIST,
    });
  }

  return allowed;
}

/**
 * Verify JWT token and extract user info
 */
function verifyToken(token: string): AuthenticatedUser | null {
  try {
    const publicKey = getJwtPublicKey();
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ["RS256"],
    }) as JWTPayload;

    return {
      userId: decoded.sub,
      email: decoded.email,
      role: decoded.role as AuthenticatedUser["role"],
      jti: decoded.jti,
      exp: decoded.exp,
      producerId: decoded.producerId,
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.debug("[AdminAuth] Token expired");
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.debug("[AdminAuth] Invalid token");
    }
    return null;
  }
}

/**
 * Parse basic auth header
 */
function parseBasicAuth(
  authHeader: string,
): { username: string; password: string } | null {
  if (!authHeader.startsWith("Basic ")) {
    return null;
  }

  try {
    const base64Credentials = authHeader.slice(6);
    const credentials = Buffer.from(base64Credentials, "base64").toString(
      "utf-8",
    );
    const [username, password] = credentials.split(":");
    return { username, password };
  } catch {
    return null;
  }
}

/**
 * JWT-based admin authentication middleware
 *
 * Validates JWT token and ensures user has ADMIN role.
 * Use this for API endpoints.
 *
 * @example
 * router.get('/admin/users', adminAuthMiddleware, async (req, res) => {
 *   // req.user is guaranteed to be an admin
 * });
 */
export function adminAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Check IP allowlist first
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

  // Extract token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
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

  // Check admin role
  if (user.role !== "ADMIN") {
    logger.warn("[AdminAuth] SECURITY: Non-admin access attempt", {
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

  // Attach user to request
  req.user = user;

  logger.info("[AdminAuth] Admin access granted", {
    userId: user.userId,
    email: user.email,
    path: req.path,
    method: req.method,
  });

  next();
}

/**
 * Basic auth middleware for dashboard access
 *
 * Provides basic authentication for admin dashboards (Bull Board, etc.)
 * Prompts browser for credentials if not provided.
 *
 * @example
 * app.use('/admin/queues', basicAuthMiddleware, bullBoardRouter);
 */
export function basicAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Check IP allowlist first
  if (!isIpAllowed(req)) {
    res.status(403).send("Access denied");
    return;
  }

  // Skip auth in development if no password set
  if (process.env.NODE_ENV === "development" && !ADMIN_PASSWORD) {
    logger.warn("[AdminAuth] Dashboard accessed without auth in development");
    next();
    return;
  }

  // Require password in production
  if (!ADMIN_PASSWORD) {
    logger.error("[AdminAuth] ADMIN_DASHBOARD_PASSWORD not set");
    res.status(500).send("Admin dashboard not configured");
    return;
  }

  const authHeader = req.headers.authorization;

  // No auth header - request credentials
  if (!authHeader) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Admin Dashboard"');
    res.status(401).send("Authentication required");
    return;
  }

  // Parse and validate credentials
  const credentials = parseBasicAuth(authHeader);

  if (!credentials) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Admin Dashboard"');
    res.status(401).send("Invalid authentication format");
    return;
  }

  // Timing-safe comparison
  const usernameMatch = credentials.username === ADMIN_USERNAME;
  const passwordMatch = credentials.password === ADMIN_PASSWORD;

  if (!usernameMatch || !passwordMatch) {
    logger.warn("[AdminAuth] SECURITY: Failed dashboard login attempt", {
      username: credentials.username,
      ip: req.ip,
    });

    res.setHeader("WWW-Authenticate", 'Basic realm="Admin Dashboard"');
    res.status(401).send("Invalid credentials");
    return;
  }

  logger.info("[AdminAuth] Dashboard access granted", {
    username: credentials.username,
    path: req.path,
  });

  next();
}

/**
 * Combined admin middleware with fallback
 *
 * Tries JWT auth first, falls back to basic auth.
 * Useful for endpoints that need to support both API and browser access.
 */
export function adminAuthWithFallback(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;

  // If Bearer token, use JWT auth
  if (authHeader?.startsWith("Bearer ")) {
    return adminAuthMiddleware(req, res, next);
  }

  // If Basic auth or no auth, use basic auth
  return basicAuthMiddleware(req, res, next);
}

/**
 * Role-based access control middleware factory
 *
 * Creates middleware that requires specific roles.
 *
 * @example
 * router.get('/reports', requireRole('ADMIN', 'AUDITOR'), getReports);
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
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
      logger.warn("[AdminAuth] SECURITY: Insufficient role", {
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
