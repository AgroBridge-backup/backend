import jwt from 'jsonwebtoken';
import { redisClient } from '@/infrastructure/cache/RedisClient';
import { InvalidTokenError } from '@/shared/errors/InvalidTokenError';
import { TokenExpiredError } from '@/shared/errors/TokenExpiredError';
import { InsufficientPermissionsError } from '@/shared/errors/InsufficientPermissionsError';
import { AppError } from '@/shared/errors/AppError';
import fs from 'fs';
import path from 'path';
// Load JWT public key from file path specified in .env
const publicKeyPath = process.env.JWT_PUBLIC_KEY_PATH;
if (!publicKeyPath) {
    // This will crash the app on startup if the env var is missing, which is the desired behavior.
    throw new Error('FATAL: JWT_PUBLIC_KEY_PATH environment variable not set.');
}
// The path in .env is relative to the CWD from where the app is started (the `apps/api` directory)
const JWT_PUBLIC_KEY = fs.readFileSync(path.resolve(process.cwd(), publicKeyPath), 'utf-8');
export const authenticate = (requiredRoles) => {
    return async (req, _res, next) => {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                throw new InvalidTokenError('Authorization header missing or malformed');
            }
            const token = authHeader.split(' ')[1];
            if (!token) {
                throw new InvalidTokenError('Token not found');
            }
            // 1. Verify JWT with RS256 public key
            let payload;
            try {
                payload = jwt.verify(token, JWT_PUBLIC_KEY, { algorithms: ['RS256'] });
            }
            catch (error) {
                if (error instanceof jwt.TokenExpiredError) {
                    throw new TokenExpiredError();
                }
                throw new InvalidTokenError('Token verification failed');
            }
            // 2. Check Redis blacklist
            const isBlacklisted = await redisClient.isBlacklisted(payload.jti);
            if (isBlacklisted) {
                throw new InvalidTokenError('Token has been revoked');
            }
            // 3. Check rate limit (example: 1000 req/hour per user)
            const rateLimitKey = `rate-limit:user:${payload.sub}`;
            const isOverLimit = !(await redisClient.checkRateLimit(rateLimitKey, 1000, 3600));
            if (isOverLimit) {
                throw new AppError('Rate limit exceeded', 429);
            }
            // 4. Validate role permissions
            if (requiredRoles && requiredRoles.length > 0) {
                if (!requiredRoles.includes(payload.role)) {
                    throw new InsufficientPermissionsError();
                }
            }
            // 5. Attach user to req.user
            req.user = {
                userId: payload.sub,
                role: payload.role,
                email: payload.email,
                jti: payload.jti,
                exp: payload.exp,
            };
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
//# sourceMappingURL=auth.middleware.js.map