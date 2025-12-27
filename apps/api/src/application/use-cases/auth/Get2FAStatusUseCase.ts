/**
 * @file Get 2FA Status Use Case
 * @description Retrieves the current 2FA status for a user
 *
 * @author AgroBridge Engineering Team
 */

import { IUseCase } from "../../../shared/interfaces/IUseCase.js";
import { TwoFactorStatusDto } from "../../dtos/auth.dtos.js";
import { twoFactorService } from "../../../infrastructure/auth/TwoFactorService.js";
import { IUserRepository } from "../../../domain/repositories/IUserRepository.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";
import logger from "../../../shared/utils/logger.js";

export interface Get2FAStatusRequestDto {
  userId: string;
}

export class Get2FAStatusUseCase
  implements IUseCase<Get2FAStatusRequestDto, TwoFactorStatusDto>
{
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(dto: Get2FAStatusRequestDto): Promise<TwoFactorStatusDto> {
    const { userId } = dto;
    logger.debug("[Get2FAStatusUseCase] Getting 2FA status", { userId });

    // Verify user exists
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Get 2FA status from TwoFactorService
    const status = await twoFactorService.getStatus(userId);

    return {
      enabled: status.enabled,
      enabledAt: status.enabledAt,
      backupCodesRemaining: status.backupCodesRemaining,
    };
  }
}
