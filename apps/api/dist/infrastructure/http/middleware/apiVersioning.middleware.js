import logger from '../../../shared/utils/logger.js';
const VERSION_CONFIG = {
    default: '1',
    supported: ['1', '2'],
    deprecated: [],
};
export function apiVersioning(req, res, next) {
    const versionedReq = req;
    let version = null;
    const urlMatch = req.path.match(/^\/api\/v(\d+)\//);
    if (urlMatch) {
        version = urlMatch[1];
    }
    if (!version) {
        const acceptHeader = req.get('Accept');
        if (acceptHeader) {
            const headerMatch = acceptHeader.match(/vnd\.agrobridge\.v(\d+)/);
            if (headerMatch) {
                version = headerMatch[1];
            }
        }
    }
    if (!version) {
        const versionHeader = req.get('X-API-Version');
        if (versionHeader) {
            version = versionHeader;
        }
    }
    if (!version) {
        version = VERSION_CONFIG.default;
    }
    if (!VERSION_CONFIG.supported.includes(version)) {
        res.status(400).json({
            success: false,
            error: {
                code: 'UNSUPPORTED_API_VERSION',
                message: `API version ${version} is not supported. Supported versions: ${VERSION_CONFIG.supported.join(', ')}`,
                supportedVersions: VERSION_CONFIG.supported,
            },
        });
        return;
    }
    versionedReq.apiVersion = version;
    if (VERSION_CONFIG.deprecated?.includes(version)) {
        res.set('Deprecation', 'true');
        res.set('Sunset', 'Sat, 01 Jan 2026 00:00:00 GMT');
        res.set('X-API-Deprecation-Notice', `API version ${version} is deprecated. Please migrate to a newer version.`);
        logger.warn('[API] Deprecated version accessed', {
            version,
            path: req.path,
            ip: req.ip,
        });
    }
    res.set('X-API-Version', version);
    next();
}
export function requireVersion(version) {
    return (req, res, next) => {
        const versionedReq = req;
        if (versionedReq.apiVersion !== version) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_API_VERSION',
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
export function requireMinVersion(minVersion) {
    return (req, res, next) => {
        const versionedReq = req;
        const currentVersionNum = parseInt(versionedReq.apiVersion, 10);
        const minVersionNum = parseInt(minVersion, 10);
        if (currentVersionNum < minVersionNum) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'API_VERSION_TOO_LOW',
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
export function versionedHandler(handlers) {
    return (req, res, next) => {
        const versionedReq = req;
        const handler = handlers[versionedReq.apiVersion];
        if (!handler) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VERSION_NOT_SUPPORTED',
                    message: `This endpoint is not available in API version ${versionedReq.apiVersion}`,
                    availableVersions: Object.keys(handlers),
                },
            });
            return;
        }
        handler(req, res, next);
    };
}
export function getApiVersion(req) {
    return req.apiVersion || VERSION_CONFIG.default;
}
export function isVersion(req, version) {
    return getApiVersion(req) === version;
}
export function getSupportedVersions() {
    return [...VERSION_CONFIG.supported];
}
export function getDeprecatedVersions() {
    return VERSION_CONFIG.deprecated ? [...VERSION_CONFIG.deprecated] : [];
}
export default apiVersioning;
