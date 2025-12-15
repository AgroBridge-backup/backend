import { twoFactorService } from '../../../infrastructure/auth/TwoFactorService.js';
import { redisClient } from '../../../infrastructure/cache/RedisClient.js';
import { AuthenticationError } from '../../../shared/errors/AuthenticationError.js';
import { ValidationError } from '../../../shared/errors/ValidationError.js';
import logger from '../../../shared/utils/logger.js';
import jwt from 'jsonwebtoken';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'crypto';
import { add } from 'date-fns';
const privateKeyPath = process.env.JWT_PRIVATE_KEY_PATH;
const resolvedPath = path.resolve(process.cwd(), privateKeyPath);
const JWT_PRIVATE_KEY = fs.readFileSync(resolvedPath, 'utf-8');
const ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_TOKEN_TTL || '15m';
const REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_TOKEN_TTL || '7d';
const REFRESH_TOKEN_TTL_DAYS = 7;
const MAX_2FA_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW = 300;
export class Verify2FAUseCase {
    userRepository;
    refreshTokenRepository;
    constructor(userRepository, refreshTokenRepository) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
    }
    async execute(dto) {
        const { tempToken, token } = dto;
        logger.debug('[Verify2FAUseCase] Verifying 2FA token');
        const tempTokenKey = `2fa:temp:${tempToken}`;
        const tempTokenData = await redisClient.client.get(tempTokenKey);
        if (!tempTokenData) {
            throw new AuthenticationError('Session expired. Please login again.');
        }
        const { userId, email } = JSON.parse(tempTokenData);
        const rateLimitKey = `2fa:attempts:${userId}`;
        const attempts = await redisClient.client.get(rateLimitKey);
        const currentAttempts = attempts ? parseInt(attempts, 10) : 0;
        if (currentAttempts >= MAX_2FA_ATTEMPTS) {
            logger.warn('[Verify2FAUseCase] Rate limit exceeded', { userId });
            throw new ValidationError('Too many verification attempts. Please try again later.');
        }
        const verifyResult = await twoFactorService.verifyToken(userId, token);
        if (!verifyResult.valid) {
            await redisClient.client.incr(rateLimitKey);
            await redisClient.client.expire(rateLimitKey, RATE_LIMIT_WINDOW);
            logger.warn('[Verify2FAUseCase] Invalid 2FA token', { userId, method: verifyResult.method });
            throw new AuthenticationError('Invalid verification code.');
        }
        await redisClient.client.del(tempTokenKey);
        await redisClient.client.del(rateLimitKey);
        const user = await this.userRepository.findByEmail(email, { producer: true });
        if (!user || !user.isActive) {
            throw new AuthenticationError('User not found or inactive.');
        }
        const accessToken = this.generateAccessToken(user);
        const refreshToken = this.generateRefreshToken(user);
        const refreshTokenExpiresAt = add(new Date(), { days: REFRESH_TOKEN_TTL_DAYS });
        await this.refreshTokenRepository.create(user.id, refreshToken, refreshTokenExpiresAt);
        logger.info('[Verify2FAUseCase] 2FA verification successful', {
            userId,
            method: verifyResult.method,
            remainingBackupCodes: verifyResult.remainingBackupCodes,
        });
        if (verifyResult.method === 'backup_code' && verifyResult.remainingBackupCodes !== undefined) {
            if (verifyResult.remainingBackupCodes <= 2) {
                logger.warn('[Verify2FAUseCase] User has few backup codes remaining', {
                    userId,
                    remaining: verifyResult.remainingBackupCodes,
                });
            }
        }
        return {
            accessToken,
            refreshToken,
        };
    }
    generateAccessToken(user) {
        const payload = {
            sub: user.id,
            role: user.role,
            email: user.email,
            ...(user.producer && { producerId: user.producer.id }),
        };
        const jti = randomUUID();
        const options = {
            algorithm: 'RS256',
            expiresIn: ACCESS_TOKEN_TTL,
            jwtid: jti,
        };
        return jwt.sign(payload, JWT_PRIVATE_KEY, options);
    }
    generateRefreshToken(user) {
        const payload = {
            sub: user.id,
        };
        const jti = randomUUID();
        const options = {
            algorithm: 'RS256',
            expiresIn: REFRESH_TOKEN_TTL,
            jwtid: jti,
        };
        return jwt.sign(payload, JWT_PRIVATE_KEY, options);
    }
}
