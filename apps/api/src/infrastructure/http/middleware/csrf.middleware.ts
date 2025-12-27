/**
 * @file CSRF Protection Middleware
 * @description Double-submit cookie pattern for CSRF protection
 *
 * For JWT-based APIs using Authorization headers, CSRF is less of a concern
 * because the token must be explicitly sent. However, this middleware provides
 * protection for:
 * - OAuth callback flows that may use cookies
 * - Any endpoints that accept cookies for authentication
 * - State-changing operations via forms
 *
 * @author AgroBridge Engineering Team
 */

import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import logger from "../../../shared/utils/logger.js";

// CSRF token configuration
const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_TOKEN_TTL = 3600000; // 1 hour in milliseconds

/**
 * In-memory token store with expiration (use Redis in production cluster)
 */
interface CSRFTokenEntry {
  token: string;
  createdAt: number;
  userId?: string;
}

const tokenStore = new Map<string, CSRFTokenEntry>();

// Cleanup expired tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, entry] of tokenStore.entries()) {
    if (now - entry.createdAt > CSRF_TOKEN_TTL) {
      tokenStore.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.debug("[CSRF] Cleaned expired tokens", { count: cleaned });
  }
}, 300000);

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString("hex");
}

/**
 * CSRF Protection Middleware
 *
 * Implements double-submit cookie pattern:
 * 1. Server sets a CSRF token in a cookie
 * 2. Client must send the same token in a header
 * 3. Server validates both match
 *
 * Safe methods (GET, HEAD, OPTIONS) are exempt
 */
export function csrfProtection(
  options: {
    excludePaths?: string[];
    excludePatterns?: RegExp[];
    cookieOptions?: {
      secure?: boolean;
      sameSite?: "strict" | "lax" | "none";
      httpOnly?: boolean;
    };
  } = {},
) {
  const {
    excludePaths = [],
    excludePatterns = [],
    cookieOptions = {},
  } = options;

  // Default safe paths (webhooks, health checks, public APIs)
  const defaultExcludePaths = [
    "/health",
    "/api/v1/public",
    "/api/v2/public",
    "/webhooks",
  ];

  const allExcludePaths = [...defaultExcludePaths, ...excludePaths];

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip safe HTTP methods
    const safeMethods = ["GET", "HEAD", "OPTIONS"];
    if (safeMethods.includes(req.method)) {
      // Generate and set token for subsequent requests
      ensureCSRFToken(req, res, cookieOptions);
      return next();
    }

    // Check if path is excluded
    const isExcluded =
      allExcludePaths.some((path) => req.path.startsWith(path)) ||
      excludePatterns.some((pattern) => pattern.test(req.path));

    if (isExcluded) {
      return next();
    }

    // For APIs using Bearer tokens (Authorization header), CSRF is not needed
    // The token cannot be automatically sent by the browser
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return next();
    }

    // Validate CSRF token for cookie-based requests
    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
    const headerToken = req.headers[CSRF_HEADER_NAME] as string;

    if (!cookieToken || !headerToken) {
      logger.warn("[CSRF] Missing token", {
        path: req.path,
        method: req.method,
        hasCookie: !!cookieToken,
        hasHeader: !!headerToken,
        ip: req.ip,
      });
      res.status(403).json({
        error: {
          code: "CSRF_TOKEN_MISSING",
          message: "CSRF token is required for this request",
        },
      });
      return;
    }

    // Validate tokens match (timing-safe comparison)
    if (!timingSafeEqual(cookieToken, headerToken)) {
      logger.warn("[CSRF] Token mismatch", {
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      res.status(403).json({
        error: {
          code: "CSRF_TOKEN_INVALID",
          message: "Invalid CSRF token",
        },
      });
      return;
    }

    // Validate token exists in store and hasn't expired
    const storedEntry = tokenStore.get(cookieToken);
    if (!storedEntry || Date.now() - storedEntry.createdAt > CSRF_TOKEN_TTL) {
      logger.warn("[CSRF] Token expired or not found", {
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      res.status(403).json({
        error: {
          code: "CSRF_TOKEN_EXPIRED",
          message: "CSRF token has expired. Please refresh and try again.",
        },
      });
      return;
    }

    // Token valid - generate new token for next request (token rotation)
    ensureCSRFToken(req, res, cookieOptions);
    next();
  };
}

/**
 * Ensure a CSRF token exists and set it in cookies
 */
function ensureCSRFToken(
  req: Request,
  res: Response,
  cookieOptions: {
    secure?: boolean;
    sameSite?: "strict" | "lax" | "none";
    httpOnly?: boolean;
  },
): void {
  const existingToken = req.cookies?.[CSRF_COOKIE_NAME];

  // Check if existing token is still valid
  if (existingToken && tokenStore.has(existingToken)) {
    const entry = tokenStore.get(existingToken)!;
    if (Date.now() - entry.createdAt < CSRF_TOKEN_TTL / 2) {
      // Token still has more than half its lifetime - reuse it
      return;
    }
  }

  // Generate new token
  const newToken = generateCSRFToken();
  const userId = req.user?.id || req.user?.userId;

  tokenStore.set(newToken, {
    token: newToken,
    createdAt: Date.now(),
    userId,
  });

  // Set cookie with secure defaults
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie(CSRF_COOKIE_NAME, newToken, {
    httpOnly: cookieOptions.httpOnly ?? false, // Must be readable by JS for header submission
    secure: cookieOptions.secure ?? isProduction,
    sameSite: cookieOptions.sameSite ?? "strict",
    maxAge: CSRF_TOKEN_TTL,
    path: "/",
  });

  // Also expose token in response header for SPA convenience
  res.setHeader("X-CSRF-Token", newToken);
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Middleware to get CSRF token for initial page load
 * Useful for SPAs that need to fetch the token
 */
export function csrfTokenEndpoint(req: Request, res: Response): void {
  const token = generateCSRFToken();
  const userId = req.user?.id || req.user?.userId;

  tokenStore.set(token, {
    token,
    createdAt: Date.now(),
    userId,
  });

  const isProduction = process.env.NODE_ENV === "production";
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: isProduction,
    sameSite: "strict",
    maxAge: CSRF_TOKEN_TTL,
    path: "/",
  });

  res.json({
    csrfToken: token,
    expiresIn: CSRF_TOKEN_TTL,
  });
}

/**
 * Clear CSRF token (for logout)
 */
export function clearCSRFToken(req: Request, res: Response): void {
  const token = req.cookies?.[CSRF_COOKIE_NAME];
  if (token) {
    tokenStore.delete(token);
  }
  res.clearCookie(CSRF_COOKIE_NAME);
}

export default csrfProtection;
