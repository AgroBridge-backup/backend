import { twoFactorService } from '../../../infrastructure/auth/TwoFactorService.js';
import { NotFoundError } from '../../../shared/errors/NotFoundError.js';
import logger from '../../../shared/utils/logger.js';
export class Get2FAStatusUseCase {
    userRepository;
    constructor(userRepository) {
        this.userRepository = userRepository;
    }
    async execute(dto) {
        const { userId } = dto;
        logger.debug('[Get2FAStatusUseCase] Getting 2FA status', { userId });
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }
        const status = await twoFactorService.getStatus(userId);
        return {
            enabled: status.enabled,
            enabledAt: status.enabledAt,
            backupCodesRemaining: status.backupCodesRemaining,
        };
    }
}
