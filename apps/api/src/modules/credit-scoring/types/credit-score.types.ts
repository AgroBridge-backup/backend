/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AGROBRIDGE - CREDIT SCORING TYPES
 * Production-Ready Type Definitions for Blockchain-Based Credit Scoring
 *
 * @module credit-scoring/types
 * @version 1.0.0
 * @author Dr. Sofia Rodriguez (Square Capital ML Engineer)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Decimal } from "@prisma/client/runtime/library";

// ════════════════════════════════════════════════════════════════════════════════
// ENUMS (Runtime values + Type safety)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Risk tier classification
 * Determines credit limits, fees, and approval thresholds
 */
export enum RiskTier {
  /** Low risk: 90-100 score, excellent history, lowest fees */
  A = "A",
  /** Medium risk: 70-89 score, good history, standard fees */
  B = "B",
  /** High risk: <70 score or new farmer, higher fees, manual review */
  C = "C",
}

/**
 * Score trend direction
 * Used for predictive analytics and early warning detection
 */
export enum ScoreTrend {
  /** Score has been increasing over time */
  IMPROVING = "IMPROVING",
  /** Score is stable with minimal variance */
  STABLE = "STABLE",
  /** Score has been decreasing - requires attention */
  DECLINING = "DECLINING",
}

/**
 * Credit score component weights
 * Algorithm version 1.0 - Total must equal 100%
 */
export const SCORE_WEIGHTS = {
  /** Delivery success rate weight - 40% */
  DELIVERY: 40,
  /** Quality score weight - 25% */
  QUALITY: 25,
  /** Payment history weight - 20% */
  PAYMENT: 20,
  /** Volume/experience weight - 10% */
  VOLUME: 10,
  /** Blockchain verification weight - 5% */
  BLOCKCHAIN: 5,
} as const;

/**
 * Risk tier thresholds
 */
export const RISK_TIER_THRESHOLDS = {
  /** Score >= 90 = Tier A */
  A_MIN: 90,
  /** Score >= 70 = Tier B */
  B_MIN: 70,
  /** Score < 70 = Tier C */
  C_MAX: 70,
} as const;

/**
 * Credit limits by tier (in USD)
 */
export const CREDIT_LIMITS = {
  A: {
    /** Maximum advance percentage for tier A */
    maxAdvancePercentage: 85,
    /** Maximum advance amount for tier A */
    maxAdvanceAmount: 500000,
    /** Farmer fee percentage for tier A */
    farmerFeePercentage: 2.0,
  },
  B: {
    maxAdvancePercentage: 80,
    maxAdvanceAmount: 200000,
    farmerFeePercentage: 2.5,
  },
  C: {
    maxAdvancePercentage: 70,
    maxAdvanceAmount: 50000,
    farmerFeePercentage: 3.5,
  },
} as const;

// ════════════════════════════════════════════════════════════════════════════════
// CORE INTERFACES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Raw blockchain delivery data for scoring
 */
export interface BlockchainDeliveryData {
  /** Transaction hash on blockchain */
  txHash: string;
  /** Order ID associated with delivery */
  orderId: string;
  /** Producer wallet address */
  producerAddress: string;
  /** Delivery timestamp (Unix) */
  deliveryTimestamp: number;
  /** Expected delivery timestamp (Unix) */
  expectedDeliveryTimestamp: number;
  /** Was delivery on time */
  wasOnTime: boolean;
  /** Quality grade from inspection (0-100) */
  qualityGrade: number;
  /** Weight delivered in kg */
  weightKg: number;
  /** Weight expected in kg */
  expectedWeightKg: number;
  /** Value in USD */
  valueUSD: number;
  /** Whether delivery was verified on-chain */
  isVerified: boolean;
  /** Block number of transaction */
  blockNumber: number;
}

/**
 * Aggregated delivery metrics from blockchain
 */
export interface DeliveryMetrics {
  /** Total completed deliveries */
  totalCompleted: number;
  /** Total defaulted deliveries */
  totalDefaulted: number;
  /** Total cancelled deliveries */
  totalCancelled: number;
  /** Success rate as percentage (0-100) */
  successRate: number;
  /** Average delivery delay in days (negative = early) */
  averageDelayDays: number;
  /** On-time delivery rate as percentage */
  onTimeRate: number;
  /** Total volume delivered in kg */
  totalVolumeKg: number;
  /** Total value delivered in USD */
  totalValueUSD: number;
  /** Average order value in USD */
  averageOrderValue: number;
}

/**
 * Quality metrics from inspections
 */
export interface QualityMetrics {
  /** Average quality score (0-100) */
  averageScore: number;
  /** Standard deviation for consistency */
  standardDeviation: number;
  /** Recent trend direction */
  trend: ScoreTrend;
  /** Number of inspections */
  inspectionCount: number;
  /** Quality grades breakdown */
  gradeDistribution: {
    excellent: number; // 90-100
    good: number; // 70-89
    fair: number; // 50-69
    poor: number; // <50
  };
}

/**
 * Payment/repayment history metrics
 */
export interface PaymentMetrics {
  /** Total advances completed */
  advancesCompleted: number;
  /** Total advances defaulted */
  advancesDefaulted: number;
  /** Currently active advances */
  advancesActive: number;
  /** Default rate as percentage */
  defaultRate: number;
  /** Average repayment delay in days */
  averageRepaymentDelay: number;
  /** Total amount ever borrowed in USD */
  totalBorrowed: number;
  /** Total amount repaid in USD */
  totalRepaid: number;
  /** Outstanding balance in USD */
  outstandingBalance: number;
}

/**
 * Account activity metrics
 */
export interface ActivityMetrics {
  /** Days since account creation */
  accountAgeDays: number;
  /** Days with at least one activity */
  daysActive: number;
  /** Average orders per month */
  ordersPerMonth: number;
  /** Date of first order */
  firstOrderDate: Date | null;
  /** Date of last order */
  lastOrderDate: Date | null;
}

/**
 * Blockchain verification metrics
 */
export interface BlockchainMetrics {
  /** Number of verified transactions */
  verifiedTransactions: number;
  /** Total transactions */
  totalTransactions: number;
  /** Verification rate as percentage */
  verificationRate: number;
  /** Array of verification tx hashes */
  verificationHashes: string[];
  /** Last sync timestamp */
  lastSyncAt: Date | null;
}

/**
 * Component scores (0-100)
 */
export interface ComponentScores {
  /** Delivery performance score */
  delivery: number;
  /** Quality consistency score */
  quality: number;
  /** Payment history score */
  payment: number;
  /** Volume/experience score */
  volume: number;
  /** Blockchain verification score */
  blockchain: number;
}

/**
 * Complete credit score result
 */
export interface CreditScoreResult {
  /** Producer ID */
  producerId: string;

  /** Overall composite score (0-100) */
  overallScore: number;

  /** Risk tier classification */
  riskTier: RiskTier;

  /** Individual component scores */
  componentScores: ComponentScores;

  /** Calculated credit limits */
  creditLimits: {
    /** Maximum advance percentage allowed */
    maxAdvancePercentage: number;
    /** Maximum advance amount in USD */
    maxAdvanceAmount: number;
    /** Current utilization in USD */
    currentUtilization: number;
    /** Available credit in USD */
    availableCredit: number;
    /** Utilization rate as percentage */
    utilizationRate: number;
  };

  /** Score changes over time */
  scoreChanges: {
    /** Change in last 7 days */
    last7Days: number;
    /** Change in last 30 days */
    last30Days: number;
    /** Change in last 90 days */
    last90Days: number;
  };

  /** Overall trend */
  trend: ScoreTrend;

  /** Raw metrics used for calculation */
  metrics: {
    delivery: DeliveryMetrics;
    quality: QualityMetrics;
    payment: PaymentMetrics;
    activity: ActivityMetrics;
    blockchain: BlockchainMetrics;
  };

  /** Calculation metadata */
  metadata: {
    /** Algorithm version */
    modelVersion: string;
    /** Calculation timestamp */
    calculatedAt: Date;
    /** Calculation duration in ms */
    calculationDurationMs: number;
    /** Data sources used */
    dataSources: string[];
    /** Confidence level (0-100) */
    confidenceLevel: number;
  };

  /** Factors affecting score */
  scoringFactors: ScoringFactor[];

  /** Recommendations for score improvement */
  recommendations: ScoreRecommendation[];
}

/**
 * Individual factor affecting score
 */
export interface ScoringFactor {
  /** Factor name */
  name: string;
  /** Impact on score (-100 to +100) */
  impact: number;
  /** Category of factor */
  category: "positive" | "negative" | "neutral";
  /** Human-readable description */
  description: string;
  /** Weight in overall score */
  weight: number;
}

/**
 * Recommendation for score improvement
 */
export interface ScoreRecommendation {
  /** Recommendation ID */
  id: string;
  /** Priority level */
  priority: "high" | "medium" | "low";
  /** Action to take */
  action: string;
  /** Expected score impact */
  expectedImpact: number;
  /** Category of recommendation */
  category: string;
}

// ════════════════════════════════════════════════════════════════════════════════
// INPUT/OUTPUT TYPES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Input for credit score calculation
 */
export interface CalculateCreditScoreInput {
  /** Producer ID to calculate score for */
  producerId: string;
  /** Force recalculation even if cached */
  forceRecalculate?: boolean;
  /** Include detailed breakdown */
  includeDetails?: boolean;
  /** Custom weights override (for A/B testing) */
  customWeights?: Partial<typeof SCORE_WEIGHTS>;
}

/**
 * Output from credit score calculation
 */
export interface CalculateCreditScoreOutput {
  /** Success flag */
  success: boolean;
  /** Credit score result */
  data?: CreditScoreResult;
  /** Error message if failed */
  error?: string;
  /** Was result cached */
  cached: boolean;
  /** Cache TTL in seconds */
  cacheTtl?: number;
}

/**
 * Credit score eligibility check input
 */
export interface EligibilityCheckInput {
  /** Producer ID */
  producerId: string;
  /** Requested advance amount in USD */
  requestedAmount: number;
  /** Order ID for the advance */
  orderId: string;
}

/**
 * Credit score eligibility check output
 */
export interface EligibilityCheckOutput {
  /** Is producer eligible for the requested advance */
  isEligible: boolean;
  /** Reason if not eligible */
  reason?: string;
  /** Maximum eligible amount */
  maxEligibleAmount: number;
  /** Current credit score */
  creditScore: number;
  /** Current risk tier */
  riskTier: RiskTier;
  /** Required manual review */
  requiresManualReview: boolean;
  /** Additional conditions */
  conditions?: string[];
}

/**
 * Score history entry
 */
export interface ScoreHistoryEntry {
  /** Timestamp of score */
  timestamp: Date;
  /** Overall score at that time */
  overallScore: number;
  /** Risk tier at that time */
  riskTier: RiskTier;
  /** Component scores */
  componentScores: ComponentScores;
  /** Change from previous */
  change: number;
  /** Reason for change */
  changeReason: string;
  /** What triggered recalculation */
  triggerEvent?: string;
}

/**
 * Score simulation input (what-if analysis)
 */
export interface ScoreSimulationInput {
  /** Producer ID */
  producerId: string;
  /** Simulated changes */
  changes: {
    /** Add successful deliveries */
    additionalSuccessfulDeliveries?: number;
    /** Add defaulted deliveries */
    additionalDefaultedDeliveries?: number;
    /** Improve quality score by */
    qualityImprovement?: number;
    /** Complete advance repayments */
    completedAdvanceRepayments?: number;
    /** Add blockchain verifications */
    additionalBlockchainVerifications?: number;
  };
}

/**
 * Score simulation output
 */
export interface ScoreSimulationOutput {
  /** Current score */
  currentScore: number;
  /** Projected score after changes */
  projectedScore: number;
  /** Score difference */
  scoreDifference: number;
  /** Current tier */
  currentTier: RiskTier;
  /** Projected tier */
  projectedTier: RiskTier;
  /** Will tier change */
  tierChange: boolean;
  /** Detailed impact analysis (optional) */
  impactAnalysis?: ScoringFactor[];
}

// ════════════════════════════════════════════════════════════════════════════════
// REPOSITORY TYPES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Credit score entity (database model)
 */
export interface CreditScoreEntity {
  id: string;
  producerId: string;

  // Core metrics
  totalOrdersCompleted: number;
  totalOrdersDefaulted: number;
  totalOrdersCancelled: number;
  deliverySuccessRate: Decimal;

  // Quality
  averageQualityScore: Decimal;
  qualityConsistency: Decimal;
  recentQualityTrend: ScoreTrend;

  // Timeliness
  averageDeliveryDelay: number;
  onTimeDeliveryRate: Decimal;

  // Volume
  totalVolumeDelivered: Decimal;
  totalValueDelivered: Decimal;
  avgOrderValue: Decimal;

  // Payment
  advancesCompleted: number;
  advancesDefaulted: number;
  advancesActive: number;
  advanceDefaultRate: Decimal;
  averageRepaymentDelay: number;
  totalAmountBorrowed: Decimal;
  totalAmountRepaid: Decimal;

  // Activity
  accountAgeDays: number;
  daysActive: number;
  activityFrequency: Decimal;

  // Component scores
  deliveryScore: Decimal;
  qualityScore: Decimal;
  paymentScore: Decimal;
  volumeScore: Decimal;
  blockchainScore: Decimal;

  // Final score
  overallScore: Decimal;
  riskTier: RiskTier;

  // Credit limits
  maxAdvanceAmount: Decimal;
  currentUtilization: Decimal;
  availableCredit: Decimal;
  utilizationRate: Decimal;

  // Score changes
  scoreChange7Days: Decimal;
  scoreChange30Days: Decimal;
  scoreChange90Days: Decimal;
  trend: ScoreTrend;

  // Blockchain
  blockchainVerifications: string[];
  lastBlockchainSync: Date | null;

  // Metadata
  modelVersion: string;
  lastCalculatedAt: Date;
  calculatedBy: string;
  calculationDuration: number | null;

  // Override
  isManualOverride: boolean;
  manualScore: Decimal | null;
  overrideReason: string | null;
  isUnderReview: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Credit score history entity
 */
export interface CreditScoreHistoryEntity {
  id: string;
  creditScoreId: string;
  overallScore: Decimal;
  riskTier: RiskTier;
  deliveryScore: Decimal;
  qualityScore: Decimal;
  paymentScore: Decimal;
  changeAmount: Decimal;
  changeReason: string;
  triggerEvent: string | null;
  createdAt: Date;
}

// ════════════════════════════════════════════════════════════════════════════════
// CONFIGURATION TYPES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Credit scoring configuration
 */
export interface CreditScoringConfig {
  /** Minimum score required for any advance */
  minScoreForAdvance: number;
  /** Cache TTL in seconds */
  cacheTtlSeconds: number;
  /** Enable automatic recalculation */
  autoRecalculate: boolean;
  /** Recalculation interval in hours */
  recalculationIntervalHours: number;
  /** Enable blockchain verification */
  blockchainVerificationEnabled: boolean;
  /** Blockchain RPC endpoint */
  blockchainRpcUrl: string;
  /** Enable ML scoring (future) */
  mlScoringEnabled: boolean;
  /** Alert thresholds */
  alertThresholds: {
    /** Score below this triggers alert */
    lowScoreThreshold: number;
    /** Score drop of this much triggers alert */
    rapidDeclineThreshold: number;
    /** Utilization above this triggers alert */
    highUtilizationThreshold: number;
  };
}

/**
 * Default configuration values
 */
export const DEFAULT_CREDIT_SCORING_CONFIG: CreditScoringConfig = {
  minScoreForAdvance: 40,
  cacheTtlSeconds: 300, // 5 minutes
  autoRecalculate: true,
  recalculationIntervalHours: 24,
  blockchainVerificationEnabled: true,
  blockchainRpcUrl:
    process.env.BLOCKCHAIN_RPC_URL || "https://rpc-mumbai.maticvigil.com",
  mlScoringEnabled: false,
  alertThresholds: {
    lowScoreThreshold: 50,
    rapidDeclineThreshold: 15,
    highUtilizationThreshold: 80,
  },
};

// ════════════════════════════════════════════════════════════════════════════════
// UTILITY TYPES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Type guard for RiskTier
 */
export function isValidRiskTier(tier: string): tier is RiskTier {
  return Object.values(RiskTier).includes(tier as RiskTier);
}

/**
 * Type guard for ScoreTrend
 */
export function isValidScoreTrend(trend: string): trend is ScoreTrend {
  return Object.values(ScoreTrend).includes(trend as ScoreTrend);
}

/**
 * Convert Decimal to number safely
 */
export function decimalToNumber(
  value: Decimal | number | null | undefined,
): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return value.toNumber();
}

/**
 * Clamp value between min and max
 */
export function clampScore(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Determine risk tier from score
 */
export function getRiskTierFromScore(score: number): RiskTier {
  if (score >= RISK_TIER_THRESHOLDS.A_MIN) return RiskTier.A;
  if (score >= RISK_TIER_THRESHOLDS.B_MIN) return RiskTier.B;
  return RiskTier.C;
}

/**
 * Determine score trend from changes
 */
export function getScoreTrend(
  change7Days: number,
  change30Days: number,
  change90Days: number,
): ScoreTrend {
  const avgChange = (change7Days + change30Days + change90Days) / 3;

  if (avgChange > 2) return ScoreTrend.IMPROVING;
  if (avgChange < -2) return ScoreTrend.DECLINING;
  return ScoreTrend.STABLE;
}

/**
 * Get credit limits for a risk tier
 */
export function getCreditLimitsForTier(tier: RiskTier) {
  return CREDIT_LIMITS[tier];
}
