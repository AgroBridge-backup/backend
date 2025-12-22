/**
 * Mark Referral Rewarded Use Case
 * Marks a referral as rewarded with optional blockchain transaction
 */

import { IReferralRepository } from '../../../domain/repositories/IReferralRepository.js';
import { Referral, ReferralStatus } from '../../../domain/entities/Referral.js';
import { NotFoundError } from '../../../shared/errors/NotFoundError.js';
import { ValidationError } from '../../../shared/errors/ValidationError.js';
import { ILogger } from '../../../domain/services/ILogger.js';

export interface MarkReferralRewardedRequest {
  referralId: string;
  rewardTxHash?: string;
}

export interface MarkReferralRewardedResponse {
  referral: Referral;
  message: string;
}

export class MarkReferralRewardedUseCase {
  constructor(
    private readonly referralRepository: IReferralRepository,
    private readonly logger?: ILogger
  ) {}

  async execute(request: MarkReferralRewardedRequest): Promise<MarkReferralRewardedResponse> {
    if (!request.referralId) {
      throw new ValidationError('Referral ID is required');
    }

    const existingReferral = await this.referralRepository.findById(request.referralId);

    if (!existingReferral) {
      throw new NotFoundError('Referral not found');
    }

    // Idempotency check
    if (existingReferral.rewardGranted) {
      this.logger?.info('Referral already rewarded', { referralId: request.referralId });
      return {
        referral: existingReferral,
        message: 'Referral already rewarded',
      };
    }

    // Check if referral is in a valid state for rewarding
    if (
      existingReferral.status !== ReferralStatus.COMPLETED &&
      existingReferral.status !== ReferralStatus.ACTIVE
    ) {
      throw new ValidationError(
        `Cannot reward referral with status: ${existingReferral.status}. Status must be ACTIVE or COMPLETED.`
      );
    }

    this.logger?.info('Marking referral as rewarded', {
      referralId: request.referralId,
      rewardTxHash: request.rewardTxHash,
    });

    // Mark as rewarded
    const referral = await this.referralRepository.markRewarded(
      request.referralId,
      request.rewardTxHash
    );

    // Update referrer's reward stats
    await this.referralRepository.updateUserReferralCodeStats(referral.referrerId, {
      totalRewardsEarned: referral.rewardValue,
      completedReferrals: 1,
      activeReferrals: -1,
    });

    // If blockchain verified, update on-chain count
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
