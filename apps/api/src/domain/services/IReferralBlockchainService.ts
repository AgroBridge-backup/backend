/**
 * Referral Blockchain Service Interface
 * Abstracts blockchain operations for referral program verification
 */

export interface ReferralBlockchainData {
  referralId: string;
  referrerId: string;
  referredId: string;
  referralCode: string;
  appliedAt: Date;
}

export interface ReferralRegistrationResult {
  success: boolean;
  txHash: string | null; // P1-7 FIX: Nullable when blockchain unavailable
  eventId: string;
  network: string;
  timestamp: Date;
  gasUsed?: string | null;
  status?: string; // P1-7 FIX: BLOCKCHAIN_UNAVAILABLE when fallback
  error?: string;  // P1-7 FIX: Error message when fallback
}

export interface ReferralRewardData {
  referralId: string;
  rewardType: string;
  rewardAmount: number;
  currency: string;
  rewardedAt: Date;
}

export interface ReferralRewardResult {
  success: boolean;
  txHash: string | null; // P1-7 FIX: Nullable when blockchain unavailable
  eventId: string;
  network: string;
  timestamp: Date;
  status?: string; // P1-7 FIX: BLOCKCHAIN_UNAVAILABLE when fallback
  error?: string;  // P1-7 FIX: Error message when fallback
}

export interface ReferralVerificationResult {
  isVerified: boolean;
  txHash: string | null;
  eventId: string | null;
  registeredAt: Date | null;
  network: string | null;
}

export interface IReferralBlockchainService {
  /**
   * Register a referral on the blockchain
   */
  registerReferral(data: ReferralBlockchainData): Promise<ReferralRegistrationResult>;

  /**
   * Record a referral reward on the blockchain
   */
  recordReferralReward(data: ReferralRewardData): Promise<ReferralRewardResult>;

  /**
   * Verify if a referral is registered on blockchain
   */
  verifyReferral(referralId: string): Promise<ReferralVerificationResult>;

  /**
   * Check if the blockchain service is healthy
   */
  isHealthy(): Promise<boolean>;
}
