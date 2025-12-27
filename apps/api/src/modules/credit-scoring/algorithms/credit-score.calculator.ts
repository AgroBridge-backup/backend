/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AGROBRIDGE - CREDIT SCORE CALCULATOR
 * Blockchain-Based Credit Scoring Algorithm v1.0
 *
 * Algorithm: Weighted Composite Score (0-100)
 * - Delivery success rate: 40%
 * - Quality score: 25%
 * - Payment history: 20%
 * - Volume/experience: 10%
 * - Blockchain verifications: 5%
 *
 * @module credit-scoring/algorithms
 * @version 1.0.0
 * @author Dr. Sofia Rodriguez (Square Capital ML Engineer)
 *
 * DESIGN PRINCIPLES:
 * 1. DETERMINISTIC: Same input = same score (no randomness)
 * 2. EXPLAINABLE: Every score component is traceable
 * 3. PERFORMANT: <500ms calculation time
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import {
  ComponentScores,
  CreditScoreResult,
  DeliveryMetrics,
  QualityMetrics,
  PaymentMetrics,
  ActivityMetrics,
  BlockchainMetrics,
  ScoringFactor,
  ScoreRecommendation,
  RiskTier,
  ScoreTrend,
  SCORE_WEIGHTS,
  CREDIT_LIMITS,
  clampScore,
  getRiskTierFromScore,
  getScoreTrend,
} from "../types/credit-score.types.js";

/**
 * Credit Score Calculator
 *
 * Implements a deterministic, explainable credit scoring algorithm
 * specifically designed for agricultural financing.
 */
export class CreditScoreCalculator {
  private readonly modelVersion = "1.0.0";
  private readonly startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Calculate complete credit score from all metrics
   */
  public calculate(
    producerId: string,
    deliveryMetrics: DeliveryMetrics,
    qualityMetrics: QualityMetrics,
    paymentMetrics: PaymentMetrics,
    activityMetrics: ActivityMetrics,
    blockchainMetrics: BlockchainMetrics,
    previousScores?: {
      score7DaysAgo?: number;
      score30DaysAgo?: number;
      score90DaysAgo?: number;
    },
  ): CreditScoreResult {
    // Calculate component scores
    const componentScores = this.calculateComponentScores(
      deliveryMetrics,
      qualityMetrics,
      paymentMetrics,
      activityMetrics,
      blockchainMetrics,
    );

    // Calculate weighted overall score
    const overallScore = this.calculateWeightedScore(componentScores);

    // Determine risk tier
    const riskTier = getRiskTierFromScore(overallScore);

    // Calculate credit limits based on tier and score
    const creditLimits = this.calculateCreditLimits(
      riskTier,
      overallScore,
      paymentMetrics,
    );

    // Calculate score changes
    const scoreChanges = this.calculateScoreChanges(
      overallScore,
      previousScores?.score7DaysAgo,
      previousScores?.score30DaysAgo,
      previousScores?.score90DaysAgo,
    );

    // Determine trend
    const trend = getScoreTrend(
      scoreChanges.last7Days,
      scoreChanges.last30Days,
      scoreChanges.last90Days,
    );

    // Generate scoring factors (explanation)
    const scoringFactors = this.generateScoringFactors(
      componentScores,
      deliveryMetrics,
      qualityMetrics,
      paymentMetrics,
      activityMetrics,
      blockchainMetrics,
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      componentScores,
      deliveryMetrics,
      qualityMetrics,
      paymentMetrics,
      blockchainMetrics,
    );

    // Calculate confidence level
    const confidenceLevel = this.calculateConfidenceLevel(
      deliveryMetrics,
      activityMetrics,
      blockchainMetrics,
    );

    const calculationDurationMs = Date.now() - this.startTime;

    return {
      producerId,
      overallScore,
      riskTier,
      componentScores,
      creditLimits,
      scoreChanges,
      trend,
      metrics: {
        delivery: deliveryMetrics,
        quality: qualityMetrics,
        payment: paymentMetrics,
        activity: activityMetrics,
        blockchain: blockchainMetrics,
      },
      metadata: {
        modelVersion: this.modelVersion,
        calculatedAt: new Date(),
        calculationDurationMs,
        dataSources: ["blockchain", "orders", "deliveries", "payments"],
        confidenceLevel,
      },
      scoringFactors,
      recommendations,
    };
  }

  /**
   * Calculate individual component scores
   */
  private calculateComponentScores(
    delivery: DeliveryMetrics,
    quality: QualityMetrics,
    payment: PaymentMetrics,
    activity: ActivityMetrics,
    blockchain: BlockchainMetrics,
  ): ComponentScores {
    return {
      delivery: this.calculateDeliveryScore(delivery),
      quality: this.calculateQualityScore(quality),
      payment: this.calculatePaymentScore(payment),
      volume: this.calculateVolumeScore(activity, delivery),
      blockchain: this.calculateBlockchainScore(blockchain),
    };
  }

  /**
   * Calculate delivery performance score (0-100)
   *
   * Factors:
   * - Success rate (70% weight)
   * - On-time delivery rate (20% weight)
   * - Average delay penalty (10% weight)
   */
  private calculateDeliveryScore(metrics: DeliveryMetrics): number {
    // New producers get a neutral score
    if (metrics.totalCompleted === 0) {
      return 50; // Neutral starting point
    }

    // Success rate component (0-70 points)
    const successScore = (metrics.successRate / 100) * 70;

    // On-time delivery component (0-20 points)
    const onTimeScore = (metrics.onTimeRate / 100) * 20;

    // Delay penalty (0-10 points, deducted for avg delays)
    // No penalty for early/on-time, penalty increases with delay
    let delayScore = 10;
    if (metrics.averageDelayDays > 0) {
      // Deduct 2 points per day of average delay, max 10
      delayScore = Math.max(0, 10 - metrics.averageDelayDays * 2);
    }

    const rawScore = successScore + onTimeScore + delayScore;
    return clampScore(rawScore);
  }

  /**
   * Calculate quality score (0-100)
   *
   * Factors:
   * - Average quality grade (60% weight)
   * - Consistency (standard deviation) (25% weight)
   * - Trend bonus/penalty (15% weight)
   */
  private calculateQualityScore(metrics: QualityMetrics): number {
    // New producers with no inspections get neutral score
    if (metrics.inspectionCount === 0) {
      return 50;
    }

    // Average quality component (0-60 points)
    const avgScore = (metrics.averageScore / 100) * 60;

    // Consistency component (0-25 points)
    // Lower std deviation = higher score
    // Perfect consistency (0 std dev) = 25 points
    // High inconsistency (>20 std dev) = 0 points
    const consistencyScore = Math.max(0, 25 - metrics.standardDeviation * 1.25);

    // Trend component (0-15 points)
    let trendScore = 7.5; // Neutral
    if (metrics.trend === ScoreTrend.IMPROVING) {
      trendScore = 15;
    } else if (metrics.trend === ScoreTrend.DECLINING) {
      trendScore = 0;
    }

    const rawScore = avgScore + consistencyScore + trendScore;
    return clampScore(rawScore);
  }

  /**
   * Calculate payment history score (0-100)
   *
   * Factors:
   * - Advance completion rate (50% weight)
   * - Repayment timeliness (30% weight)
   * - No default history bonus (20% weight)
   */
  private calculatePaymentScore(metrics: PaymentMetrics): number {
    // No payment history = neutral score (new to advances)
    if (metrics.advancesCompleted === 0 && metrics.advancesDefaulted === 0) {
      return 60; // Slightly positive for new users
    }

    const totalAdvances = metrics.advancesCompleted + metrics.advancesDefaulted;

    // Completion rate component (0-50 points)
    const completionRate =
      totalAdvances > 0
        ? (metrics.advancesCompleted / totalAdvances) * 100
        : 100;
    const completionScore = (completionRate / 100) * 50;

    // Repayment timeliness (0-30 points)
    // On-time or early = 30 points
    // Deduct 3 points per day of average delay
    let timelinessScore = 30;
    if (metrics.averageRepaymentDelay > 0) {
      timelinessScore = Math.max(0, 30 - metrics.averageRepaymentDelay * 3);
    }

    // No default bonus (0-20 points)
    // Full bonus if 0 defaults, scaled down based on default rate
    const noDefaultScore =
      metrics.defaultRate === 0
        ? 20
        : Math.max(0, 20 - metrics.defaultRate * 200);

    const rawScore = completionScore + timelinessScore + noDefaultScore;
    return clampScore(rawScore);
  }

  /**
   * Calculate volume/experience score (0-100)
   *
   * Factors:
   * - Account age (30% weight)
   * - Activity frequency (35% weight)
   * - Total value delivered (35% weight)
   */
  private calculateVolumeScore(
    activity: ActivityMetrics,
    delivery: DeliveryMetrics,
  ): number {
    // Account age component (0-30 points)
    // Full score at 365 days, scaled below that
    const ageScore = Math.min(30, (activity.accountAgeDays / 365) * 30);

    // Activity frequency component (0-35 points)
    // Full score at 4+ orders/month, scaled below
    const frequencyScore = Math.min(35, (activity.ordersPerMonth / 4) * 35);

    // Volume component (0-35 points)
    // Full score at $100K+ delivered, scaled below
    const volumeScore = Math.min(35, (delivery.totalValueUSD / 100000) * 35);

    const rawScore = ageScore + frequencyScore + volumeScore;
    return clampScore(rawScore);
  }

  /**
   * Calculate blockchain verification score (0-100)
   *
   * Factors:
   * - Verification rate (70% weight)
   * - Minimum verifications threshold (30% weight)
   */
  private calculateBlockchainScore(metrics: BlockchainMetrics): number {
    // No transactions = neutral
    if (metrics.totalTransactions === 0) {
      return 50;
    }

    // Verification rate component (0-70 points)
    const rateScore = (metrics.verificationRate / 100) * 70;

    // Minimum verifications threshold (0-30 points)
    // Full score at 10+ verifications
    const thresholdScore = Math.min(
      30,
      (metrics.verifiedTransactions / 10) * 30,
    );

    const rawScore = rateScore + thresholdScore;
    return clampScore(rawScore);
  }

  /**
   * Calculate weighted overall score
   */
  private calculateWeightedScore(components: ComponentScores): number {
    const weightedSum =
      components.delivery * (SCORE_WEIGHTS.DELIVERY / 100) +
      components.quality * (SCORE_WEIGHTS.QUALITY / 100) +
      components.payment * (SCORE_WEIGHTS.PAYMENT / 100) +
      components.volume * (SCORE_WEIGHTS.VOLUME / 100) +
      components.blockchain * (SCORE_WEIGHTS.BLOCKCHAIN / 100);

    return clampScore(Math.round(weightedSum * 100) / 100);
  }

  /**
   * Calculate credit limits based on tier and score
   */
  private calculateCreditLimits(
    tier: RiskTier,
    score: number,
    paymentMetrics: PaymentMetrics,
  ): CreditScoreResult["creditLimits"] {
    const tierLimits = CREDIT_LIMITS[tier];

    // Base max from tier, adjusted by score within tier
    let maxAdvanceAmount = tierLimits.maxAdvanceAmount;

    // Score modifier: scale within tier range
    // For Tier A (90-100): full amount at 100, 90% at 90
    // For Tier B (70-89): full amount at 89, 70% at 70
    // For Tier C (<70): full amount at 69, scaled down
    const tierMin = tier === RiskTier.A ? 90 : tier === RiskTier.B ? 70 : 0;
    const tierMax = tier === RiskTier.A ? 100 : tier === RiskTier.B ? 89 : 69;
    const tierRange = tierMax - tierMin;
    const scoreWithinTier = score - tierMin;
    const tierScoreRatio = tierRange > 0 ? scoreWithinTier / tierRange : 1;

    // Scale amount: 70% base + 30% based on position in tier
    maxAdvanceAmount = maxAdvanceAmount * (0.7 + 0.3 * tierScoreRatio);

    // Current utilization from active advances
    const currentUtilization =
      paymentMetrics.totalBorrowed - paymentMetrics.totalRepaid;
    const availableCredit = Math.max(0, maxAdvanceAmount - currentUtilization);
    const utilizationRate =
      maxAdvanceAmount > 0 ? (currentUtilization / maxAdvanceAmount) * 100 : 0;

    return {
      maxAdvancePercentage: tierLimits.maxAdvancePercentage,
      maxAdvanceAmount: Math.round(maxAdvanceAmount * 100) / 100,
      currentUtilization: Math.round(currentUtilization * 100) / 100,
      availableCredit: Math.round(availableCredit * 100) / 100,
      utilizationRate: Math.round(utilizationRate * 100) / 100,
    };
  }

  /**
   * Calculate score changes over time
   */
  private calculateScoreChanges(
    currentScore: number,
    score7DaysAgo?: number,
    score30DaysAgo?: number,
    score90DaysAgo?: number,
  ): CreditScoreResult["scoreChanges"] {
    return {
      last7Days: score7DaysAgo !== undefined ? currentScore - score7DaysAgo : 0,
      last30Days:
        score30DaysAgo !== undefined ? currentScore - score30DaysAgo : 0,
      last90Days:
        score90DaysAgo !== undefined ? currentScore - score90DaysAgo : 0,
    };
  }

  /**
   * Generate scoring factors (explainability)
   */
  private generateScoringFactors(
    components: ComponentScores,
    delivery: DeliveryMetrics,
    quality: QualityMetrics,
    payment: PaymentMetrics,
    activity: ActivityMetrics,
    blockchain: BlockchainMetrics,
  ): ScoringFactor[] {
    const factors: ScoringFactor[] = [];

    // Delivery factors
    if (delivery.successRate >= 95) {
      factors.push({
        name: "Excellent Delivery Rate",
        impact: 10,
        category: "positive",
        description: `${delivery.successRate.toFixed(1)}% delivery success rate`,
        weight: SCORE_WEIGHTS.DELIVERY,
      });
    } else if (delivery.successRate < 80) {
      factors.push({
        name: "Low Delivery Rate",
        impact: -15,
        category: "negative",
        description: `${delivery.successRate.toFixed(1)}% delivery success rate needs improvement`,
        weight: SCORE_WEIGHTS.DELIVERY,
      });
    }

    // On-time delivery
    if (delivery.onTimeRate >= 90) {
      factors.push({
        name: "Reliable Timing",
        impact: 5,
        category: "positive",
        description: `${delivery.onTimeRate.toFixed(1)}% on-time delivery rate`,
        weight: SCORE_WEIGHTS.DELIVERY,
      });
    }

    // Quality factors
    if (quality.averageScore >= 90) {
      factors.push({
        name: "Premium Quality",
        impact: 8,
        category: "positive",
        description: `Average quality score of ${quality.averageScore.toFixed(1)}`,
        weight: SCORE_WEIGHTS.QUALITY,
      });
    } else if (quality.averageScore < 70) {
      factors.push({
        name: "Quality Concerns",
        impact: -10,
        category: "negative",
        description: `Average quality score of ${quality.averageScore.toFixed(1)} below standards`,
        weight: SCORE_WEIGHTS.QUALITY,
      });
    }

    // Consistency factor
    if (quality.standardDeviation < 5) {
      factors.push({
        name: "Consistent Quality",
        impact: 5,
        category: "positive",
        description: "Low variance in quality scores shows reliability",
        weight: SCORE_WEIGHTS.QUALITY,
      });
    }

    // Payment history factors
    if (payment.advancesCompleted > 0 && payment.defaultRate === 0) {
      factors.push({
        name: "Perfect Payment Record",
        impact: 15,
        category: "positive",
        description: `${payment.advancesCompleted} advances completed with zero defaults`,
        weight: SCORE_WEIGHTS.PAYMENT,
      });
    } else if (payment.defaultRate > 0.05) {
      factors.push({
        name: "Default History",
        impact: -20,
        category: "negative",
        description: `${(payment.defaultRate * 100).toFixed(1)}% default rate on advances`,
        weight: SCORE_WEIGHTS.PAYMENT,
      });
    }

    // Experience factors
    if (activity.accountAgeDays >= 365) {
      factors.push({
        name: "Established Producer",
        impact: 5,
        category: "positive",
        description: `Active for ${Math.floor(activity.accountAgeDays / 365)} year(s)`,
        weight: SCORE_WEIGHTS.VOLUME,
      });
    } else if (activity.accountAgeDays < 90) {
      factors.push({
        name: "New Producer",
        impact: -5,
        category: "neutral",
        description: "Limited history available for assessment",
        weight: SCORE_WEIGHTS.VOLUME,
      });
    }

    // Blockchain verification
    if (blockchain.verificationRate >= 95) {
      factors.push({
        name: "Fully Verified",
        impact: 3,
        category: "positive",
        description: `${blockchain.verificationRate.toFixed(1)}% blockchain verification rate`,
        weight: SCORE_WEIGHTS.BLOCKCHAIN,
      });
    } else if (blockchain.verificationRate < 50) {
      factors.push({
        name: "Low Verification",
        impact: -5,
        category: "negative",
        description: "Many transactions lack blockchain verification",
        weight: SCORE_WEIGHTS.BLOCKCHAIN,
      });
    }

    // Sort by absolute impact
    return factors.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  }

  /**
   * Generate recommendations for score improvement
   */
  private generateRecommendations(
    components: ComponentScores,
    delivery: DeliveryMetrics,
    quality: QualityMetrics,
    payment: PaymentMetrics,
    blockchain: BlockchainMetrics,
  ): ScoreRecommendation[] {
    const recommendations: ScoreRecommendation[] = [];

    // Delivery recommendations
    if (components.delivery < 70) {
      recommendations.push({
        id: "improve-delivery-rate",
        priority: "high",
        action:
          "Focus on completing deliveries successfully to improve your delivery score",
        expectedImpact: 15,
        category: "delivery",
      });
    }

    if (delivery.onTimeRate < 80) {
      recommendations.push({
        id: "improve-timing",
        priority: "medium",
        action:
          "Improve delivery timing by better planning and earlier shipments",
        expectedImpact: 8,
        category: "delivery",
      });
    }

    // Quality recommendations
    if (components.quality < 70) {
      recommendations.push({
        id: "improve-quality",
        priority: "high",
        action:
          "Invest in quality control processes to improve product quality scores",
        expectedImpact: 12,
        category: "quality",
      });
    }

    if (quality.standardDeviation > 15) {
      recommendations.push({
        id: "improve-consistency",
        priority: "medium",
        action: "Standardize processes to achieve more consistent quality",
        expectedImpact: 5,
        category: "quality",
      });
    }

    // Payment recommendations
    if (payment.averageRepaymentDelay > 3) {
      recommendations.push({
        id: "faster-repayment",
        priority: "high",
        action:
          "Pay advance repayments on time or early to boost payment score",
        expectedImpact: 10,
        category: "payment",
      });
    }

    // Blockchain recommendations
    if (blockchain.verificationRate < 80) {
      recommendations.push({
        id: "increase-verification",
        priority: "low",
        action:
          "Ensure all transactions are recorded on blockchain for verification",
        expectedImpact: 3,
        category: "blockchain",
      });
    }

    // Volume recommendations
    if (components.volume < 50) {
      recommendations.push({
        id: "increase-activity",
        priority: "low",
        action: "Increase order frequency and volume to build track record",
        expectedImpact: 5,
        category: "volume",
      });
    }

    // Sort by expected impact
    return recommendations
      .sort((a, b) => b.expectedImpact - a.expectedImpact)
      .slice(0, 5);
  }

  /**
   * Calculate confidence level in the score
   *
   * Based on:
   * - Amount of historical data
   * - Recency of data
   * - Blockchain verification coverage
   */
  private calculateConfidenceLevel(
    delivery: DeliveryMetrics,
    activity: ActivityMetrics,
    blockchain: BlockchainMetrics,
  ): number {
    let confidence = 0;

    // Data volume factor (0-40 points)
    // More data = more confidence
    const dataVolume = delivery.totalCompleted;
    if (dataVolume >= 50) {
      confidence += 40;
    } else if (dataVolume >= 20) {
      confidence += 30;
    } else if (dataVolume >= 10) {
      confidence += 20;
    } else if (dataVolume >= 5) {
      confidence += 10;
    }

    // Account age factor (0-30 points)
    if (activity.accountAgeDays >= 365) {
      confidence += 30;
    } else if (activity.accountAgeDays >= 180) {
      confidence += 20;
    } else if (activity.accountAgeDays >= 90) {
      confidence += 15;
    } else if (activity.accountAgeDays >= 30) {
      confidence += 5;
    }

    // Blockchain verification factor (0-30 points)
    confidence += Math.min(30, (blockchain.verificationRate / 100) * 30);

    return clampScore(confidence);
  }

  /**
   * Simulate score with hypothetical changes
   */
  public simulateScore(
    currentResult: CreditScoreResult,
    changes: {
      additionalSuccessfulDeliveries?: number;
      additionalDefaultedDeliveries?: number;
      qualityImprovement?: number;
      completedAdvanceRepayments?: number;
      additionalBlockchainVerifications?: number;
    },
  ): {
    currentScore: number;
    projectedScore: number;
    scoreDifference: number;
    currentTier: RiskTier;
    projectedTier: RiskTier;
    tierChange: boolean;
  } {
    // Clone current metrics
    const newDelivery = { ...currentResult.metrics.delivery };
    const newQuality = { ...currentResult.metrics.quality };
    const newPayment = { ...currentResult.metrics.payment };
    const newBlockchain = { ...currentResult.metrics.blockchain };

    // Apply changes
    if (changes.additionalSuccessfulDeliveries) {
      newDelivery.totalCompleted += changes.additionalSuccessfulDeliveries;
      newDelivery.successRate =
        (newDelivery.totalCompleted /
          (newDelivery.totalCompleted + newDelivery.totalDefaulted)) *
        100;
    }

    if (changes.additionalDefaultedDeliveries) {
      newDelivery.totalDefaulted += changes.additionalDefaultedDeliveries;
      newDelivery.successRate =
        (newDelivery.totalCompleted /
          (newDelivery.totalCompleted + newDelivery.totalDefaulted)) *
        100;
    }

    if (changes.qualityImprovement) {
      newQuality.averageScore = Math.min(
        100,
        newQuality.averageScore + changes.qualityImprovement,
      );
    }

    if (changes.completedAdvanceRepayments) {
      newPayment.advancesCompleted += changes.completedAdvanceRepayments;
      const totalAdvances =
        newPayment.advancesCompleted + newPayment.advancesDefaulted;
      newPayment.defaultRate =
        totalAdvances > 0 ? newPayment.advancesDefaulted / totalAdvances : 0;
    }

    if (changes.additionalBlockchainVerifications) {
      newBlockchain.verifiedTransactions +=
        changes.additionalBlockchainVerifications;
      newBlockchain.totalTransactions +=
        changes.additionalBlockchainVerifications;
      newBlockchain.verificationRate =
        (newBlockchain.verifiedTransactions / newBlockchain.totalTransactions) *
        100;
    }

    // Recalculate
    const newComponents = this.calculateComponentScores(
      newDelivery,
      newQuality,
      newPayment,
      currentResult.metrics.activity,
      newBlockchain,
    );
    const projectedScore = this.calculateWeightedScore(newComponents);
    const projectedTier = getRiskTierFromScore(projectedScore);

    return {
      currentScore: currentResult.overallScore,
      projectedScore,
      scoreDifference: projectedScore - currentResult.overallScore,
      currentTier: currentResult.riskTier,
      projectedTier,
      tierChange: projectedTier !== currentResult.riskTier,
    };
  }
}

/**
 * Factory function to create calculator instance
 */
export function createCreditScoreCalculator(): CreditScoreCalculator {
  return new CreditScoreCalculator();
}
