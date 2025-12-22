/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AGROBRIDGE - REFERRAL SERVICE
 * Phase 3: Revenue Sprint - Blockchain-Verified Referral Program
 *
 * Features:
 * - Generate unique referral codes
 * - Track referrals with 30-day activity verification
 * - Blockchain proof of referral activity
 * - Transparent leaderboard (verifiable on-chain)
 * - Anti-fraud measures (Sybil attack prevention)
 *
 * @module referrals/services/referral
 * @version 1.0.0
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { PrismaClient, ReferralStatus, ReferralRewardType } from '@prisma/client';
import { ethers } from 'ethers';
import crypto from 'crypto';
import { logger } from '../../../infrastructure/logging/logger.js';
import { blockchainNotificationService } from '../../whatsapp-bot/services/blockchain-notification.service.js';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const config = {
  blockchain: {
    enabled: process.env.BLOCKCHAIN_ENABLED === 'true',
    rpcUrl: process.env.BLOCKCHAIN_RPC_URL || 'https://polygon-rpc.com',
    contractAddress: process.env.REFERRAL_CONTRACT_ADDRESS || '',
    privateKey: process.env.BLOCKCHAIN_PRIVATE_KEY || '',
    network: 'polygon',
  },
  rewards: {
    referrerDays: 30,     // Premium days for referrer
    referredDays: 30,     // Premium days for referred user
    activationDays: 30,   // Days of activity required
    minBatchesForActive: 5, // Minimum batches to be considered active
  },
  codeLength: 8,
  codePrefix: 'AB',
};

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ApplyReferralResult {
  success: boolean;
  referralId?: string;
  reward?: {
    type: ReferralRewardType;
    value: number;
    description: string;
  };
  error?: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  avatar?: string;
  activeReferrals: number;
  completedReferrals: number;
  totalPoints: number;
  blockchainVerified: boolean;
  walletAddress?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REFERRAL SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class ReferralService {
  private provider: ethers.providers.JsonRpcProvider | null = null;
  private wallet: ethers.Wallet | null = null;

  constructor() {
    if (config.blockchain.enabled && config.blockchain.privateKey) {
      this.initializeBlockchain();
    }
  }

  private async initializeBlockchain(): Promise<void> {
    try {
      this.provider = new ethers.providers.JsonRpcProvider(config.blockchain.rpcUrl);
      this.wallet = new ethers.Wallet(config.blockchain.privateKey, this.provider);
      logger.info('Referral blockchain service initialized');
    } catch (error) {
      logger.error('Failed to initialize blockchain for referrals', { error });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // REFERRAL CODE GENERATION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Generate or get referral code for a user
   */
  async getOrCreateReferralCode(userId: string): Promise<string> {
    // Check if user already has a code
    let userCode = await prisma.userReferralCode.findUnique({
      where: { userId },
    });

    if (userCode) {
      return userCode.code;
    }

    // Generate new unique code
    const code = await this.generateUniqueCode();

    // Get user's wallet address if available
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { walletAddress: true },
    });

    // Create the referral code record
    userCode = await prisma.userReferralCode.create({
      data: {
        userId,
        code,
        walletAddress: user?.walletAddress,
      },
    });

    logger.info('Referral code created', { userId, code });
    return userCode.code;
  }

  /**
   * Generate a unique referral code
   */
  private async generateUniqueCode(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      let code = config.codePrefix;
      for (let i = 0; i < config.codeLength; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }

      // Check if code exists
      const exists = await prisma.userReferralCode.findUnique({
        where: { code },
      });

      if (!exists) {
        return code;
      }

      attempts++;
    }

    // Fallback: use timestamp-based code
    return `${config.codePrefix}${Date.now().toString(36).toUpperCase()}`;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // APPLY REFERRAL CODE
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Apply a referral code for a new user
   */
  async applyReferralCode(
    newUserId: string,
    code: string,
    ipAddress?: string,
    deviceFingerprint?: string
  ): Promise<ApplyReferralResult> {
    try {
      // 1. Find the referrer by code
      const referrerCode = await prisma.userReferralCode.findUnique({
        where: { code: code.toUpperCase() },
      });

      if (!referrerCode) {
        return { success: false, error: 'Código de referido inválido' };
      }

      // 2. Check if user already has a referral
      const existingReferral = await prisma.referral.findFirst({
        where: { referredId: newUserId },
      });

      if (existingReferral) {
        return { success: false, error: 'Ya tienes un código de referido aplicado' };
      }

      // 3. Prevent self-referral
      if (referrerCode.userId === newUserId) {
        return { success: false, error: 'No puedes usar tu propio código' };
      }

      // 4. Get current month-year for leaderboard grouping
      const now = new Date();
      const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      // 5. Create referral record
      const referral = await prisma.referral.create({
        data: {
          referrerId: referrerCode.userId,
          referredId: newUserId,
          referralCode: code.toUpperCase(),
          status: ReferralStatus.REGISTERED,
          rewardType: ReferralRewardType.PREMIUM_DAYS,
          rewardValue: config.rewards.referredDays,
          monthYear,
          ipAddress,
          deviceFingerprint,
          registeredAt: new Date(),
        },
      });

      // 6. Update referrer's statistics
      await prisma.userReferralCode.update({
        where: { code: code.toUpperCase() },
        data: {
          totalReferrals: { increment: 1 },
        },
      });

      // 7. Register on blockchain (if enabled)
      let blockchainTx = null;
      if (config.blockchain.enabled && this.wallet) {
        blockchainTx = await this.registerReferralOnBlockchain(
          referrerCode.userId,
          newUserId,
          code.toUpperCase()
        );

        if (blockchainTx) {
          await prisma.referral.update({
            where: { id: referral.id },
            data: {
              blockchainTxHash: blockchainTx.txHash,
              blockchainEventId: blockchainTx.referralId,
              blockchainVerified: true,
              blockchainNetwork: config.blockchain.network,
            },
          });
        }
      }

      // 8. Grant immediate reward to referred user
      await this.grantPremiumDays(newUserId, config.rewards.referredDays);

      // 9. Grant immediate reward to referrer
      await this.grantPremiumDays(referrerCode.userId, config.rewards.referrerDays);

      // 10. Send WhatsApp notification to referrer
      await this.notifyReferrer(referral.id);

      logger.info('Referral applied successfully', {
        referralId: referral.id,
        referrerId: referrerCode.userId,
        referredId: newUserId,
        blockchainVerified: !!blockchainTx,
      });

      return {
        success: true,
        referralId: referral.id,
        reward: {
          type: ReferralRewardType.PREMIUM_DAYS,
          value: config.rewards.referredDays,
          description: `${config.rewards.referredDays} días de premium gratis`,
        },
      };
    } catch (error) {
      logger.error('Failed to apply referral code', { error, newUserId, code });
      return {
        success: false,
        error: 'Error al aplicar el código de referido',
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ACTIVITY TRACKING
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Record activity for a referred user
   */
  async recordActivity(
    userId: string,
    activityType: 'LOGIN' | 'BATCH_CREATED' | 'ORDER_COMPLETED'
  ): Promise<void> {
    const referral = await prisma.referral.findFirst({
      where: {
        referredId: userId,
        status: { in: [ReferralStatus.REGISTERED, ReferralStatus.ACTIVE] },
      },
    });

    if (!referral) return;

    const activityPoints = {
      LOGIN: 5,
      BATCH_CREATED: 20,
      ORDER_COMPLETED: 50,
    };

    const points = activityPoints[activityType] || 0;

    // Update activity score
    await prisma.referral.update({
      where: { id: referral.id },
      data: {
        activityScore: { increment: points },
        lastActivityAt: new Date(),
        loginCount: activityType === 'LOGIN' ? { increment: 1 } : undefined,
        batchesCreated: activityType === 'BATCH_CREATED' ? { increment: 1 } : undefined,
        status: ReferralStatus.ACTIVE,
      },
    });

    // Record on blockchain if enabled
    if (config.blockchain.enabled && referral.blockchainEventId) {
      await this.recordActivityOnBlockchain(referral.blockchainEventId, points);
    }
  }

  /**
   * Process referral completion (daily job)
   * Checks if referred users have been active for 30 days
   */
  async processReferralCompletions(): Promise<{ completed: number; errors: number }> {
    let completed = 0;
    let errors = 0;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - config.rewards.activationDays);

    // Find referrals eligible for completion
    const eligibleReferrals = await prisma.referral.findMany({
      where: {
        status: ReferralStatus.ACTIVE,
        registeredAt: { lte: cutoffDate },
        batchesCreated: { gte: config.rewards.minBatchesForActive },
      },
    });

    for (const referral of eligibleReferrals) {
      try {
        await prisma.referral.update({
          where: { id: referral.id },
          data: {
            status: ReferralStatus.COMPLETED,
            completedAt: new Date(),
          },
        });

        // Update referrer's completed count
        await prisma.userReferralCode.updateMany({
          where: { userId: referral.referrerId },
          data: {
            completedReferrals: { increment: 1 },
            activeReferrals: { increment: 1 },
          },
        });

        // Activate on blockchain
        if (config.blockchain.enabled && referral.blockchainEventId && this.wallet) {
          await this.activateReferralOnBlockchain(referral.blockchainEventId);
        }

        // Notify referrer
        await this.notifyReferralActivated(referral);

        completed++;
      } catch (error) {
        logger.error('Failed to complete referral', { error, referralId: referral.id });
        errors++;
      }
    }

    logger.info('Referral completion job finished', { completed, errors });
    return { completed, errors };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // LEADERBOARD
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Get monthly leaderboard
   */
  async getLeaderboard(
    month?: number,
    year?: number,
    limit: number = 20
  ): Promise<LeaderboardEntry[]> {
    const now = new Date();
    const targetMonth = month || now.getMonth() + 1;
    const targetYear = year || now.getFullYear();
    const monthYear = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;

    // Try to get from cached leaderboard first
    const cached = await prisma.referralLeaderboard.findMany({
      where: { monthYear },
      orderBy: { rank: 'asc' },
      take: limit,
    });

    if (cached.length > 0) {
      return cached.map((entry) => ({
        rank: entry.rank,
        userId: entry.userId,
        userName: entry.userName,
        avatar: entry.userAvatar || undefined,
        activeReferrals: entry.activeReferrals,
        completedReferrals: entry.completedReferrals,
        totalPoints: entry.totalPoints,
        blockchainVerified: entry.blockchainVerified,
        walletAddress: entry.walletAddress || undefined,
      }));
    }

    // Calculate leaderboard on-the-fly
    return this.calculateLeaderboard(monthYear, limit);
  }

  /**
   * Calculate leaderboard from referrals
   */
  private async calculateLeaderboard(
    monthYear: string,
    limit: number
  ): Promise<LeaderboardEntry[]> {
    const referralCodes = await prisma.userReferralCode.findMany({
      where: {
        activeReferrals: { gt: 0 },
      },
      orderBy: { activeReferrals: 'desc' },
      take: limit,
    });

    const entries: LeaderboardEntry[] = [];

    for (let i = 0; i < referralCodes.length; i++) {
      const code = referralCodes[i];
      const user = await prisma.user.findUnique({
        where: { id: code.userId },
        select: { firstName: true, lastName: true, walletAddress: true },
      });

      entries.push({
        rank: i + 1,
        userId: code.userId,
        userName: user ? `${user.firstName} ${user.lastName}` : 'Anonymous',
        activeReferrals: code.activeReferrals,
        completedReferrals: code.completedReferrals,
        totalPoints: code.activeReferrals * 100 + code.completedReferrals * 50,
        blockchainVerified: !!code.walletAddress,
        walletAddress: code.walletAddress || undefined,
      });
    }

    return entries;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // BLOCKCHAIN INTEGRATION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Register referral on blockchain
   */
  private async registerReferralOnBlockchain(
    referrerId: string,
    referredId: string,
    code: string
  ): Promise<{ txHash: string; referralId: string } | null> {
    if (!this.wallet || !config.blockchain.contractAddress) {
      return null;
    }

    try {
      // Get wallet addresses
      const referrer = await prisma.user.findUnique({
        where: { id: referrerId },
        select: { walletAddress: true },
      });
      const referred = await prisma.user.findUnique({
        where: { id: referredId },
        select: { walletAddress: true },
      });

      if (!referrer?.walletAddress || !referred?.walletAddress) {
        logger.info('Skipping blockchain registration - no wallet addresses');
        return null;
      }

      const abi = [
        'function createReferral(address referrer, address referred, string referralCode) returns (bytes32)',
        'event ReferralCreated(bytes32 indexed referralId, address indexed referrer, address indexed referred, string referralCode, uint256 timestamp)',
      ];

      const contract = new ethers.Contract(
        config.blockchain.contractAddress,
        abi,
        this.wallet
      );

      const tx = await contract.createReferral(
        referrer.walletAddress,
        referred.walletAddress,
        code
      );

      const receipt = await tx.wait();

      // Parse referral ID from event
      const event = receipt.events?.find((e: any) => e.event === 'ReferralCreated');
      const referralId = event?.args?.referralId;

      logger.info('Referral registered on blockchain', {
        txHash: receipt.transactionHash,
        referralId,
      });

      return {
        txHash: receipt.transactionHash,
        referralId: referralId?.toString() || '',
      };
    } catch (error) {
      logger.error('Failed to register referral on blockchain', { error });
      return null;
    }
  }

  /**
   * Record activity on blockchain
   */
  private async recordActivityOnBlockchain(
    referralId: string,
    points: number
  ): Promise<void> {
    if (!this.wallet || !config.blockchain.contractAddress) return;

    try {
      const abi = [
        'function recordActivity(bytes32 referralId, uint256 activityPoints)',
      ];

      const contract = new ethers.Contract(
        config.blockchain.contractAddress,
        abi,
        this.wallet
      );

      await contract.recordActivity(referralId, points);
    } catch (error) {
      logger.error('Failed to record activity on blockchain', { error });
    }
  }

  /**
   * Activate referral on blockchain (30-day milestone)
   */
  private async activateReferralOnBlockchain(referralId: string): Promise<void> {
    if (!this.wallet || !config.blockchain.contractAddress) return;

    try {
      const abi = ['function activateReferral(bytes32 referralId)'];

      const contract = new ethers.Contract(
        config.blockchain.contractAddress,
        abi,
        this.wallet
      );

      await contract.activateReferral(referralId);
      logger.info('Referral activated on blockchain', { referralId });
    } catch (error) {
      logger.error('Failed to activate referral on blockchain', { error });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // REWARDS & NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Grant premium days to a user
   */
  private async grantPremiumDays(userId: string, days: number): Promise<void> {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (subscription) {
      // Extend existing subscription
      const currentEnd = subscription.currentPeriodEnd || new Date();
      const newEnd = new Date(Math.max(currentEnd.getTime(), Date.now()));
      newEnd.setDate(newEnd.getDate() + days);

      await prisma.subscription.update({
        where: { userId },
        data: {
          currentPeriodEnd: newEnd,
          tier: 'PREMIUM', // Upgrade to premium
        },
      });
    }

    logger.info('Premium days granted', { userId, days });
  }

  /**
   * Notify referrer of successful referral
   */
  private async notifyReferrer(referralId: string): Promise<void> {
    const referral = await prisma.referral.findUnique({
      where: { id: referralId },
    });

    if (!referral) return;

    const phoneNumber = await blockchainNotificationService.getUserPhoneNumber(
      referral.referrerId
    );

    if (phoneNumber) {
      await blockchainNotificationService.sendReferralSuccessNotification(
        referralId,
        'un nuevo agricultor',
        `${config.rewards.referrerDays} días de premium gratis`,
        phoneNumber
      );
    }
  }

  /**
   * Notify referrer of 30-day activation
   */
  private async notifyReferralActivated(referral: any): Promise<void> {
    const phoneNumber = await blockchainNotificationService.getUserPhoneNumber(
      referral.referrerId
    );

    if (!phoneNumber) return;

    // Get referrer's stats
    const stats = await prisma.userReferralCode.findFirst({
      where: { userId: referral.referrerId },
    });

    // Get rank
    const rank = await prisma.userReferralCode.count({
      where: {
        activeReferrals: { gt: stats?.activeReferrals || 0 },
      },
    }) + 1;

    await blockchainNotificationService.sendReferralActivatedNotification(
      'un agricultor',
      stats?.activeReferrals || 1,
      rank,
      phoneNumber
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // FRAUD DETECTION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Check for suspicious referral patterns
   */
  async detectSuspiciousReferrals(): Promise<void> {
    // Find referrals with same IP
    const suspiciousByIp = await prisma.$queryRaw`
      SELECT "ipAddress", COUNT(*) as count
      FROM referrals
      WHERE "ipAddress" IS NOT NULL
      GROUP BY "ipAddress"
      HAVING COUNT(*) > 3
    `;

    // Find referrals with same device fingerprint
    const suspiciousByDevice = await prisma.$queryRaw`
      SELECT "deviceFingerprint", COUNT(*) as count
      FROM referrals
      WHERE "deviceFingerprint" IS NOT NULL
      GROUP BY "deviceFingerprint"
      HAVING COUNT(*) > 3
    `;

    // Mark suspicious referrals
    for (const row of suspiciousByIp as any[]) {
      await prisma.referral.updateMany({
        where: { ipAddress: row.ipAddress },
        data: {
          isSuspicious: true,
          suspicionReasons: ['MULTIPLE_REFERRALS_SAME_IP'],
        },
      });
    }

    logger.info('Fraud detection completed', {
      suspiciousIps: (suspiciousByIp as any[]).length,
      suspiciousDevices: (suspiciousByDevice as any[]).length,
    });
  }
}

// Export singleton instance
export const referralService = new ReferralService();
