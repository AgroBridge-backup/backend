/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AGROBRIDGE - CREDIT SCORE CALCULATOR TESTS
 * Unit Tests for Credit Scoring Algorithm
 *
 * @module tests/unit/cash-flow-bridge
 * @version 1.0.0
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CreditScoreCalculator,
  createCreditScoreCalculator,
} from '../../../src/modules/credit-scoring/algorithms/credit-score.calculator.js';
import {
  DeliveryMetrics,
  QualityMetrics,
  PaymentMetrics,
  ActivityMetrics,
  BlockchainMetrics,
  RiskTier,
  ScoreTrend,
} from '../../../src/modules/credit-scoring/types/credit-score.types.js';

describe('CreditScoreCalculator', () => {
  let calculator: CreditScoreCalculator;

  // Default test metrics
  const defaultDeliveryMetrics: DeliveryMetrics = {
    totalCompleted: 50,
    totalDefaulted: 2,
    totalCancelled: 3,
    successRate: 96.15,
    averageDelayDays: 0.5,
    onTimeRate: 92,
    totalVolumeKg: 50000,
    totalValueUSD: 150000,
    averageOrderValue: 3000,
  };

  const defaultQualityMetrics: QualityMetrics = {
    averageScore: 88,
    standardDeviation: 4.5,
    trend: ScoreTrend.STABLE,
    inspectionCount: 45,
    gradeDistribution: {
      excellent: 20,
      good: 22,
      fair: 3,
      poor: 0,
    },
  };

  const defaultPaymentMetrics: PaymentMetrics = {
    advancesCompleted: 8,
    advancesDefaulted: 0,
    advancesActive: 2,
    defaultRate: 0,
    averageRepaymentDelay: 0,
    totalBorrowed: 80000,
    totalRepaid: 60000,
    outstandingBalance: 20000,
  };

  const defaultActivityMetrics: ActivityMetrics = {
    accountAgeDays: 450,
    daysActive: 200,
    ordersPerMonth: 4.2,
    firstOrderDate: new Date('2023-06-01'),
    lastOrderDate: new Date('2024-12-15'),
  };

  const defaultBlockchainMetrics: BlockchainMetrics = {
    verifiedTransactions: 48,
    totalTransactions: 50,
    verificationRate: 96,
    verificationHashes: ['0xabc...', '0xdef...'],
    lastSyncAt: new Date(),
  };

  beforeEach(() => {
    calculator = createCreditScoreCalculator();
  });

  describe('calculate()', () => {
    it('should calculate a complete credit score', () => {
      const result = calculator.calculate(
        'producer-123',
        defaultDeliveryMetrics,
        defaultQualityMetrics,
        defaultPaymentMetrics,
        defaultActivityMetrics,
        defaultBlockchainMetrics,
      );

      expect(result).toBeDefined();
      expect(result.producerId).toBe('producer-123');
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
      expect(result.riskTier).toMatch(/^[ABC]$/);
      expect(result.componentScores).toBeDefined();
      expect(result.creditLimits).toBeDefined();
      expect(result.metadata.modelVersion).toBe('1.0.0');
    });

    it('should assign Tier A for excellent producers', () => {
      const excellentDelivery: DeliveryMetrics = {
        ...defaultDeliveryMetrics,
        successRate: 99,
        onTimeRate: 98,
        averageDelayDays: 0,
      };

      const excellentQuality: QualityMetrics = {
        ...defaultQualityMetrics,
        averageScore: 95,
        standardDeviation: 2,
        trend: ScoreTrend.IMPROVING,
      };

      const excellentPayment: PaymentMetrics = {
        ...defaultPaymentMetrics,
        advancesCompleted: 20,
        advancesDefaulted: 0,
        defaultRate: 0,
        averageRepaymentDelay: -1, // Pays early
      };

      const result = calculator.calculate(
        'producer-excellent',
        excellentDelivery,
        excellentQuality,
        excellentPayment,
        defaultActivityMetrics,
        defaultBlockchainMetrics,
      );

      expect(result.overallScore).toBeGreaterThanOrEqual(90);
      expect(result.riskTier).toBe(RiskTier.A);
    });

    it('should assign Tier C for new producers with no history', () => {
      const newDelivery: DeliveryMetrics = {
        totalCompleted: 0,
        totalDefaulted: 0,
        totalCancelled: 0,
        successRate: 0,
        averageDelayDays: 0,
        onTimeRate: 0,
        totalVolumeKg: 0,
        totalValueUSD: 0,
        averageOrderValue: 0,
      };

      const newQuality: QualityMetrics = {
        averageScore: 0,
        standardDeviation: 0,
        trend: ScoreTrend.STABLE,
        inspectionCount: 0,
        gradeDistribution: { excellent: 0, good: 0, fair: 0, poor: 0 },
      };

      const newPayment: PaymentMetrics = {
        advancesCompleted: 0,
        advancesDefaulted: 0,
        advancesActive: 0,
        defaultRate: 0,
        averageRepaymentDelay: 0,
        totalBorrowed: 0,
        totalRepaid: 0,
        outstandingBalance: 0,
      };

      const newActivity: ActivityMetrics = {
        accountAgeDays: 10,
        daysActive: 2,
        ordersPerMonth: 0,
        firstOrderDate: null,
        lastOrderDate: null,
      };

      const newBlockchain: BlockchainMetrics = {
        verifiedTransactions: 0,
        totalTransactions: 0,
        verificationRate: 0,
        verificationHashes: [],
        lastSyncAt: null,
      };

      const result = calculator.calculate(
        'producer-new',
        newDelivery,
        newQuality,
        newPayment,
        newActivity,
        newBlockchain,
      );

      // New producers should get neutral scores (around 50-60)
      expect(result.overallScore).toBeLessThan(70);
      expect(result.riskTier).toBe(RiskTier.C);
    });

    it('should penalize producers with high default rate', () => {
      const badPayment: PaymentMetrics = {
        ...defaultPaymentMetrics,
        advancesCompleted: 5,
        advancesDefaulted: 3,
        defaultRate: 0.375, // 37.5% default rate
        averageRepaymentDelay: 15,
      };

      const result = calculator.calculate(
        'producer-bad-payment',
        defaultDeliveryMetrics,
        defaultQualityMetrics,
        badPayment,
        defaultActivityMetrics,
        defaultBlockchainMetrics,
      );

      // Should have lower payment score
      expect(result.componentScores.payment).toBeLessThan(50);
      // Should affect overall score significantly
      expect(result.overallScore).toBeLessThan(80);
    });

    it('should calculate score changes correctly', () => {
      const previousScores = {
        score7DaysAgo: 75,
        score30DaysAgo: 72,
        score90DaysAgo: 68,
      };

      const result = calculator.calculate(
        'producer-123',
        defaultDeliveryMetrics,
        defaultQualityMetrics,
        defaultPaymentMetrics,
        defaultActivityMetrics,
        defaultBlockchainMetrics,
        previousScores,
      );

      expect(result.scoreChanges).toBeDefined();
      expect(result.scoreChanges.last7Days).toBe(result.overallScore - 75);
      expect(result.scoreChanges.last30Days).toBe(result.overallScore - 72);
      expect(result.scoreChanges.last90Days).toBe(result.overallScore - 68);
    });

    it('should determine trend based on score changes', () => {
      // Improving trend
      const improvingResult = calculator.calculate(
        'producer-improving',
        defaultDeliveryMetrics,
        defaultQualityMetrics,
        defaultPaymentMetrics,
        defaultActivityMetrics,
        defaultBlockchainMetrics,
        { score7DaysAgo: 70, score30DaysAgo: 65, score90DaysAgo: 60 },
      );

      expect(improvingResult.trend).toBe(ScoreTrend.IMPROVING);

      // Declining trend (mock lower current score by using poor metrics)
      const poorDelivery: DeliveryMetrics = {
        ...defaultDeliveryMetrics,
        successRate: 70,
        onTimeRate: 60,
      };

      const decliningResult = calculator.calculate(
        'producer-declining',
        poorDelivery,
        defaultQualityMetrics,
        defaultPaymentMetrics,
        defaultActivityMetrics,
        defaultBlockchainMetrics,
        { score7DaysAgo: 90, score30DaysAgo: 92, score90DaysAgo: 95 },
      );

      expect(decliningResult.trend).toBe(ScoreTrend.DECLINING);
    });

    it('should include scoring factors for explainability', () => {
      const result = calculator.calculate(
        'producer-123',
        defaultDeliveryMetrics,
        defaultQualityMetrics,
        defaultPaymentMetrics,
        defaultActivityMetrics,
        defaultBlockchainMetrics,
      );

      expect(result.scoringFactors).toBeDefined();
      expect(Array.isArray(result.scoringFactors)).toBe(true);

      // Should have some positive factors for a good producer
      const positiveFactors = result.scoringFactors.filter((f) => f.category === 'positive');
      expect(positiveFactors.length).toBeGreaterThan(0);
    });

    it('should generate recommendations', () => {
      // Use metrics with room for improvement
      const improvableDelivery: DeliveryMetrics = {
        ...defaultDeliveryMetrics,
        successRate: 75,
        onTimeRate: 70,
      };

      const result = calculator.calculate(
        'producer-needs-improvement',
        improvableDelivery,
        defaultQualityMetrics,
        defaultPaymentMetrics,
        defaultActivityMetrics,
        defaultBlockchainMetrics,
      );

      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.recommendations.length).toBeGreaterThan(0);

      // Recommendations should have expected properties
      const firstRec = result.recommendations[0];
      expect(firstRec.id).toBeDefined();
      expect(firstRec.priority).toMatch(/^(high|medium|low)$/);
      expect(firstRec.action).toBeDefined();
      expect(firstRec.expectedImpact).toBeGreaterThan(0);
    });

    it('should calculate credit limits based on tier', () => {
      const result = calculator.calculate(
        'producer-123',
        defaultDeliveryMetrics,
        defaultQualityMetrics,
        defaultPaymentMetrics,
        defaultActivityMetrics,
        defaultBlockchainMetrics,
      );

      expect(result.creditLimits).toBeDefined();
      expect(result.creditLimits.maxAdvancePercentage).toBeGreaterThanOrEqual(70);
      expect(result.creditLimits.maxAdvancePercentage).toBeLessThanOrEqual(85);
      expect(result.creditLimits.maxAdvanceAmount).toBeGreaterThan(0);
      expect(result.creditLimits.currentUtilization).toBe(20000);
      expect(result.creditLimits.availableCredit).toBe(
        result.creditLimits.maxAdvanceAmount - 20000,
      );
    });

    it('should calculate confidence level', () => {
      const result = calculator.calculate(
        'producer-123',
        defaultDeliveryMetrics,
        defaultQualityMetrics,
        defaultPaymentMetrics,
        defaultActivityMetrics,
        defaultBlockchainMetrics,
      );

      expect(result.metadata.confidenceLevel).toBeDefined();
      expect(result.metadata.confidenceLevel).toBeGreaterThanOrEqual(0);
      expect(result.metadata.confidenceLevel).toBeLessThanOrEqual(100);

      // Established producer with good data should have high confidence
      expect(result.metadata.confidenceLevel).toBeGreaterThan(60);
    });

    it('should complete calculation within performance target', () => {
      const result = calculator.calculate(
        'producer-123',
        defaultDeliveryMetrics,
        defaultQualityMetrics,
        defaultPaymentMetrics,
        defaultActivityMetrics,
        defaultBlockchainMetrics,
      );

      // Should complete in less than 500ms
      expect(result.metadata.calculationDurationMs).toBeLessThan(500);
    });
  });

  describe('Component Scores', () => {
    it('should calculate delivery score correctly', () => {
      const result = calculator.calculate(
        'producer-123',
        defaultDeliveryMetrics,
        defaultQualityMetrics,
        defaultPaymentMetrics,
        defaultActivityMetrics,
        defaultBlockchainMetrics,
      );

      expect(result.componentScores.delivery).toBeGreaterThanOrEqual(0);
      expect(result.componentScores.delivery).toBeLessThanOrEqual(100);

      // High success rate should result in high delivery score
      expect(result.componentScores.delivery).toBeGreaterThan(80);
    });

    it('should calculate quality score correctly', () => {
      const result = calculator.calculate(
        'producer-123',
        defaultDeliveryMetrics,
        defaultQualityMetrics,
        defaultPaymentMetrics,
        defaultActivityMetrics,
        defaultBlockchainMetrics,
      );

      expect(result.componentScores.quality).toBeGreaterThanOrEqual(0);
      expect(result.componentScores.quality).toBeLessThanOrEqual(100);

      // Good quality metrics should result in high quality score
      expect(result.componentScores.quality).toBeGreaterThan(70);
    });

    it('should calculate payment score correctly', () => {
      const result = calculator.calculate(
        'producer-123',
        defaultDeliveryMetrics,
        defaultQualityMetrics,
        defaultPaymentMetrics,
        defaultActivityMetrics,
        defaultBlockchainMetrics,
      );

      expect(result.componentScores.payment).toBeGreaterThanOrEqual(0);
      expect(result.componentScores.payment).toBeLessThanOrEqual(100);

      // Perfect payment history should result in high payment score
      expect(result.componentScores.payment).toBeGreaterThan(90);
    });

    it('should calculate volume score correctly', () => {
      const result = calculator.calculate(
        'producer-123',
        defaultDeliveryMetrics,
        defaultQualityMetrics,
        defaultPaymentMetrics,
        defaultActivityMetrics,
        defaultBlockchainMetrics,
      );

      expect(result.componentScores.volume).toBeGreaterThanOrEqual(0);
      expect(result.componentScores.volume).toBeLessThanOrEqual(100);
    });

    it('should calculate blockchain score correctly', () => {
      const result = calculator.calculate(
        'producer-123',
        defaultDeliveryMetrics,
        defaultQualityMetrics,
        defaultPaymentMetrics,
        defaultActivityMetrics,
        defaultBlockchainMetrics,
      );

      expect(result.componentScores.blockchain).toBeGreaterThanOrEqual(0);
      expect(result.componentScores.blockchain).toBeLessThanOrEqual(100);

      // High verification rate should result in high blockchain score
      expect(result.componentScores.blockchain).toBeGreaterThan(80);
    });
  });

  describe('simulateScore()', () => {
    it('should simulate score improvement', () => {
      const currentResult = calculator.calculate(
        'producer-123',
        defaultDeliveryMetrics,
        defaultQualityMetrics,
        defaultPaymentMetrics,
        defaultActivityMetrics,
        defaultBlockchainMetrics,
      );

      const simulation = calculator.simulateScore(currentResult, {
        additionalSuccessfulDeliveries: 10,
        qualityImprovement: 5,
      });

      expect(simulation.projectedScore).toBeGreaterThanOrEqual(simulation.currentScore);
      expect(simulation.scoreDifference).toBeGreaterThanOrEqual(0);
    });

    it('should simulate score decline', () => {
      const currentResult = calculator.calculate(
        'producer-123',
        defaultDeliveryMetrics,
        defaultQualityMetrics,
        defaultPaymentMetrics,
        defaultActivityMetrics,
        defaultBlockchainMetrics,
      );

      const simulation = calculator.simulateScore(currentResult, {
        additionalDefaultedDeliveries: 5,
      });

      expect(simulation.projectedScore).toBeLessThanOrEqual(simulation.currentScore);
      expect(simulation.scoreDifference).toBeLessThanOrEqual(0);
    });

    it('should detect tier changes', () => {
      // Create a borderline producer
      const borderlineDelivery: DeliveryMetrics = {
        ...defaultDeliveryMetrics,
        successRate: 85,
        onTimeRate: 80,
      };

      const borderlineResult = calculator.calculate(
        'producer-borderline',
        borderlineDelivery,
        defaultQualityMetrics,
        defaultPaymentMetrics,
        defaultActivityMetrics,
        defaultBlockchainMetrics,
      );

      // Simulate significant improvement
      const simulation = calculator.simulateScore(borderlineResult, {
        additionalSuccessfulDeliveries: 20,
        completedAdvanceRepayments: 5,
        qualityImprovement: 10,
      });

      // May or may not change tier depending on starting point
      expect(typeof simulation.tierChange).toBe('boolean');
    });
  });
});

describe('Score Weight Validation', () => {
  it('should have weights that sum to 100', () => {
    const { SCORE_WEIGHTS } = require('../../../src/modules/credit-scoring/types/credit-score.types.js');

    const totalWeight =
      SCORE_WEIGHTS.DELIVERY +
      SCORE_WEIGHTS.QUALITY +
      SCORE_WEIGHTS.PAYMENT +
      SCORE_WEIGHTS.VOLUME +
      SCORE_WEIGHTS.BLOCKCHAIN;

    expect(totalWeight).toBe(100);
  });
});

describe('Risk Tier Classification', () => {
  it('should classify Tier A for scores >= 90', () => {
    const { getRiskTierFromScore, RiskTier } = require('../../../src/modules/credit-scoring/types/credit-score.types.js');

    expect(getRiskTierFromScore(90)).toBe(RiskTier.A);
    expect(getRiskTierFromScore(95)).toBe(RiskTier.A);
    expect(getRiskTierFromScore(100)).toBe(RiskTier.A);
  });

  it('should classify Tier B for scores 70-89', () => {
    const { getRiskTierFromScore, RiskTier } = require('../../../src/modules/credit-scoring/types/credit-score.types.js');

    expect(getRiskTierFromScore(70)).toBe(RiskTier.B);
    expect(getRiskTierFromScore(80)).toBe(RiskTier.B);
    expect(getRiskTierFromScore(89)).toBe(RiskTier.B);
  });

  it('should classify Tier C for scores < 70', () => {
    const { getRiskTierFromScore, RiskTier } = require('../../../src/modules/credit-scoring/types/credit-score.types.js');

    expect(getRiskTierFromScore(0)).toBe(RiskTier.C);
    expect(getRiskTierFromScore(50)).toBe(RiskTier.C);
    expect(getRiskTierFromScore(69)).toBe(RiskTier.C);
  });
});

describe('Score Trend Detection', () => {
  it('should detect improving trend', () => {
    const { getScoreTrend, ScoreTrend } = require('../../../src/modules/credit-scoring/types/credit-score.types.js');

    expect(getScoreTrend(5, 8, 10)).toBe(ScoreTrend.IMPROVING);
    expect(getScoreTrend(3, 3, 3)).toBe(ScoreTrend.IMPROVING);
  });

  it('should detect stable trend', () => {
    const { getScoreTrend, ScoreTrend } = require('../../../src/modules/credit-scoring/types/credit-score.types.js');

    expect(getScoreTrend(0, 0, 0)).toBe(ScoreTrend.STABLE);
    expect(getScoreTrend(1, -1, 0)).toBe(ScoreTrend.STABLE);
  });

  it('should detect declining trend', () => {
    const { getScoreTrend, ScoreTrend } = require('../../../src/modules/credit-scoring/types/credit-score.types.js');

    expect(getScoreTrend(-5, -8, -10)).toBe(ScoreTrend.DECLINING);
    expect(getScoreTrend(-3, -3, -3)).toBe(ScoreTrend.DECLINING);
  });
});

describe('Utility Functions', () => {
  it('should clamp scores correctly', () => {
    const { clampScore } = require('../../../src/modules/credit-scoring/types/credit-score.types.js');

    expect(clampScore(-10)).toBe(0);
    expect(clampScore(50)).toBe(50);
    expect(clampScore(110)).toBe(100);
  });

  it('should validate risk tier correctly', () => {
    const { isValidRiskTier } = require('../../../src/modules/credit-scoring/types/credit-score.types.js');

    expect(isValidRiskTier('A')).toBe(true);
    expect(isValidRiskTier('B')).toBe(true);
    expect(isValidRiskTier('C')).toBe(true);
    expect(isValidRiskTier('D')).toBe(false);
    expect(isValidRiskTier('')).toBe(false);
  });

  it('should validate score trend correctly', () => {
    const { isValidScoreTrend } = require('../../../src/modules/credit-scoring/types/credit-score.types.js');

    expect(isValidScoreTrend('IMPROVING')).toBe(true);
    expect(isValidScoreTrend('STABLE')).toBe(true);
    expect(isValidScoreTrend('DECLINING')).toBe(true);
    expect(isValidScoreTrend('UNKNOWN')).toBe(false);
  });

  it('should get credit limits for tier correctly', () => {
    const { getCreditLimitsForTier, RiskTier } = require('../../../src/modules/credit-scoring/types/credit-score.types.js');

    const tierA = getCreditLimitsForTier(RiskTier.A);
    expect(tierA.maxAdvancePercentage).toBe(85);
    expect(tierA.maxAdvanceAmount).toBe(500000);
    expect(tierA.farmerFeePercentage).toBe(2.0);

    const tierB = getCreditLimitsForTier(RiskTier.B);
    expect(tierB.maxAdvancePercentage).toBe(80);
    expect(tierB.maxAdvanceAmount).toBe(200000);
    expect(tierB.farmerFeePercentage).toBe(2.5);

    const tierC = getCreditLimitsForTier(RiskTier.C);
    expect(tierC.maxAdvancePercentage).toBe(70);
    expect(tierC.maxAdvanceAmount).toBe(50000);
    expect(tierC.farmerFeePercentage).toBe(3.5);
  });
});
