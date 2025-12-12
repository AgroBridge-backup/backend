import { AuthenticationError } from '@/shared/errors/AuthenticationError';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { add } from 'date-fns';
// Load private key and TTLs from environment. Crashing on startup if not set is desired.
const privateKeyPath = process.env.JWT_PRIVATE_KEY_PATH;
const resolvedPath = path.resolve(process.cwd(), privateKeyPath);
const JWT_PRIVATE_KEY = fs.readFileSync(resolvedPath, 'utf-8');
const ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_TOKEN_TTL || '15m';
const REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_TOKEN_TTL || '7d';
const REFRESH_TOKEN_TTL_DAYS = 7; // Must match the 'd' in REFRESH_TOKEN_TTL
export class LoginUseCase {
    userRepository;
    refreshTokenRepository;
    constructor(userRepository, refreshTokenRepository) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
    }
    async execute(dto) {
        const { email, password } = dto;
        // 1. Find user by email
        const user = await this.userRepository.findByEmail(email);
        if (!user || !user.isActive) {
            throw new AuthenticationError('Invalid credentials or user inactive.');
        }
        // 2. Verify password
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            throw new AuthenticationError('Invalid credentials or user inactive.');
        }
        // 3. Generate Tokens
        const accessToken = this.generateAccessToken(user);
        const refreshToken = this.generateRefreshToken(user);
        // 4. Store the refresh token in the database
        const refreshTokenExpiresAt = add(new Date(), { days: REFRESH_TOKEN_TTL_DAYS });
        await this.refreshTokenRepository.create(user.id, refreshToken, refreshTokenExpiresAt);
        return { accessToken, refreshToken };
    }
    generateAccessToken(user) {
        const payload = {
            sub: user.id,
            role: user.role,
            email: user.email,
        };
        const jti = randomUUID();
        const options = {
            algorithm: 'RS256',
            // @ts-ignore - Bypassing a defective type definition in @types/jsonwebtoken
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
            // @ts-ignore - Bypassing a defective type definition in @types/jsonwebtoken
            expiresIn: REFRESH_TOKEN_TTL,
            jwtid: jti,
        };
        return jwt.sign(payload, JWT_PRIVATE_KEY, options);
    }
}
//# sourceMappingURL=LoginUseCase.js.map