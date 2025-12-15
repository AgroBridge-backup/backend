import { twoFactorService } from '../../../infrastructure/auth/TwoFactorService.js';
import { NotFoundError } from '../../../shared/errors/NotFoundError.js';
import { ValidationError } from '../../../shared/errors/ValidationError.js';
import logger from '../../../shared/utils/logger.js';
export class RegenerateBackupCodesUseCase {
    userRepository;
    constructor(userRepository) {
        this.userRepository = userRepository;
    }
    async execute(dto) {
        const { userId, token } = dto;
        logger.debug('[RegenerateBackupCodesUseCase] Regenerating backup codes', { userId });
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }
        const verifyResult = await twoFactorService.verifyToken(userId, token);
        if (!verifyResult.valid) {
            throw new ValidationError('Invalid verification code. Please try again.');
        }
        try {
            const result = await twoFactorService.generateBackupCodes(userId);
            logger.info('[RegenerateBackupCodesUseCase] Backup codes regenerated', {
                userId,
                count: result.count,
            });
            return {
                backupCodes: result.codes,
            };
        }
        catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('2FA must be enabled')) {
                    throw new ValidationError('2FA must be enabled before regenerating backup codes.');
                }
            }
            throw error;
        }
    }
}
