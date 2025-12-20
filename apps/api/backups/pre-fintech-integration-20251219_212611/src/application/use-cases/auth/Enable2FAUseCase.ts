/**
 * @file Enable 2FA Use Case
 * @description Enables 2FA after verifying the setup token
 *
 * @author AgroBridge Engineering Team
 */

import { IUseCase } from '../../../shared/interfaces/IUseCase.js';
import { Enable2FARequestDto, Enable2FAResponseDto } from '../../dtos/auth.dtos.js';
import { twoFactorService } from '../../../infrastructure/auth/TwoFactorService.js';
import { IUserRepository } from '../../../domain/repositories/IUserRepository.js';
import { NotFoundError } from '../../../shared/errors/NotFoundError.js';
import { ValidationError } from '../../../shared/errors/ValidationError.js';
import logger from '../../../shared/utils/logger.js';

export class Enable2FAUseCase implements IUseCase<Enable2FARequestDto, Enable2FAResponseDto> {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(dto: Enable2FARequestDto): Promise<Enable2FAResponseDto> {
    const { userId, token } = dto;
    logger.debug('[Enable2FAUseCase] Enabling 2FA for user', { userId });

    // Verify user exists
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    try {
      // Enable 2FA and get backup codes
      const result = await twoFactorService.enable2FA(userId, token);

      logger.info('[Enable2FAUseCase] 2FA enabled successfully', { userId });

      return {
        enabled: true,
        backupCodes: result.codes,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Invalid verification token') {
          throw new ValidationError('Invalid verification code. Please try again.');
        }
        if (error.message === '2FA is already enabled') {
          throw new ValidationError('2FA is already enabled for this account.');
        }
        if (error.message.includes('No 2FA secret found')) {
          throw new ValidationError('Please set up 2FA first before enabling it.');
        }
      }
      throw error;
    }
  }
}
