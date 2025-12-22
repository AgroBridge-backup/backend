/**
 * Get Referral Stats Use Case
 * Retrieves referral statistics for a referrer
 */

import { IReferralRepository } from '../../../domain/repositories/IReferralRepository.js';
import { ReferralStats, UserReferralCode } from '../../../domain/entities/Referral.js';
import { ValidationError } from '../../../shared/errors/ValidationError.js';

export interface GetReferralStatsRequest {
  userId: string;
}

export interface GetReferralStatsResponse {
  stats: ReferralStats;
  referralCode: UserReferralCode;
}

export class GetReferralStatsUseCase {
  constructor(private readonly referralRepository: IReferralRepository) {}

  async execute(request: GetReferralStatsRequest): Promise<GetReferralStatsResponse> {
    if (!request.userId) {
      throw new ValidationError('userId is required');
    }

    // Get or create user's referral code
    const referralCode = await this.referralRepository.getOrCreateUserReferralCode(request.userId);

    // Get stats
    const stats = await this.referralRepository.getStatsForReferrer(request.userId);

    return {
      stats,
      referralCode,
    };
  }
}
