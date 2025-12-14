import { AuthenticationError } from '../../../shared/errors/AuthenticationError.js';
import logger from '../../../shared/utils/logger.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'crypto';
import { add } from 'date-fns';
const privateKeyPath = process.env.JWT_PRIVATE_KEY_PATH;
const resolvedPath = path.resolve(process.cwd(), privateKeyPath);
logger.debug(`[LoginUseCase] Loading Private Key from: ${resolvedPath}`);
const JWT_PRIVATE_KEY = fs.readFileSync(resolvedPath, 'utf-8');
const ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_TOKEN_TTL || '15m';
const REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_TOKEN_TTL || '7d';
const REFRESH_TOKEN_TTL_DAYS = 7;
export class LoginUseCase {
    userRepository;
    refreshTokenRepository;
    constructor(userRepository, refreshTokenRepository) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
    }
    async execute(dto) {
        const { email, password } = dto;
        logger.debug(`[LoginUseCase] Attempting to log in user: ${email}`);
        const user = await this.userRepository.findByEmail(email, { producer: true });
        logger.debug('[LoginUseCase] User found in database.', { userFound: !!user, hasProducer: !!user?.producer, producerId: user?.producer?.id });
        if (!user || !user.isActive) {
            throw new AuthenticationError('Invalid credentials or user inactive.');
        }
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        logger.debug(`[LoginUseCase] Password validation result for ${email}: ${isPasswordValid}`);
        if (!isPasswordValid) {
            throw new AuthenticationError('Invalid credentials or user inactive.');
        }
        logger.debug('[LoginUseCase] Generating tokens for user.', { userId: user.id, email: user.email });
        const accessToken = this.generateAccessToken(user);
        const refreshToken = this.generateRefreshToken(user);
        const refreshTokenExpiresAt = add(new Date(), { days: REFRESH_TOKEN_TTL_DAYS });
        await this.refreshTokenRepository.create(user.id, refreshToken, refreshTokenExpiresAt);
        return { accessToken, refreshToken };
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
