import { twoFactorService } from '../../../infrastructure/auth/TwoFactorService.js';
import { NotFoundError } from '../../../shared/errors/NotFoundError.js';
import { ValidationError } from '../../../shared/errors/ValidationError.js';
import logger from '../../../shared/utils/logger.js';
export class Disable2FAUseCase {
    userRepository;
    constructor(userRepository) {
        this.userRepository = userRepository;
    }
    async execute(dto) {
        const { userId, token } = dto;
        logger.debug('[Disable2FAUseCase] Disabling 2FA for user', { userId });
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }
        try {
            await twoFactorService.disable2FA(userId, token);
            logger.info('[Disable2FAUseCase] 2FA disabled successfully', { userId });
            return {
                disabled: true,
                message: 'Two-factor authentication has been disabled successfully.',
            };
        }
        catch (error) {
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
