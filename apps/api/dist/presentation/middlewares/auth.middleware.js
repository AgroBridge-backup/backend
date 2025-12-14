import jwt from 'jsonwebtoken';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { InsufficientPermissionsError } from '../../shared/errors/InsufficientPermissionsError.js';
import { TokenExpiredError } from '../../shared/errors/TokenExpiredError.js';
import { InvalidTokenError } from '../../shared/errors/InvalidTokenError.js';
import { redisClient } from '../../infrastructure/cache/RedisClient.js';
import logger from '../../shared/utils/logger.js';
import { AppError } from '../../shared/errors/AppError.js';
const publicKeyPath = process.env.JWT_PUBLIC_KEY_PATH || './jwtRS256.key.pub';
const resolvedPath = path.resolve(process.cwd(), publicKeyPath);
logger.debug(`[AuthMiddleware] Loading Public Key from: ${resolvedPath}`);
const JWT_PUBLIC_KEY = fs.readFileSync(resolvedPath, 'utf-8');
export const authenticate = (requiredRoles) => {
    return async (req, _res, next) => {
        logger.debug(`[AuthMiddleware] Authenticating request for: ${req.path}`);
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                throw new InvalidTokenError('Authorization header missing or malformed');
            }
            const token = authHeader.split(' ')[1];
            logger.debug(`[AuthMiddleware] Token received: ${token ? token.substring(0, 20) + '...' : 'none'}`);
            if (!token) {
                throw new InvalidTokenError('Token not found');
            }
            let payload;
            try {
                payload = jwt.verify(token, JWT_PUBLIC_KEY, { algorithms: ['RS256'] });
                logger.debug(`[AuthMiddleware] Token verified successfully for user: ${payload.sub}`);
            }
            catch (error) {
                logger.error(`[AuthMiddleware] Token verification failed: ${error.message}`);
                if (error instanceof jwt.TokenExpiredError) {
                    throw new TokenExpiredError();
                }
                throw new InvalidTokenError('Token verification failed');
            }
            const isBlacklisted = await redisClient.isBlacklisted(payload.jti);
            if (isBlacklisted) {
                throw new InvalidTokenError('Token has been revoked');
            }
            const rateLimitKey = `rate-limit:user:${payload.sub}`;
            const isOverLimit = !(await redisClient.checkRateLimit(rateLimitKey, 1000, 3600));
            if (isOverLimit) {
                throw new AppError('Rate limit exceeded', 429);
            }
            if (requiredRoles && requiredRoles.length > 0) {
                if (!requiredRoles.includes(payload.role)) {
                    throw new InsufficientPermissionsError();
                }
            }
            req.user = {
                userId: payload.sub,
                role: payload.role,
                email: payload.email,
                jti: payload.jti,
                exp: payload.exp,
                producerId: payload.producerId,
            };
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
