/**
 * Referral Domain Entity
 * Represents a blockchain-verified referral record
 */

export enum ReferralStatus {
  PENDING = 'PENDING',
  REGISTERED = 'REGISTERED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  FRAUD_SUSPECTED = 'FRAUD_SUSPECTED',
}

export enum ReferralRewardType {
  PREMIUM_DAYS = 'PREMIUM_DAYS',
  CASH_BONUS = 'CASH_BONUS',
  CREDIT_BONUS = 'CREDIT_BONUS',
  FEE_DISCOUNT = 'FEE_DISCOUNT',
}

export interface Referral {
  id: string;
  referrerId: string;
  referredId?: string | null;
  referralCode: string;
  status: ReferralStatus;

  // Activity Metrics
  activityScore: number;
  batchesCreated: number;
  loginCount: number;
  lastActivityAt?: Date | null;

  // Reward Details
  rewardType: ReferralRewardType;
  rewardValue: number;
  rewardGranted: boolean;
  rewardGrantedAt?: Date | null;

  // Blockchain Proof
  blockchainTxHash?: string | null;
  blockchainEventId?: string | null;
  blockchainVerified: boolean;
  blockchainNetwork?: string | null;

  // Leaderboard
  monthYear: string;

  // Fraud Prevention
  ipAddress?: string | null;
  deviceFingerprint?: string | null;
  isSuspicious: boolean;
  suspicionReasons: string[];

  // Audit
  appliedAt: Date;
  registeredAt?: Date | null;
  completedAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface UserReferralCode {
  id: string;
  userId: string;
  code: string;
  totalReferrals: number;
  activeReferrals: number;
  completedReferrals: number;
  totalRewardsEarned: number;
  onChainReferrals: number;
  walletAddress?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReferralInput {
  referrerId: string;
  referredId?: string;
  referralCode: string;
  ipAddress?: string;
  deviceFingerprint?: string;
}

export interface ReferralStats {
  totalReferrals: number;
  activeReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
  totalRewardsEarned: number;
  leaderboardRank?: number;
}
