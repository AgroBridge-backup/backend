import { IUseCase } from '@/shared/interfaces/IUseCase';
import { IRefreshTokenRepository } from '@/domain/repositories/IRefreshTokenRepository';
import { IUserRepository } from '@/domain/repositories/IUserRepository';
import { RefreshTokenRequestDto, RefreshTokenResponseDto } from '@/application/dtos/auth.dtos';
import { InvalidTokenError } from '@/shared/errors/InvalidTokenError';
import { add } from 'date-fns';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// Load private key and TTLs from environment
const privateKeyPath = process.env.JWT_PRIVATE_KEY_PATH!;
const resolvedPath = path.resolve(process.cwd(), privateKeyPath);
const JWT_PRIVATE_KEY = fs.readFileSync(resolvedPath, 'utf-8');
const ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_TOKEN_TTL || '15m';
const REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_TOKEN_TTL || '7d';
const REFRESH_TOKEN_TTL_DAYS = 7; // Must match the 'd' in REFRESH_TOKEN_TTL

export class RefreshTokenUseCase implements IUseCase<RefreshTokenRequestDto, RefreshTokenResponseDto> {
  constructor(
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    private readonly userRepository: IUserRepository
  ) {}

  async execute(dto: RefreshTokenRequestDto): Promise<RefreshTokenResponseDto> {
    const { refreshToken } = dto;

    // 1. Validate the refresh token by finding it in the DB
    const storedToken = await this.refreshTokenRepository.findByToken(refreshToken);
    if (!storedToken) {
      throw new InvalidTokenError('Refresh token not found.');
    }

    // 2. Verify the token is not revoked and not expired
    if (storedToken.isRevoked || new Date() > storedToken.expiresAt) {
      throw new InvalidTokenError('Refresh token is revoked or expired.');
    }
    
    // 3. Verify the JWT signature and expiration (double-check)
    try {
      jwt.verify(refreshToken, JWT_PRIVATE_KEY, { algorithms: ['RS256'] });
    } catch (error) {
      throw new InvalidTokenError('Invalid refresh token signature.');
    }

    // 4. Revoke the used refresh token (Token Rotation)
    await this.refreshTokenRepository.revoke(storedToken.id);

    // 5. Get user details for the new token payload
    const user = await this.userRepository.findById(storedToken.userId);
    if (!user || !user.isActive) {
      throw new InvalidTokenError('User not found or inactive.');
    }

    // 6. Generate new tokens
    const newAccessToken = this.generateAccessToken(user);
    const newRefreshToken = this.generateRefreshToken(user);
    const newRefreshTokenExpiresAt = add(new Date(), { days: REFRESH_TOKEN_TTL_DAYS });

    // 7. Store the new refresh token
    await this.refreshTokenRepository.create(user.id, newRefreshToken, newRefreshTokenExpiresAt);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  private generateAccessToken(user: { id: string; role: string; email: string }): string {
    const payload = { sub: user.id, role: user.role, email: user.email };
    const jti = randomUUID();
    const options: jwt.SignOptions = {
      algorithm: 'RS256',
      expiresIn: ACCESS_TOKEN_TTL,
      jwtid: jti,
    };
    return jwt.sign(payload, JWT_PRIVATE_KEY, options);
  }

  private generateRefreshToken(user: { id: string }): string {
    const payload = { sub: user.id };
    const jti = randomUUID();
    const options: jwt.SignOptions = {
      algorithm: 'RS256',
      expiresIn: REFRESH_TOKEN_TTL,
      jwtid: jti,
    };
    return jwt.sign(payload, JWT_PRIVATE_KEY, options);
  }
}
