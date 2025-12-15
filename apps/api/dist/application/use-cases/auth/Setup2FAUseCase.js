import { twoFactorService } from '../../../infrastructure/auth/TwoFactorService.js';
import { NotFoundError } from '../../../shared/errors/NotFoundError.js';
import logger from '../../../shared/utils/logger.js';
export class Setup2FAUseCase {
    userRepository;
    constructor(userRepository) {
        this.userRepository = userRepository;
    }
    async execute(dto) {
        const { userId } = dto;
        logger.debug('[Setup2FAUseCase] Setting up 2FA for user', { userId });
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }
        const result = await twoFactorService.generateSecret(userId, user.email);
        logger.info('[Setup2FAUseCase] 2FA setup initiated', { userId });
        return {
            secret: result.secret,
            otpauthUrl: result.otpauthUrl,
            qrCode: result.qrCode,
        };
    }
}
