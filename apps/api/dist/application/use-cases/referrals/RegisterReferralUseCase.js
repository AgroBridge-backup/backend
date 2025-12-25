import { randomUUID } from 'crypto';
import { ReferralStatus } from '../../../domain/entities/Referral.js';
import { ValidationError } from '../../../shared/errors/ValidationError.js';
import { NotFoundError } from '../../../shared/errors/NotFoundError.js';
export class RegisterReferralUseCase {
    referralRepository;
    logger;
    constructor(referralRepository, logger) {
        this.referralRepository = referralRepository;
        this.logger = logger;
    }
    async execute(request) {
        if (!request.referralCode) {
            throw new ValidationError('Referral code is required');
        }
        if (!request.referredUserId) {
            throw new ValidationError('Referred user ID is required');
        }
        const existingReferral = await this.referralRepository.findByReferredUser(request.referredUserId);
        if (existingReferral) {
            throw new ValidationError('User has already been referred');
        }
        const userReferralCode = await this.referralRepository.findUserReferralCodeByCode(request.referralCode);
        if (!userReferralCode) {
            throw new NotFoundError('Invalid referral code');
        }
        if (userReferralCode.userId === request.referredUserId) {
            throw new ValidationError('Cannot use your own referral code');
        }
        const now = new Date();
        const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const referralId = randomUUID();
        this.logger?.info('Registering new referral', {
            referralCode: request.referralCode,
            referrerId: userReferralCode.userId,
            referredId: request.referredUserId,
        });
        const referral = await this.referralRepository.create({
            id: referralId,
            referrerId: userReferralCode.userId,
            referredId: request.referredUserId,
            referralCode: request.referralCode,
            status: ReferralStatus.REGISTERED,
            monthYear,
            ipAddress: request.ipAddress,
            deviceFingerprint: request.deviceFingerprint,
        });
        await this.referralRepository.updateUserReferralCodeStats(userReferralCode.userId, {
            totalReferrals: 1,
        });
        this.logger?.info('Referral registered successfully', {
            referralId: referral.id,
            referrerId: referral.referrerId,
            referredId: referral.referredId,
        });
        return {
            referral,
            message: 'Referral registered successfully',
        };
    }
}
