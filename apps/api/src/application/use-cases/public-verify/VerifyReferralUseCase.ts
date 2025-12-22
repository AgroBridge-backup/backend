/**
 * Verify Referral Use Case
 * Public verification of referral authenticity via blockchain
 */

import { IReferralRepository } from '../../../domain/repositories/IReferralRepository.js';
import { ReferralStatus } from '../../../domain/entities/Referral.js';
import { NotFoundError } from '../../../shared/errors/NotFoundError.js';

export interface VerifyReferralRequest {
  referralId: string;
}

export interface VerifyReferralResponse {
  referral: {
    id: string;
    code: string;
    status: string;
    activityScore: number;
    createdAt: Date;
    completedAt: Date | null;
  };
  referrer: {
    totalReferrals: number;
    activeReferrals: number;
    hasWallet: boolean;
  };
  blockchain: {
    verified: boolean;
    txHash: string | null;
    eventId: string | null;
    network: string | null;
  };
  verification: {
    isAuthentic: boolean;
    status: 'VERIFIED' | 'PENDING' | 'NOT_REGISTERED';
    message: string;
    verifiedAt: Date;
  };
}

export class VerifyReferralUseCase {
  constructor(private readonly referralRepository: IReferralRepository) {}

  async execute(request: VerifyReferralRequest): Promise<VerifyReferralResponse> {
    const referral = await this.referralRepository.findById(request.referralId);

    if (!referral) {
      throw new NotFoundError('Referral not found');
    }

    // Get referrer's code stats
    const referrerCode = await this.referralRepository.getOrCreateUserReferralCode(
      referral.referrerId
    );

    // Determine verification status
    let verificationStatus: 'VERIFIED' | 'PENDING' | 'NOT_REGISTERED' = 'NOT_REGISTERED';
    let message = 'Este referido está pendiente de verificación en blockchain.';

    if (referral.blockchainVerified && referral.blockchainTxHash) {
      verificationStatus = 'VERIFIED';
      message = 'Este referido está registrado en blockchain y es verificable.';
    } else if (
      referral.status === ReferralStatus.ACTIVE ||
      referral.status === ReferralStatus.COMPLETED
    ) {
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
