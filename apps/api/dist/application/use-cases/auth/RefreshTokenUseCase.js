import { InvalidTokenError } from '../../../shared/errors/InvalidTokenError.js';
import { add } from 'date-fns';
import * as jwt from 'jsonwebtoken';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'crypto';
const privateKeyPath = process.env.JWT_PRIVATE_KEY_PATH;
const resolvedPrivateKeyPath = path.resolve(process.cwd(), privateKeyPath);
const JWT_PRIVATE_KEY = fs.readFileSync(resolvedPrivateKeyPath, 'utf-8');
const publicKeyPath = process.env.JWT_PUBLIC_KEY_PATH;
const resolvedPublicKeyPath = path.resolve(process.cwd(), publicKeyPath);
const JWT_PUBLIC_KEY = fs.readFileSync(resolvedPublicKeyPath, 'utf-8');
const ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_TOKEN_TTL || '15m';
const REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_TOKEN_TTL || '7d';
const REFRESH_TOKEN_TTL_DAYS = 7;
export class RefreshTokenUseCase {
    refreshTokenRepository;
    userRepository;
    constructor(refreshTokenRepository, userRepository) {
        this.refreshTokenRepository = refreshTokenRepository;
        this.userRepository = userRepository;
    }
    async execute({ refreshToken }) {
        const storedToken = await this.refreshTokenRepository.findByToken(refreshToken);
        if (!storedToken || storedToken.isRevoked || new Date() > storedToken.expiresAt) {
            throw new InvalidTokenError('Refresh token is revoked or expired.');
        }
        try {
            jwt.verify(refreshToken, JWT_PUBLIC_KEY, { algorithms: ['RS256'] });
        }
        catch (error) {
            throw new InvalidTokenError('Invalid refresh token signature.');
        }
        await this.refreshTokenRepository.revoke(storedToken.id);
        const user = await this.userRepository.findById(storedToken.userId);
        if (!user || !user.isActive) {
            throw new InvalidTokenError('User not found or inactive.');
        }
        const newAccessToken = this.generateAccessToken(user);
        const newRefreshToken = this.generateRefreshToken(user);
        const newRefreshTokenExpiresAt = add(new Date(), { days: REFRESH_TOKEN_TTL_DAYS });
        await this.refreshTokenRepository.create(user.id, newRefreshToken, newRefreshTokenExpiresAt);
        return {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
        };
    }
    generateAccessToken(user) {
        const payload = { sub: user.id, role: user.role, email: user.email };
        const jti = randomUUID();
        const options = {
            algorithm: 'RS256',
            expiresIn: ACCESS_TOKEN_TTL,
            jwtid: jti,
        };
        return jwt.sign(payload, JWT_PRIVATE_KEY, options);
    }
    generateRefreshToken(user) {
        const payload = { sub: user.id };
        const jti = randomUUID();
        const options = {
            algorithm: 'RS256',
            expiresIn: REFRESH_TOKEN_TTL,
            jwtid: jti,
        };
        return jwt.sign(payload, JWT_PRIVATE_KEY, options);
    }
}
