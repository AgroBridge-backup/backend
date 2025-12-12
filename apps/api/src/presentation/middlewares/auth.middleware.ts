import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { UnauthorizedError } from '../../shared/errors/UnauthorizedError.js';
import { InsufficientPermissionsError } from '../../shared/errors/InsufficientPermissionsError.js';
import { TokenExpiredError } from '../../shared/errors/TokenExpiredError.js';
import { InvalidTokenError } from '../../shared/errors/InvalidTokenError.js';
import { redisClient } from '../../infrastructure/cache/RedisClient.js';
import logger from '../../shared/utils/logger.js';
import { AppError } from '../../shared/errors/AppError.js';
import { UserRole } from '@prisma/client';

const publicKeyPath = process.env.JWT_PUBLIC_KEY_PATH || './jwtRS256.key.pub';
const resolvedPath = path.resolve(process.cwd(), publicKeyPath);
logger.debug(`[AuthMiddleware] Loading Public Key from: ${resolvedPath}`);
// Crash if key is missing - security first
const JWT_PUBLIC_KEY = fs.readFileSync(resolvedPath, 'utf-8');

interface JwtPayload {
  sub: string;
  role: UserRole;
  email: string;
  jti: string;
  exp: number;
  producerId?: string;
}

import { AppError } from '../../shared/errors/AppError.js';

// Interface AuthenticatedRequest removed in favor of global Express.Request augmentation
// see src/types/express/index.d.ts

export const authenticate = (requiredRoles?: UserRole[]) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    logger.debug(`[AuthMiddleware] Authenticating request for: ${req.path}`);
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new InvalidTokenError('Authorization header missing or malformed');
      }

      const token = authHeader.split(' ')[1];
      logger.debug({ tokenReceived: token }, '[AuthMiddleware] Token received.');
      if (!token) {
        throw new InvalidTokenError('Token not found');
      }

      // 1. Verify JWT with RS256 public key
      let payload: JwtPayload;
      try {
        payload = jwt.verify(token, JWT_PUBLIC_KEY, { algorithms: ['RS256'] }) as JwtPayload;
        logger.debug({ decodedPayload: payload }, '[AuthMiddleware] Token verified successfully.');
      } catch (error: any) {
        logger.error({ err: error }, '[AuthMiddleware] Token verification failed.');
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
        producerId: payload.producerId,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
};
