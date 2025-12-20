/**
 * @file Disable 2FA Use Case
 * @description Disables 2FA after verifying the user's token
 *
 * @author AgroBridge Engineering Team
 */

import { IUseCase } from '../../../shared/interfaces/IUseCase.js';
import { Disable2FARequestDto } from '../../dtos/auth.dtos.js';
import { twoFactorService } from '../../../infrastructure/auth/TwoFactorService.js';
import { IUserRepository } from '../../../domain/repositories/IUserRepository.js';
import { NotFoundError } from '../../../shared/errors/NotFoundError.js';
import { ValidationError } from '../../../shared/errors/ValidationError.js';
import logger from '../../../shared/utils/logger.js';

export interface Disable2FAResponseDto {
  disabled: boolean;
  message: string;
}

export class Disable2FAUseCase implements IUseCase<Disable2FARequestDto, Disable2FAResponseDto> {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(dto: Disable2FARequestDto): Promise<Disable2FAResponseDto> {
    const { userId, token } = dto;
    logger.debug('[Disable2FAUseCase] Disabling 2FA for user', { userId });

    // Verify user exists
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    try {
      // Disable 2FA
      await twoFactorService.disable2FA(userId, token);

      logger.info('[Disable2FAUseCase] 2FA disabled successfully', { userId });

      return {
        disabled: true,
        message: 'Two-factor authentication has been disabled successfully.',
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Invalid verification token') {
          throw new ValidationError('Invalid verification code. Please try again.');
        }
        if (error.message === '2FA is not enabled') {
          throw new ValidationError('2FA is not enabled for this account.');
        }
      }
      throw error;
    }
  }
}
