import { ReferralStatus } from '../../../domain/entities/Referral.js';
import { NotFoundError } from '../../../shared/errors/NotFoundError.js';
import { ValidationError } from '../../../shared/errors/ValidationError.js';
export class MarkReferralRewardedUseCase {
    referralRepository;
    logger;
    constructor(referralRepository, logger) {
        this.referralRepository = referralRepository;
        this.logger = logger;
    }
    async execute(request) {
        if (!request.referralId) {
            throw new ValidationError('Referral ID is required');
        }
        const existingReferral = await this.referralRepository.findById(request.referralId);
        if (!existingReferral) {
            throw new NotFoundError('Referral not found');
        }
        if (existingReferral.rewardGranted) {
            this.logger?.info('Referral already rewarded', { referralId: request.referralId });
            return {
                referral: existingReferral,
                message: 'Referral already rewarded',
            };
        }
        if (existingReferral.status !== ReferralStatus.COMPLETED &&
            existingReferral.status !== ReferralStatus.ACTIVE) {
            throw new ValidationError(`Cannot reward referral with status: ${existingReferral.status}. Status must be ACTIVE or COMPLETED.`);
        }
        this.logger?.info('Marking referral as rewarded', {
            referralId: request.referralId,
            rewardTxHash: request.rewardTxHash,
        });
        const referral = await this.referralRepository.markRewarded(request.referralId, request.rewardTxHash);
        await this.referralRepository.updateUserReferralCodeStats(referral.referrerId, {
            totalRewardsEarned: referral.rewardValue,
            completedReferrals: 1,
            activeReferrals: -1,
        });
        if (request.rewardTxHash) {
            await this.referralRepository.updateUserReferralCodeStats(referral.referrerId, {
                onChainReferrals: 1,
            });
        }
        this.logger?.info('Referral marked as rewarded successfully', {
            referralId: referral.id,
            referrerId: referral.referrerId,
            rewardValue: referral.rewardValue,
        });
        return {
            referral,
            message: 'Referral marked as rewarded successfully',
        };
    }
}
