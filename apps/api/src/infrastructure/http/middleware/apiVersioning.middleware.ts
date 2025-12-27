/**
 * @file API Versioning Middleware
 * @description Middleware to handle API versioning via URL path or Accept header
 *
 * Supports:
 * - URL versioning: /api/v1/batches, /api/v2/batches
 * - Accept header versioning: Accept: application/vnd.agrobridge.v2+json
 *
 * @author AgroBridge Engineering Team
 */

import { Request, Response, NextFunction } from "express";
import logger from "../../../shared/utils/logger.js";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * API versions supported
 */
export type ApiVersion = "1" | "2";

/**
 * Extended request with API version
 */
export interface VersionedRequest extends Request {
  apiVersion: ApiVersion;
}

/**
 * Version configuration
 */
interface VersionConfig {
  default: ApiVersion;
  supported: ApiVersion[];
  deprecated?: ApiVersion[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const VERSION_CONFIG: VersionConfig = {
  default: "1",
  supported: ["1", "2"],
  deprecated: [],
};

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract API version from request
 *
 * Priority:
 * 1. URL path: /api/v2/batches
 * 2. Accept header: application/vnd.agrobridge.v2+json
 * 3. X-API-Version header
 * 4. Default version
 */
export function apiVersioning(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const versionedReq = req as VersionedRequest;
  let version: ApiVersion | null = null;

  // 1. Extract from URL: /api/v1/... or /api/v2/...
  const urlMatch = req.path.match(/^\/api\/v(\d+)\//);
  if (urlMatch) {
    version = urlMatch[1] as ApiVersion;
  }

  // 2. Extract from Accept header: application/vnd.agrobridge.v2+json
  if (!version) {
    const acceptHeader = req.get("Accept");
    if (acceptHeader) {
      const headerMatch = acceptHeader.match(/vnd\.agrobridge\.v(\d+)/);
      if (headerMatch) {
        version = headerMatch[1] as ApiVersion;
      }
    }
  }

  // 3. Extract from X-API-Version header
  if (!version) {
    const versionHeader = req.get("X-API-Version");
    if (versionHeader) {
      version = versionHeader as ApiVersion;
    }
  }

  // 4. Use default
  if (!version) {
    version = VERSION_CONFIG.default;
  }

  // Validate version
  if (!VERSION_CONFIG.supported.includes(version)) {
    res.status(400).json({
      success: false,
      error: {
        code: "UNSUPPORTED_API_VERSION",
        message: `API version ${version} is not supported. Supported versions: ${VERSION_CONFIG.supported.join(", ")}`,
        supportedVersions: VERSION_CONFIG.supported,
      },
    });
    return;
  }

  // Set version on request
  versionedReq.apiVersion = version;

  // Add deprecation warning header if applicable
  if (VERSION_CONFIG.deprecated?.includes(version)) {
    res.set("Deprecation", "true");
    res.set("Sunset", "Sat, 01 Jan 2026 00:00:00 GMT");
    res.set(
      "X-API-Deprecation-Notice",
      `API version ${version} is deprecated. Please migrate to a newer version.`,
    );

    logger.warn("[API] Deprecated version accessed", {
      version,
      path: req.path,
      ip: req.ip,
    });
  }

  // Add version header to response
  res.set("X-API-Version", version);

  next();
}

/**
 * Require specific API version
 *
 * @example
 * router.get('/new-feature', requireVersion('2'), handler);
 */
export function requireVersion(version: ApiVersion) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const versionedReq = req as VersionedRequest;

    if (versionedReq.apiVersion !== version) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_API_VERSION",
          message: `This endpoint requires API version ${version}`,
          requiredVersion: version,
          currentVersion: versionedReq.apiVersion,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Require minimum API version
 *
 * @example
 * router.get('/feature', requireMinVersion('2'), handler);
 */
export function requireMinVersion(minVersion: ApiVersion) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const versionedReq = req as VersionedRequest;
    const currentVersionNum = parseInt(versionedReq.apiVersion, 10);
    const minVersionNum = parseInt(minVersion, 10);

    if (currentVersionNum < minVersionNum) {
      res.status(400).json({
        success: false,
        error: {
          code: "API_VERSION_TOO_LOW",
          message: `This endpoint requires API version ${minVersion} or higher`,
          minimumVersion: minVersion,
          currentVersion: versionedReq.apiVersion,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Version-specific handler selector
 *
 * @example
 * router.get('/batches', versionedHandler({
 *   '1': v1Handler,
 *   '2': v2Handler,
 * }));
 */
export function versionedHandler(
  handlers: Partial<
    Record<
      ApiVersion,
      (req: Request, res: Response, next: NextFunction) => void
    >
  >,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const versionedReq = req as VersionedRequest;
    const handler = handlers[versionedReq.apiVersion];

    if (!handler) {
      res.status(400).json({
        success: false,
        error: {
          code: "VERSION_NOT_SUPPORTED",
          message: `This endpoint is not available in API version ${versionedReq.apiVersion}`,
          availableVersions: Object.keys(handlers),
        },
      });
      return;
    }

    handler(req, res, next);
  };
}

/**
 * Get current API version from request
 */
export function getApiVersion(req: Request): ApiVersion {
  return (req as VersionedRequest).apiVersion || VERSION_CONFIG.default;
}

/**
 * Check if request is using specific version
 */
export function isVersion(req: Request, version: ApiVersion): boolean {
  return getApiVersion(req) === version;
}

/**
 * Get supported API versions
 */
export function getSupportedVersions(): ApiVersion[] {
  return [...VERSION_CONFIG.supported];
}

/**
 * Get deprecated API versions
 */
export function getDeprecatedVersions(): ApiVersion[] {
  return VERSION_CONFIG.deprecated ? [...VERSION_CONFIG.deprecated] : [];
}

export default apiVersioning;
