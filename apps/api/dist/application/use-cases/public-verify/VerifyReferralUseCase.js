import { ReferralStatus } from '../../../domain/entities/Referral.js';
import { NotFoundError } from '../../../shared/errors/NotFoundError.js';
export class VerifyReferralUseCase {
    referralRepository;
    constructor(referralRepository) {
        this.referralRepository = referralRepository;
    }
    async execute(request) {
        const referral = await this.referralRepository.findById(request.referralId);
        if (!referral) {
            throw new NotFoundError('Referral not found');
        }
        const referrerCode = await this.referralRepository.getOrCreateUserReferralCode(referral.referrerId);
        let verificationStatus = 'NOT_REGISTERED';
        let message = 'Este referido está pendiente de verificación en blockchain.';
        if (referral.blockchainVerified && referral.blockchainTxHash) {
            verificationStatus = 'VERIFIED';
            message = 'Este referido está registrado en blockchain y es verificable.';
        }
        else if (referral.status === ReferralStatus.ACTIVE ||
            referral.status === ReferralStatus.COMPLETED) {
            verificationStatus = 'PENDING';
            message = 'Este referido está activo y pendiente de registro en blockchain.';
        }
        return {
            referral: {
                id: referral.id,
                code: referral.referralCode,
                status: referral.status,
                activityScore: referral.activityScore,
                createdAt: referral.appliedAt,
                completedAt: referral.completedAt ?? null,
            },
            referrer: {
                totalReferrals: referrerCode.totalReferrals,
                activeReferrals: referrerCode.activeReferrals,
                hasWallet: !!referrerCode.walletAddress,
            },
            blockchain: {
                verified: referral.blockchainVerified,
                txHash: referral.blockchainTxHash ?? null,
                eventId: referral.blockchainEventId ?? null,
                network: referral.blockchainNetwork ?? null,
            },
            verification: {
                isAuthentic: referral.blockchainVerified,
                status: verificationStatus,
                message,
                verifiedAt: new Date(),
            },
        };
    }
}
