import { IUserRepository } from '../../../domain/repositories/IUserRepository.js';
import { IRefreshTokenRepository } from '../../../domain/repositories/IRefreshTokenRepository.js';
import { LoginRequestDto, LoginResponseDto } from '../dtos/auth.dtos.js';
import { AuthenticationError } from '../../../shared/errors/AuthenticationError.js';
import logger from '../../../shared/utils/logger.js'; // <-- FIX: IMPORT LOGGER
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'crypto';
import { add } from 'date-fns';

// Load private key and TTLs from environment. Crashing on startup if not set is desired.
const privateKeyPath = process.env.JWT_PRIVATE_KEY_PATH!;
const resolvedPath = path.resolve(process.cwd(), privateKeyPath);
logger.debug(`[LoginUseCase] Loading Private Key from: ${resolvedPath}`);
const JWT_PRIVATE_KEY = fs.readFileSync(resolvedPath, 'utf-8');
const ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_TOKEN_TTL || '15m';
const REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_TOKEN_TTL || '7d';
const REFRESH_TOKEN_TTL_DAYS = 7; // Must match the 'd' in REFRESH_TOKEN_TTL

export class LoginUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly refreshTokenRepository: IRefreshTokenRepository
  ) {}

  async execute(dto: LoginRequestDto): Promise<LoginResponseDto> {
    const { email, password } = dto;
    logger.debug(`[LoginUseCase] Attempting to log in user: ${email}`);

    // 1. Find user by email, including producer info
    const user = await this.userRepository.findByEmail(email, { producer: true });
    logger.debug({ userFound: user, hasProducer: !!user?.producer, producerId: user?.producer?.id }, '[LoginUseCase] User found in database.');

    if (!user || !user.isActive) {
      throw new AuthenticationError('Invalid credentials or user inactive.');
    }

    // 2. Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    logger.debug(`[LoginUseCase] Password validation result for ${email}: ${isPasswordValid}`);

    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid credentials or user inactive.');
    }

    // 3. Generate Tokens
    logger.debug({ userForToken: user }, '[LoginUseCase] Generating tokens for user.');
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // 4. Store the refresh token in the database
    const refreshTokenExpiresAt = add(new Date(), { days: REFRESH_TOKEN_TTL_DAYS });
    await this.refreshTokenRepository.create(user.id, refreshToken, refreshTokenExpiresAt);

    return { accessToken, refreshToken };
  }

  private generateAccessToken(user: { id: string; role: string; email: string; producer?: { id: string } | null }): string {
    const payload = {
      sub: user.id,
      role: user.role,
      email: user.email,
      // Conditionally add producerId if it exists
      ...(user.producer && { producerId: user.producer.id }),
    };
    const jti = randomUUID();

    const options: jwt.SignOptions = {
      algorithm: 'RS256' as jwt.Algorithm,
      // @ts-ignore - Bypassing a defective type definition in @types/jsonwebtoken
      expiresIn: ACCESS_TOKEN_TTL,
      jwtid: jti,
    };

    return jwt.sign(payload, JWT_PRIVATE_KEY, options);
  }

  private generateRefreshToken(user: { id: string }): string {
    const payload = {
      sub: user.id,
    };
    const jti = randomUUID();

    const options: jwt.SignOptions = {
      algorithm: 'RS256' as jwt.Algorithm,
      // @ts-ignore - Bypassing a defective type definition in @types/jsonwebtoken
      expiresIn: REFRESH_TOKEN_TTL,
      jwtid: jti,
    };

    return jwt.sign(payload, JWT_PRIVATE_KEY, options);
  }
}
