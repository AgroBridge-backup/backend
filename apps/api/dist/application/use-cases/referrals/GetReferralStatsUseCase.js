import { ValidationError } from '../../../shared/errors/ValidationError.js';
export class GetReferralStatsUseCase {
    referralRepository;
    constructor(referralRepository) {
        this.referralRepository = referralRepository;
    }
    async execute(request) {
        if (!request.userId) {
            throw new ValidationError('userId is required');
        }
        const referralCode = await this.referralRepository.getOrCreateUserReferralCode(request.userId);
        const stats = await this.referralRepository.getStatsForReferrer(request.userId);
        return {
            stats,
            referralCode,
        };
    }
}
