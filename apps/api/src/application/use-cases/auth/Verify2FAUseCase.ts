/**
 * @file Verify 2FA Use Case
 * @description Verifies 2FA token during login and issues JWT tokens
 *
 * This is called after LoginUseCase returns requires2FA: true
 * The user must provide the tempToken from login and their TOTP/backup code
 *
 * @author AgroBridge Engineering Team
 */

import { IUseCase } from "../../../shared/interfaces/IUseCase.js";
import {
  Verify2FARequestDto,
  Verify2FAResponseDto,
} from "../../dtos/auth.dtos.js";
import { IUserRepository } from "../../../domain/repositories/IUserRepository.js";
import { IRefreshTokenRepository } from "../../../domain/repositories/IRefreshTokenRepository.js";
import { twoFactorService } from "../../../infrastructure/auth/TwoFactorService.js";
import { redisClient } from "../../../infrastructure/cache/RedisClient.js";
import { AuthenticationError } from "../../../shared/errors/AuthenticationError.js";
import { ValidationError } from "../../../shared/errors/ValidationError.js";
import logger from "../../../shared/utils/logger.js";
import jwt from "jsonwebtoken";
import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "crypto";
import { add } from "date-fns";

// Load JWT configuration
const privateKeyPath = process.env.JWT_PRIVATE_KEY_PATH!;
const resolvedPath = path.resolve(process.cwd(), privateKeyPath);
const JWT_PRIVATE_KEY = fs.readFileSync(resolvedPath, "utf-8");
const ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_TOKEN_TTL || "15m";
const REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_TOKEN_TTL || "7d";
const REFRESH_TOKEN_TTL_DAYS = 7;

// Rate limiting configuration
const MAX_2FA_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW = 300; // 5 minutes

interface TempTokenData {
  userId: string;
  email: string;
}

export class Verify2FAUseCase
  implements IUseCase<Verify2FARequestDto, Verify2FAResponseDto>
{
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly refreshTokenRepository: IRefreshTokenRepository,
  ) {}

  async execute(dto: Verify2FARequestDto): Promise<Verify2FAResponseDto> {
    const { tempToken, token } = dto;
    logger.debug("[Verify2FAUseCase] Verifying 2FA token");

    // 1. Retrieve and validate temp token from Redis
    const tempTokenKey = `2fa:temp:${tempToken}`;
    const tempTokenData = await redisClient.client.get(tempTokenKey);

    if (!tempTokenData) {
      throw new AuthenticationError("Session expired. Please login again.");
    }

    const { userId, email } = JSON.parse(tempTokenData) as TempTokenData;

    // 2. Check rate limiting
    const rateLimitKey = `2fa:attempts:${userId}`;
    const attempts = await redisClient.client.get(rateLimitKey);
    const currentAttempts = attempts ? parseInt(attempts, 10) : 0;

    if (currentAttempts >= MAX_2FA_ATTEMPTS) {
      logger.warn("[Verify2FAUseCase] Rate limit exceeded", { userId });
      throw new ValidationError(
        "Too many verification attempts. Please try again later.",
      );
    }

    // 3. Verify the 2FA token
    const verifyResult = await twoFactorService.verifyToken(userId, token);

    if (!verifyResult.valid) {
      // Increment rate limit counter
      await redisClient.client.incr(rateLimitKey);
      await redisClient.client.expire(rateLimitKey, RATE_LIMIT_WINDOW);

      logger.warn("[Verify2FAUseCase] Invalid 2FA token", {
        userId,
        method: verifyResult.method,
      });
      throw new AuthenticationError("Invalid verification code.");
    }

    // 4. Clear temp token and rate limit counter on success
    await redisClient.client.del(tempTokenKey);
    await redisClient.client.del(rateLimitKey);

    // 5. Get user with producer info for token generation
    const user = await this.userRepository.findByEmail(email, {
      producer: true,
    });
    if (!user || !user.isActive) {
      throw new AuthenticationError("User not found or inactive.");
    }

    // 6. Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // 7. Store refresh token
    const refreshTokenExpiresAt = add(new Date(), {
      days: REFRESH_TOKEN_TTL_DAYS,
    });
    await this.refreshTokenRepository.create(
      user.id,
      refreshToken,
      refreshTokenExpiresAt,
    );

    logger.info("[Verify2FAUseCase] 2FA verification successful", {
      userId,
      method: verifyResult.method,
      remainingBackupCodes: verifyResult.remainingBackupCodes,
    });

    // Log warning if backup codes are running low
    if (
      verifyResult.method === "backup_code" &&
      verifyResult.remainingBackupCodes !== undefined
    ) {
      if (verifyResult.remainingBackupCodes <= 2) {
        logger.warn("[Verify2FAUseCase] User has few backup codes remaining", {
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

  private generateAccessToken(user: {
    id: string;
    role: string;
    email: string;
    producer?: { id: string } | null;
  }): string {
    const payload = {
      sub: user.id,
      role: user.role,
      email: user.email,
      ...(user.producer && { producerId: user.producer.id }),
    };
    const jti = randomUUID();

    const options: jwt.SignOptions = {
      algorithm: "RS256" as jwt.Algorithm,
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
      algorithm: "RS256" as jwt.Algorithm,
      // @ts-ignore - Bypassing a defective type definition in @types/jsonwebtoken
      expiresIn: REFRESH_TOKEN_TTL,
      jwtid: jti,
    };

    return jwt.sign(payload, JWT_PRIVATE_KEY, options);
  }
}
