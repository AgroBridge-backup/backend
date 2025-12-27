/**
 * Simple Credit Scoring Service
 * Rule-based scoring for farmer advance eligibility
 * No ML - uses platform behavior data
 *
 * @module credit-scoring/simple-scoring
 */

import { PrismaClient } from "@prisma/client";
import { logger } from "../../infrastructure/logging/logger.js";

const prisma = new PrismaClient();

// ============================================================================
// SCORING WEIGHTS CONFIGURATION
// ============================================================================

const SCORING_WEIGHTS = {
  repaymentHistory: 0.4, // 40% - Most important
  transactionFrequency: 0.2, // 20%
  profileCompleteness: 0.15, // 15%
  requestPattern: 0.15, // 15%
  externalSignals: 0.1, // 10%
};

const APPROVAL_THRESHOLDS = {
  autoApproveHigh: { minScore: 700, maxAmount: 10000 },
  autoApproveLow: { minScore: 500, maxAmount: 5000 },
  manualReview: { minScore: 300 },
  autoReject: { maxScore: 299 },
};

// ============================================================================
// TYPES
// ============================================================================

export interface CreditScoreResult {
  userId: string;
  producerId?: string;
  score: number; // 0-1000
  tier: "A" | "B" | "C" | "D";
  decision: "AUTO_APPROVE" | "MANUAL_REVIEW" | "AUTO_REJECT";
  maxApprovedAmount: number;
  factors: ScoreFactors;
  breakdown: ScoreBreakdown;
  calculatedAt: Date;
  validUntil: Date; // Score expires after 30 days
}

export interface ScoreFactors {
  repaymentHistory: RepaymentHistoryFactors;
  transactionFrequency: TransactionFactors;
  profileCompleteness: ProfileFactors;
  requestPattern: RequestPatternFactors;
  externalSignals: ExternalSignalFactors;
}

export interface RepaymentHistoryFactors {
  totalAdvances: number;
  successfulRepayments: number;
  onTimeRate: number; // Percentage
  avgDaysOverdue: number;
  hasDefaulted: boolean;
  rawScore: number; // 0-250
}

export interface TransactionFactors {
  activeDays90: number;
  listingsCreated: number;
  totalSalesVolume: number;
  accountAgeDays: number;
  rawScore: number; // 0-250
}

export interface ProfileFactors {
  phoneVerified: boolean;
  locationAdded: boolean;
  idUploaded: boolean;
  bankLinked: boolean;
  certificationsCount: number;
  rawScore: number; // 0-250
}

export interface RequestPatternFactors {
  requestAmountRatio: number; // Request / avg sale
  daysSinceLastRequest: number;
  requestFrequency: number; // Requests per month
  rawScore: number; // 0-250
}

export interface ExternalSignalFactors {
  isHarvestSeason: boolean;
  cropRiskFactor: number; // 0-1
  regionDefaultRate: number; // Historical %
  rawScore: number; // 0-250
}

export interface ScoreBreakdown {
  repaymentScore: number;
  transactionScore: number;
  profileScore: number;
  patternScore: number;
  externalScore: number;
  totalScore: number;
}

// ============================================================================
// MAIN SERVICE CLASS
// ============================================================================

export class SimpleCreditScoringService {
  /**
   * Calculate credit score for a user/producer
   */
  async calculateScore(userId: string): Promise<CreditScoreResult> {
    logger.info("[CreditScoring] Calculating score", { userId });

    const startTime = Date.now();

    // Get user and producer data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        producer: {
          include: {
            certifications: true,
            advances: {
              include: {
                transactions: true,
              },
            },
            orders: true,
          },
        },
        notificationPreferences: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const producer = user.producer;

    // Calculate each factor
    const factors: ScoreFactors = {
      repaymentHistory: await this.calculateRepaymentHistory(producer?.id),
      transactionFrequency: await this.calculateTransactionFrequency(
        producer?.id,
        user.createdAt,
      ),
      profileCompleteness: this.calculateProfileCompleteness(user, producer),
      requestPattern: await this.calculateRequestPattern(producer?.id),
      externalSignals: this.calculateExternalSignals(producer),
    };

    // Calculate weighted scores
    const breakdown: ScoreBreakdown = {
      repaymentScore:
        factors.repaymentHistory.rawScore * SCORING_WEIGHTS.repaymentHistory,
      transactionScore:
        factors.transactionFrequency.rawScore *
        SCORING_WEIGHTS.transactionFrequency,
      profileScore:
        factors.profileCompleteness.rawScore *
        SCORING_WEIGHTS.profileCompleteness,
      patternScore:
        factors.requestPattern.rawScore * SCORING_WEIGHTS.requestPattern,
      externalScore:
        factors.externalSignals.rawScore * SCORING_WEIGHTS.externalSignals,
      totalScore: 0,
    };

    breakdown.totalScore = Math.round(
      breakdown.repaymentScore +
        breakdown.transactionScore +
        breakdown.profileScore +
        breakdown.patternScore +
        breakdown.externalScore,
    );

    // Determine tier and decision
    const score = breakdown.totalScore;
    const tier = this.determineTier(score);
    const { decision, maxAmount } = this.determineDecision(score);

    const result: CreditScoreResult = {
      userId,
      producerId: producer?.id,
      score,
      tier,
      decision,
      maxApprovedAmount: maxAmount,
      factors,
      breakdown,
      calculatedAt: new Date(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    };

    // Store score in database
    await this.storeScore(result);

    const duration = Date.now() - startTime;
    logger.info("[CreditScoring] Score calculated", {
      userId,
      score,
      tier,
      decision,
      duration,
    });

    return result;
  }

  /**
   * Quick eligibility check without full calculation
   */
  async checkEligibility(
    userId: string,
    requestedAmount: number,
  ): Promise<{
    eligible: boolean;
    reason?: string;
    maxAmount?: number;
    requiresReview: boolean;
  }> {
    const score = await this.calculateScore(userId);

    if (score.decision === "AUTO_REJECT") {
      return {
        eligible: false,
        reason: "Credit score too low",
        requiresReview: false,
      };
    }

    if (requestedAmount > score.maxApprovedAmount) {
      if (score.decision === "MANUAL_REVIEW") {
        return {
          eligible: true,
          reason: "Amount exceeds auto-approval limit, requires review",
          maxAmount: score.maxApprovedAmount,
          requiresReview: true,
        };
      }
      return {
        eligible: false,
        reason: `Maximum approved amount is $${score.maxApprovedAmount.toLocaleString()}`,
        maxAmount: score.maxApprovedAmount,
        requiresReview: false,
      };
    }

    return {
      eligible: true,
      maxAmount: score.maxApprovedAmount,
      requiresReview: score.decision === "MANUAL_REVIEW",
    };
  }

  // ==========================================================================
  // FACTOR CALCULATIONS
  // ==========================================================================

  private async calculateRepaymentHistory(
    producerId?: string,
  ): Promise<RepaymentHistoryFactors> {
    if (!producerId) {
      return {
        totalAdvances: 0,
        successfulRepayments: 0,
        onTimeRate: 0,
        avgDaysOverdue: 0,
        hasDefaulted: false,
        rawScore: 100, // New users get neutral score
      };
    }

    const advances = await prisma.advanceContract.findMany({
      where: { farmerId: producerId },
    });

    const total = advances.length;
    const completed = advances.filter((a) => a.status === "COMPLETED").length;
    const defaulted = advances.filter((a) =>
      ["DEFAULTED", "IN_COLLECTIONS"].includes(a.status),
    ).length;

    // Calculate on-time rate
    const completedAdvances = advances.filter((a) => a.status === "COMPLETED");
    const onTimeCount = completedAdvances.filter((a) => {
      const repaidAt = a.repaidAt;
      return repaidAt && repaidAt <= a.dueDate;
    }).length;

    const onTimeRate =
      completedAdvances.length > 0
        ? (onTimeCount / completedAdvances.length) * 100
        : 100;

    // Calculate average days overdue
    let totalDaysOverdue = 0;
    completedAdvances.forEach((a) => {
      if (a.repaidAt && a.repaidAt > a.dueDate) {
        const daysOver = Math.floor(
          (a.repaidAt.getTime() - a.dueDate.getTime()) / (24 * 60 * 60 * 1000),
        );
        totalDaysOverdue += daysOver;
      }
    });
    const avgDaysOverdue =
      completedAdvances.length > 0
        ? totalDaysOverdue / completedAdvances.length
        : 0;

    // Calculate raw score (0-250)
    let rawScore = 250;

    // Deduct for defaults
    if (defaulted > 0) rawScore -= 100;

    // Deduct for low on-time rate
    rawScore -= (100 - onTimeRate) * 1.5;

    // Deduct for average days overdue
    rawScore -= avgDaysOverdue * 5;

    // Bonus for successful history
    if (total >= 3 && defaulted === 0 && onTimeRate >= 90) {
      rawScore += 50;
    }

    rawScore = Math.max(0, Math.min(250, rawScore));

    return {
      totalAdvances: total,
      successfulRepayments: completed,
      onTimeRate: Math.round(onTimeRate * 10) / 10,
      avgDaysOverdue: Math.round(avgDaysOverdue * 10) / 10,
      hasDefaulted: defaulted > 0,
      rawScore: Math.round(rawScore),
    };
  }

  private async calculateTransactionFrequency(
    producerId?: string,
    accountCreatedAt?: Date,
  ): Promise<TransactionFactors> {
    if (!producerId) {
      return {
        activeDays90: 0,
        listingsCreated: 0,
        totalSalesVolume: 0,
        accountAgeDays: 0,
        rawScore: 100,
      };
    }

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Count orders in last 90 days
    const recentOrders = await prisma.order.findMany({
      where: {
        producerId,
        createdAt: { gte: ninetyDaysAgo },
      },
    });

    const listingsCreated = recentOrders.length;
    const totalSalesVolume = recentOrders.reduce(
      (sum, o) => sum + o.totalAmount.toNumber(),
      0,
    );

    // Calculate unique active days
    const uniqueDays = new Set(
      recentOrders.map((o) => o.createdAt.toISOString().split("T")[0]),
    );
    const activeDays90 = uniqueDays.size;

    // Account age
    const accountAgeDays = accountCreatedAt
      ? Math.floor(
          (Date.now() - accountCreatedAt.getTime()) / (24 * 60 * 60 * 1000),
        )
      : 0;

    // Calculate raw score
    let rawScore = 100;

    // Bonus for activity
    rawScore += Math.min(50, activeDays90 * 2);

    // Bonus for listings
    rawScore += Math.min(50, listingsCreated * 5);

    // Bonus for volume (capped)
    rawScore += Math.min(30, totalSalesVolume / 10000);

    // Bonus for account age
    rawScore += Math.min(20, accountAgeDays / 30);

    rawScore = Math.max(0, Math.min(250, rawScore));

    return {
      activeDays90,
      listingsCreated,
      totalSalesVolume,
      accountAgeDays,
      rawScore: Math.round(rawScore),
    };
  }

  private calculateProfileCompleteness(
    user: any,
    producer: any,
  ): ProfileFactors {
    const prefs = user.notificationPreferences;

    const phoneVerified = prefs?.phoneVerified || false;
    const locationAdded = !!(producer?.latitude && producer?.longitude);
    const idUploaded = !!producer?.rfc;
    const bankLinked = false; // Would check payment methods
    const certificationsCount = producer?.certifications?.length || 0;

    // Calculate raw score
    let rawScore = 50; // Base score

    if (phoneVerified) rawScore += 40;
    if (locationAdded) rawScore += 30;
    if (idUploaded) rawScore += 50;
    if (bankLinked) rawScore += 40;
    rawScore += Math.min(40, certificationsCount * 20);

    rawScore = Math.min(250, rawScore);

    return {
      phoneVerified,
      locationAdded,
      idUploaded,
      bankLinked,
      certificationsCount,
      rawScore: Math.round(rawScore),
    };
  }

  private async calculateRequestPattern(
    producerId?: string,
  ): Promise<RequestPatternFactors> {
    if (!producerId) {
      return {
        requestAmountRatio: 1,
        daysSinceLastRequest: 999,
        requestFrequency: 0,
        rawScore: 150,
      };
    }

    // Get recent advances
    const advances = await prisma.advanceContract.findMany({
      where: { farmerId: producerId },
      orderBy: { requestedAt: "desc" },
      take: 10,
    });

    // Get average order value
    const orders = await prisma.order.findMany({
      where: { producerId },
    });
    const avgOrderValue =
      orders.length > 0
        ? orders.reduce((sum, o) => sum + o.totalAmount.toNumber(), 0) /
          orders.length
        : 10000;

    // Latest request
    const lastAdvance = advances[0];
    const daysSinceLastRequest = lastAdvance
      ? Math.floor(
          (Date.now() - lastAdvance.requestedAt.getTime()) /
            (24 * 60 * 60 * 1000),
        )
      : 999;

    // Request frequency (per month)
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    const recentAdvances = advances.filter(
      (a) => a.requestedAt >= sixMonthsAgo,
    );
    const requestFrequency = recentAdvances.length / 6;

    // Request amount ratio
    const lastRequestAmount = lastAdvance?.advanceAmount.toNumber() || 0;
    const requestAmountRatio =
      avgOrderValue > 0 ? lastRequestAmount / avgOrderValue : 1;

    // Calculate raw score
    let rawScore = 150;

    // Penalize very frequent requests
    if (requestFrequency > 2) rawScore -= 30;

    // Penalize very high request ratios
    if (requestAmountRatio > 1.5) rawScore -= 50;

    // Bonus for reasonable patterns
    if (requestAmountRatio <= 1 && requestFrequency <= 1) rawScore += 50;

    // Penalize if requesting again very soon
    if (daysSinceLastRequest < 14 && advances.length > 0) rawScore -= 30;

    rawScore = Math.max(0, Math.min(250, rawScore));

    return {
      requestAmountRatio: Math.round(requestAmountRatio * 100) / 100,
      daysSinceLastRequest,
      requestFrequency: Math.round(requestFrequency * 10) / 10,
      rawScore: Math.round(rawScore),
    };
  }

  private calculateExternalSignals(producer: any): ExternalSignalFactors {
    // Determine harvest season (Oct-Feb for avocados in Michoacán)
    const month = new Date().getMonth();
    const isHarvestSeason = month >= 9 || month <= 1;

    // Crop risk (simplified - would use historical data)
    const cropTypes = producer?.cropTypes || [];
    let cropRiskFactor = 0.5; // Default medium risk
    if (cropTypes.includes("HASS")) cropRiskFactor = 0.3; // Avocados are lower risk
    if (cropTypes.includes("BERRIES")) cropRiskFactor = 0.4;

    // Region default rate (would use actual data)
    const state = producer?.state || "";
    let regionDefaultRate = 5; // 5% default
    if (state === "Michoacán") regionDefaultRate = 3;
    if (state === "Jalisco") regionDefaultRate = 4;

    // Calculate raw score
    let rawScore = 150;

    // Bonus for harvest season
    if (isHarvestSeason) rawScore += 30;

    // Adjust for crop risk
    rawScore += (0.5 - cropRiskFactor) * 100;

    // Adjust for region
    rawScore -= regionDefaultRate * 5;

    rawScore = Math.max(0, Math.min(250, rawScore));

    return {
      isHarvestSeason,
      cropRiskFactor,
      regionDefaultRate,
      rawScore: Math.round(rawScore),
    };
  }

  // ==========================================================================
  // DECISION HELPERS
  // ==========================================================================

  private determineTier(score: number): "A" | "B" | "C" | "D" {
    if (score >= 800) return "A";
    if (score >= 600) return "B";
    if (score >= 400) return "C";
    return "D";
  }

  private determineDecision(score: number): {
    decision: "AUTO_APPROVE" | "MANUAL_REVIEW" | "AUTO_REJECT";
    maxAmount: number;
  } {
    if (score >= APPROVAL_THRESHOLDS.autoApproveHigh.minScore) {
      return {
        decision: "AUTO_APPROVE",
        maxAmount: APPROVAL_THRESHOLDS.autoApproveHigh.maxAmount,
      };
    }

    if (score >= APPROVAL_THRESHOLDS.autoApproveLow.minScore) {
      return {
        decision: "AUTO_APPROVE",
        maxAmount: APPROVAL_THRESHOLDS.autoApproveLow.maxAmount,
      };
    }

    if (score >= APPROVAL_THRESHOLDS.manualReview.minScore) {
      return {
        decision: "MANUAL_REVIEW",
        maxAmount: 2500,
      };
    }

    return {
      decision: "AUTO_REJECT",
      maxAmount: 0,
    };
  }

  // ==========================================================================
  // STORAGE
  // ==========================================================================

  private async storeScore(result: CreditScoreResult): Promise<void> {
    if (!result.producerId) return;

    try {
      const creditScore = await prisma.creditScore.upsert({
        where: { producerId: result.producerId },
        create: {
          producerId: result.producerId,
          overallScore: result.score,
          riskTier: result.tier === "A" ? "A" : result.tier === "B" ? "B" : "C",
          trend: "STABLE",
          lastCalculatedAt: result.calculatedAt,
          // Store individual scores
          deliveryScore: result.breakdown.transactionScore,
          qualityScore: result.breakdown.profileScore,
          paymentScore: result.breakdown.repaymentScore,
          volumeScore: result.breakdown.patternScore,
          blockchainScore: result.breakdown.externalScore,
        },
        update: {
          overallScore: result.score,
          riskTier: result.tier === "A" ? "A" : result.tier === "B" ? "B" : "C",
          lastCalculatedAt: result.calculatedAt,
          deliveryScore: result.breakdown.transactionScore,
          qualityScore: result.breakdown.profileScore,
          paymentScore: result.breakdown.repaymentScore,
          volumeScore: result.breakdown.patternScore,
          blockchainScore: result.breakdown.externalScore,
        },
      });

      // Add to history
      await prisma.creditScoreHistory.create({
        data: {
          creditScoreId: creditScore.id,
          overallScore: result.score,
          riskTier: result.tier === "A" ? "A" : result.tier === "B" ? "B" : "C",
          deliveryScore: result.breakdown.transactionScore,
          qualityScore: result.breakdown.profileScore,
          paymentScore: result.breakdown.repaymentScore,
          changeAmount: 0,
          changeReason: "Recalculated",
          triggerEvent: "MANUAL_CALCULATION",
        },
      });
    } catch (error) {
      logger.error("[CreditScoring] Failed to store score:", error);
    }
  }

  /**
   * Get stored score for a producer
   */
  async getStoredScore(producerId: string): Promise<CreditScoreResult | null> {
    const score = await prisma.creditScore.findUnique({
      where: { producerId },
    });

    if (!score) return null;

    // Check if score is still valid (within 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (score.lastCalculatedAt < thirtyDaysAgo) {
      return null; // Score expired, need recalculation
    }

    const overallScore = score.overallScore.toNumber();
    const deliveryScore = score.deliveryScore.toNumber();
    const qualityScore = score.qualityScore.toNumber();
    const paymentScore = score.paymentScore.toNumber();
    const volumeScore = score.volumeScore.toNumber();
    const blockchainScore = score.blockchainScore.toNumber();

    return {
      userId: "",
      producerId,
      score: overallScore,
      tier: score.riskTier as "A" | "B" | "C",
      decision: this.determineDecision(overallScore).decision,
      maxApprovedAmount: this.determineDecision(overallScore).maxAmount,
      factors: {
        repaymentHistory: {
          totalAdvances:
            score.advancesCompleted +
            score.advancesActive +
            score.advancesDefaulted,
          successfulRepayments: score.advancesCompleted,
          onTimeRate: 100 - score.advanceDefaultRate.toNumber() * 100,
          avgDaysOverdue: score.averageRepaymentDelay,
          hasDefaulted: score.advancesDefaulted > 0,
          rawScore: paymentScore,
        },
        transactionFrequency: {
          activeDays90: score.daysActive,
          listingsCreated: score.totalOrdersCompleted,
          totalSalesVolume: score.totalValueDelivered.toNumber(),
          accountAgeDays: score.accountAgeDays,
          rawScore: deliveryScore,
        },
        profileCompleteness: {
          phoneVerified: true,
          locationAdded: true,
          idUploaded: true,
          bankLinked: false,
          certificationsCount: 0,
          rawScore: qualityScore,
        },
        requestPattern: {
          requestAmountRatio: 1,
          daysSinceLastRequest: 30,
          requestFrequency: score.activityFrequency.toNumber(),
          rawScore: volumeScore,
        },
        externalSignals: {
          isHarvestSeason: false,
          cropRiskFactor: 0.5,
          regionDefaultRate: 5,
          rawScore: blockchainScore,
        },
      },
      breakdown: {
        repaymentScore: paymentScore,
        transactionScore: deliveryScore,
        profileScore: qualityScore,
        patternScore: volumeScore,
        externalScore: blockchainScore,
        totalScore: overallScore,
      },
      calculatedAt: score.lastCalculatedAt,
      validUntil: new Date(
        score.lastCalculatedAt.getTime() + 30 * 24 * 60 * 60 * 1000,
      ),
    };
  }
}

// Export singleton
export const simpleCreditScoringService = new SimpleCreditScoringService();
