/**
 * Referral Repository Interface
 * Defines the contract for referral data access
 */

import {
  Referral,
  ReferralStatus,
  ReferralRewardType,
  UserReferralCode,
  ReferralStats,
} from "../entities/Referral.js";

export interface CreateReferralData {
  id: string;
  referrerId: string;
  referredId?: string;
  referralCode: string;
  status: ReferralStatus;
  monthYear: string;
  ipAddress?: string;
  deviceFingerprint?: string;
  rewardType?: ReferralRewardType;
  rewardValue?: number;
}

export interface UpdateReferralData {
  referredId?: string;
  status?: ReferralStatus;
  activityScore?: number;
  batchesCreated?: number;
  loginCount?: number;
  lastActivityAt?: Date;
  rewardGranted?: boolean;
  rewardGrantedAt?: Date;
  blockchainTxHash?: string;
  blockchainEventId?: string;
  blockchainVerified?: boolean;
  blockchainNetwork?: string;
  registeredAt?: Date;
  completedAt?: Date;
  isSuspicious?: boolean;
  suspicionReasons?: string[];
}

export interface IReferralRepository {
  /**
   * Create a new referral
   */
  create(data: CreateReferralData): Promise<Referral>;

  /**
   * Find referral by ID
   */
  findById(id: string): Promise<Referral | null>;

  /**
   * Find referral by referred user ID
   */
  findByReferredUser(referredId: string): Promise<Referral | null>;

  /**
   * List referrals by referrer
   */
  listByReferrer(referrerId: string): Promise<Referral[]>;

  /**
   * List referrals by referrer with status filter
   */
  listByReferrerWithStatus(
    referrerId: string,
    status: ReferralStatus,
  ): Promise<Referral[]>;

  /**
   * Update referral
   */
  update(id: string, data: UpdateReferralData): Promise<Referral>;

  /**
   * Mark referral as rewarded
   */
  markRewarded(id: string, rewardTxHash?: string): Promise<Referral>;

  /**
   * Increment activity score
   */
  incrementActivityScore(id: string, points: number): Promise<Referral>;

  /**
   * Get referral stats for a referrer
   */
  getStatsForReferrer(referrerId: string): Promise<ReferralStats>;

  /**
   * Get or create user referral code
   */
  getOrCreateUserReferralCode(userId: string): Promise<UserReferralCode>;

  /**
   * Find user referral code by code string
   */
  findUserReferralCodeByCode(code: string): Promise<UserReferralCode | null>;

  /**
   * Update user referral code stats
   */
  updateUserReferralCodeStats(
    userId: string,
    updates: {
      totalReferrals?: number;
      activeReferrals?: number;
      completedReferrals?: number;
      totalRewardsEarned?: number;
      onChainReferrals?: number;
    },
  ): Promise<UserReferralCode>;

  /**
   * Get leaderboard for a month
   */
  getLeaderboard(
    monthYear: string,
    limit?: number,
  ): Promise<
    Array<{
      rank: number;
      userId: string;
      userName: string;
      activeReferrals: number;
      completedReferrals: number;
      totalPoints: number;
      blockchainVerified: boolean;
    }>
  >;

  /**
   * Count referrals by referrer for a specific month
   */
  countByReferrerAndMonth(
    referrerId: string,
    monthYear: string,
  ): Promise<number>;
}
