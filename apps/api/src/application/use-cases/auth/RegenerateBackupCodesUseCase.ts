/**
 * @file Regenerate Backup Codes Use Case
 * @description Regenerates backup codes for a user (requires 2FA verification)
 *
 * @author AgroBridge Engineering Team
 */

import { IUseCase } from "../../../shared/interfaces/IUseCase.js";
import {
  RegenerateBackupCodesRequestDto,
  RegenerateBackupCodesResponseDto,
} from "../../dtos/auth.dtos.js";
import { twoFactorService } from "../../../infrastructure/auth/TwoFactorService.js";
import { IUserRepository } from "../../../domain/repositories/IUserRepository.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";
import { ValidationError } from "../../../shared/errors/ValidationError.js";
import logger from "../../../shared/utils/logger.js";

export class RegenerateBackupCodesUseCase
  implements
    IUseCase<RegenerateBackupCodesRequestDto, RegenerateBackupCodesResponseDto>
{
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(
    dto: RegenerateBackupCodesRequestDto,
  ): Promise<RegenerateBackupCodesResponseDto> {
    const { userId, token } = dto;
    logger.debug("[RegenerateBackupCodesUseCase] Regenerating backup codes", {
      userId,
    });

    // Verify user exists
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Verify the 2FA token first (security measure)
    const verifyResult = await twoFactorService.verifyToken(userId, token);
    if (!verifyResult.valid) {
      throw new ValidationError("Invalid verification code. Please try again.");
    }

    try {
      // Generate new backup codes
      const result = await twoFactorService.generateBackupCodes(userId);

      logger.info("[RegenerateBackupCodesUseCase] Backup codes regenerated", {
        userId,
        count: result.count,
      });

      return {
        backupCodes: result.codes,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("2FA must be enabled")) {
          throw new ValidationError(
            "2FA must be enabled before regenerating backup codes.",
          );
        }
      }
      throw error;
    }
  }
}
