/**
 * @file Setup 2FA Use Case
 * @description Generates a new 2FA secret and QR code for user setup
 *
 * @author AgroBridge Engineering Team
 */

import { IUseCase } from "../../../shared/interfaces/IUseCase.js";
import {
  Setup2FARequestDto,
  Setup2FAResponseDto,
} from "../../dtos/auth.dtos.js";
import { twoFactorService } from "../../../infrastructure/auth/TwoFactorService.js";
import { IUserRepository } from "../../../domain/repositories/IUserRepository.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";
import logger from "../../../shared/utils/logger.js";

export class Setup2FAUseCase
  implements IUseCase<Setup2FARequestDto, Setup2FAResponseDto>
{
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(dto: Setup2FARequestDto): Promise<Setup2FAResponseDto> {
    const { userId } = dto;
    logger.debug("[Setup2FAUseCase] Setting up 2FA for user", { userId });

    // Verify user exists
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Generate secret and QR code using TwoFactorService
    const result = await twoFactorService.generateSecret(userId, user.email);

    logger.info("[Setup2FAUseCase] 2FA setup initiated", { userId });

    return {
      secret: result.secret,
      otpauthUrl: result.otpauthUrl,
      qrCode: result.qrCode,
    };
  }
}
