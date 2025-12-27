/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AGROBRIDGE - LIQUIDITY POOL TYPE DEFINITIONS
 * Comprehensive Type System for Capital Pool Management
 *
 * This module defines all TypeScript types, interfaces, and constants for:
 * - Pool allocation and management
 * - Investor capital tracking
 * - Performance metrics and analytics
 * - Rebalancing strategies
 * - Transaction processing
 *
 * @module liquidity-pools/types
 * @version 1.0.0
 * @author AgroBridge Engineering Team
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import type { Decimal } from "@prisma/client/runtime/library";

// ════════════════════════════════════════════════════════════════════════════════
// ENUMS - Mirror Prisma enums for runtime use
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Liquidity pool operational status
 */
export enum PoolStatus {
  ACTIVE = "ACTIVE",
  PAUSED = "PAUSED",
  CLOSED = "CLOSED",
  LIQUIDATING = "LIQUIDATING",
}

/**
 * Risk tier classification
 */
export enum RiskTier {
  A = "A",
  B = "B",
  C = "C",
}

/**
 * Investor type classification
 */
export enum InvestorType {
  INDIVIDUAL = "INDIVIDUAL",
  INSTITUTION = "INSTITUTION",
  FUND = "FUND",
}

/**
 * Investor participation status
 */
export enum InvestorStatus {
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  WITHDRAWN = "WITHDRAWN",
  PENDING_KYC = "PENDING_KYC",
}

/**
 * Pool transaction types
 */
export enum PoolTransactionType {
  CAPITAL_DEPOSIT = "CAPITAL_DEPOSIT",
  CAPITAL_WITHDRAWAL = "CAPITAL_WITHDRAWAL",
  ADVANCE_DISBURSEMENT = "ADVANCE_DISBURSEMENT",
  ADVANCE_REPAYMENT = "ADVANCE_REPAYMENT",
  FEE_COLLECTION = "FEE_COLLECTION",
  INTEREST_DISTRIBUTION = "INTEREST_DISTRIBUTION",
  PENALTY_FEE = "PENALTY_FEE",
  ADJUSTMENT = "ADJUSTMENT",
  RESERVE_ALLOCATION = "RESERVE_ALLOCATION",
}

/**
 * Rebalancing strategy types
 */
export enum RebalancingStrategyType {
  CONSERVATIVE = "CONSERVATIVE",
  MODERATE = "MODERATE",
  AGGRESSIVE = "AGGRESSIVE",
  CUSTOM = "CUSTOM",
}

/**
 * Allocation priority modes
 */
export enum AllocationPriority {
  LOWEST_RISK = "LOWEST_RISK",
  HIGHEST_AVAILABLE = "HIGHEST_AVAILABLE",
  BEST_RETURN = "BEST_RETURN",
  ROUND_ROBIN = "ROUND_ROBIN",
  WEIGHTED = "WEIGHTED",
}

// ════════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Default pool operational constraints
 */
export const POOL_CONSTRAINTS = {
  MIN_RESERVE_RATIO: 15, // 15% minimum liquid reserves
  MAX_SINGLE_ADVANCE_RATIO: 10, // Max 10% of pool per advance
  MIN_ADVANCE_AMOUNT: 5000,
  MAX_ADVANCE_AMOUNT: 500000,
  DEFAULT_CURRENCY: "MXN",
  CACHE_TTL_SECONDS: 60,
} as const;

/**
 * Risk tier to advance percentage mapping
 */
export const RISK_TIER_ADVANCE_PERCENTAGES: Record<RiskTier, number> = {
  [RiskTier.A]: 85,
  [RiskTier.B]: 75,
  [RiskTier.C]: 70,
};

/**
 * Risk tier to fee percentage mapping (farmer fee)
 */
export const RISK_TIER_FEES: Record<
  RiskTier,
  { farmerFee: number; buyerFee: number }
> = {
  [RiskTier.A]: { farmerFee: 2.0, buyerFee: 1.0 },
  [RiskTier.B]: { farmerFee: 2.5, buyerFee: 1.25 },
  [RiskTier.C]: { farmerFee: 3.5, buyerFee: 1.75 },
};

/**
 * Pool performance thresholds
 */
export const PERFORMANCE_THRESHOLDS = {
  HEALTHY_DEFAULT_RATE: 0.02, // 2%
  WARNING_DEFAULT_RATE: 0.05, // 5%
  CRITICAL_DEFAULT_RATE: 0.1, // 10%
  MIN_UTILIZATION: 0.5, // 50%
  TARGET_UTILIZATION: 0.75, // 75%
  MAX_UTILIZATION: 0.85, // 85% (15% reserve)
} as const;

// ════════════════════════════════════════════════════════════════════════════════
// POOL ALLOCATION TYPES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Request to allocate capital from liquidity pool
 */
export interface PoolAllocationRequest {
  /** Unique identifier for the advance */
  advanceId: string;
  /** Farmer/producer requesting the advance */
  farmerId: string;
  /** Order being advanced against */
  orderId: string;
  /** Amount requested in base currency */
  requestedAmount: number;
  /** Currency code (e.g., MXN, USD) */
  currency: string;
  /** Risk tier of the farmer */
  riskTier: RiskTier;
  /** Credit score at time of request */
  creditScore: number;
  /** Expected repayment date */
  expectedRepaymentDate: Date;
  /** Order delivery date */
  expectedDeliveryDate: Date;
  /** Specific pool ID (optional - system selects if not provided) */
  preferredPoolId?: string;
  /** Allocation priority strategy */
  priority?: AllocationPriority;
  /** Metadata for tracking */
  metadata?: Record<string, unknown>;
}

/**
 * Result of a capital allocation attempt
 */
export interface PoolAllocationResult {
  /** Whether allocation was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Error code for programmatic handling */
  errorCode?: AllocationErrorCode;
  /** Allocated pool details */
  allocation?: {
    /** Pool that provided capital */
    poolId: string;
    /** Pool name */
    poolName: string;
    /** Amount allocated */
    allocatedAmount: number;
    /** Currency */
    currency: string;
    /** Pool balance before allocation */
    balanceBefore: number;
    /** Pool balance after allocation */
    balanceAfter: number;
    /** Transaction ID for audit */
    transactionId: string;
    /** Timestamp of allocation */
    allocatedAt: Date;
    /** Fees calculated */
    fees: {
      farmerFee: number;
      buyerFee: number;
      platformTotal: number;
    };
  };
  /** Alternative pools if primary failed */
  alternatives?: Array<{
    poolId: string;
    availableAmount: number;
    reason: string;
  }>;
}

/**
 * Allocation error codes
 */
export enum AllocationErrorCode {
  INSUFFICIENT_FUNDS = "INSUFFICIENT_FUNDS",
  POOL_PAUSED = "POOL_PAUSED",
  POOL_NOT_FOUND = "POOL_NOT_FOUND",
  AMOUNT_BELOW_MINIMUM = "AMOUNT_BELOW_MINIMUM",
  AMOUNT_ABOVE_MAXIMUM = "AMOUNT_ABOVE_MAXIMUM",
  RISK_TIER_MISMATCH = "RISK_TIER_MISMATCH",
  RESERVE_RATIO_VIOLATION = "RESERVE_RATIO_VIOLATION",
  EXPOSURE_LIMIT_EXCEEDED = "EXPOSURE_LIMIT_EXCEEDED",
  FARMER_LIMIT_EXCEEDED = "FARMER_LIMIT_EXCEEDED",
  CONCURRENT_ALLOCATION = "CONCURRENT_ALLOCATION",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

/**
 * Capital release request (repayment)
 */
export interface CapitalReleaseRequest {
  /** Advance contract ID */
  advanceId: string;
  /** Pool ID */
  poolId: string;
  /** Amount being released */
  amount: number;
  /** Type of release */
  releaseType:
    | "PARTIAL_REPAYMENT"
    | "FULL_REPAYMENT"
    | "DEFAULT_RECOVERY"
    | "ADJUSTMENT";
  /** Source of funds */
  source:
    | "BUYER_PAYMENT"
    | "FARMER_PAYMENT"
    | "INSURANCE"
    | "COLLECTIONS"
    | "OTHER";
  /** Payment reference */
  paymentReference?: string;
  /** Fees collected */
  feesCollected?: number;
  /** Penalties applied */
  penaltiesCollected?: number;
  /** Notes */
  notes?: string;
}

/**
 * Capital release result
 */
export interface CapitalReleaseResult {
  success: boolean;
  error?: string;
  release?: {
    poolId: string;
    transactionId: string;
    principalReleased: number;
    feesCollected: number;
    penaltiesCollected: number;
    netAmount: number;
    newAvailableCapital: number;
    releasedAt: Date;
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// POOL BALANCE TYPES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Real-time pool balance snapshot
 */
export interface PoolBalance {
  poolId: string;
  poolName: string;
  status: PoolStatus;
  riskTier: RiskTier;
  currency: string;
  /** Total committed capital */
  totalCapital: number;
  /** Currently available for advances */
  availableCapital: number;
  /** Deployed in active advances */
  deployedCapital: number;
  /** Reserved for pending allocations */
  reservedCapital: number;
  /** Required reserve amount */
  requiredReserve: number;
  /** Effective available (after reserve) */
  effectiveAvailable: number;
  /** Utilization rate (0-100) */
  utilizationRate: number;
  /** Reserve ratio (0-100) */
  reserveRatio: number;
  /** Is healthy based on thresholds */
  isHealthy: boolean;
  /** Timestamp of balance */
  timestamp: Date;
  /** Cache indicator */
  fromCache?: boolean;
}

/**
 * Pool balance change event
 */
export interface PoolBalanceChange {
  poolId: string;
  changeType: PoolTransactionType;
  amount: number;
  balanceBefore: PoolBalance;
  balanceAfter: PoolBalance;
  relatedEntityId?: string;
  relatedEntityType?: "ADVANCE" | "INVESTOR" | "ADJUSTMENT";
  timestamp: Date;
  userId?: string;
}

/**
 * Multi-pool balance summary
 */
export interface PoolBalanceSummary {
  totalPools: number;
  activePools: number;
  aggregateCapital: {
    total: number;
    available: number;
    deployed: number;
    reserved: number;
  };
  averageUtilization: number;
  averageReserveRatio: number;
  poolsByStatus: Record<PoolStatus, number>;
  poolsByRiskTier: Record<RiskTier, number>;
  timestamp: Date;
}

// ════════════════════════════════════════════════════════════════════════════════
// POOL PERFORMANCE TYPES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Pool performance metrics
 */
export interface PoolPerformanceMetrics {
  poolId: string;
  poolName: string;
  period: {
    startDate: Date;
    endDate: Date;
    daysInPeriod: number;
  };
  /** Advance metrics */
  advances: {
    totalIssued: number;
    totalCompleted: number;
    totalDefaulted: number;
    totalActive: number;
    completionRate: number;
    defaultRate: number;
    averageAmount: number;
    averageDuration: number;
  };
  /** Financial metrics */
  financial: {
    totalDisbursed: number;
    totalRepaid: number;
    totalFeesEarned: number;
    totalPenaltiesCollected: number;
    totalLosses: number;
    netRevenue: number;
    grossProfit: number;
    profitMargin: number;
  };
  /** Return metrics */
  returns: {
    targetROI: number;
    actualROI: number;
    annualizedROI: number;
    riskAdjustedReturn: number;
  };
  /** Capital efficiency */
  efficiency: {
    averageUtilization: number;
    capitalTurnover: number;
    daysSalesOutstanding: number;
  };
  /** Risk indicators */
  risk: {
    currentDefaultRate: number;
    historicalDefaultRate: number;
    exposureConcentration: number;
    largestExposure: number;
    topExposures: Array<{
      farmerId: string;
      farmerName: string;
      amount: number;
      percentage: number;
    }>;
  };
  /** Calculated at */
  calculatedAt: Date;
}

/**
 * Pool health assessment
 */
export interface PoolHealthAssessment {
  poolId: string;
  overallHealth: "HEALTHY" | "WARNING" | "CRITICAL";
  healthScore: number; // 0-100
  indicators: {
    liquidity: {
      status: "HEALTHY" | "WARNING" | "CRITICAL";
      reserveRatio: number;
      daysOfRunway: number;
    };
    performance: {
      status: "HEALTHY" | "WARNING" | "CRITICAL";
      defaultRate: number;
      profitMargin: number;
    };
    concentration: {
      status: "HEALTHY" | "WARNING" | "CRITICAL";
      topExposurePercentage: number;
      diversificationScore: number;
    };
    activity: {
      status: "HEALTHY" | "WARNING" | "CRITICAL";
      recentAdvances: number;
      growthRate: number;
    };
  };
  recommendations: string[];
  assessedAt: Date;
}

// ════════════════════════════════════════════════════════════════════════════════
// REBALANCING STRATEGY TYPES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Rebalancing strategy configuration
 */
export interface RebalancingStrategy {
  /** Strategy identifier */
  id: string;
  /** Strategy name */
  name: string;
  /** Strategy type */
  type: RebalancingStrategyType;
  /** Target utilization rate (0-1) */
  targetUtilization: number;
  /** Minimum reserve ratio (0-1) */
  minReserveRatio: number;
  /** Maximum single-farmer exposure (0-1) */
  maxSingleExposure: number;
  /** Risk tier weighting */
  riskWeights: Record<RiskTier, number>;
  /** Rebalancing triggers */
  triggers: RebalancingTrigger[];
  /** Actions to take */
  actions: RebalancingAction[];
  /** Is strategy active */
  isActive: boolean;
  /** Last execution time */
  lastExecutedAt?: Date;
}

/**
 * Triggers that initiate rebalancing
 */
export interface RebalancingTrigger {
  type:
    | "UTILIZATION_HIGH"
    | "UTILIZATION_LOW"
    | "RESERVE_LOW"
    | "DEFAULT_SPIKE"
    | "SCHEDULED"
    | "MANUAL";
  threshold?: number;
  schedule?: string; // Cron expression for scheduled
  cooldownMinutes: number;
}

/**
 * Actions taken during rebalancing
 */
export interface RebalancingAction {
  type:
    | "PAUSE_POOL"
    | "TRANSFER_CAPITAL"
    | "ADJUST_LIMITS"
    | "ALERT_ADMIN"
    | "AUTO_INVEST";
  targetPoolId?: string;
  amount?: number;
  priority: number;
  conditions?: Record<string, unknown>;
}

/**
 * Rebalancing execution result
 */
export interface RebalancingResult {
  strategyId: string;
  executedAt: Date;
  triggeredBy: string;
  success: boolean;
  actionsExecuted: Array<{
    action: RebalancingAction;
    success: boolean;
    result?: unknown;
    error?: string;
  }>;
  poolStatesBefore: PoolBalance[];
  poolStatesAfter: PoolBalance[];
  summary: {
    capitalMoved: number;
    poolsAffected: number;
    errorsEncountered: number;
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// INVESTOR TYPES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Investor portfolio summary
 */
export interface InvestorPortfolio {
  investorId: string;
  investorName: string;
  investorType: InvestorType;
  status: InvestorStatus;
  /** Pool investments */
  investments: Array<{
    poolId: string;
    poolName: string;
    committedCapital: number;
    deployedCapital: number;
    totalReturns: number;
    unrealizedGains: number;
    currentROI: number;
    joinedAt: Date;
    lastPayoutAt?: Date;
  }>;
  /** Aggregate metrics */
  totals: {
    committedCapital: number;
    deployedCapital: number;
    totalReturns: number;
    unrealizedGains: number;
    weightedROI: number;
  };
  /** Payout history */
  recentPayouts: Array<{
    poolId: string;
    amount: number;
    type: "INTEREST" | "PRINCIPAL" | "BONUS";
    paidAt: Date;
  }>;
}

/**
 * Investor deposit request
 */
export interface InvestorDepositRequest {
  investorId: string;
  poolId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentReference?: string;
}

/**
 * Investor withdrawal request
 */
export interface InvestorWithdrawalRequest {
  investorId: string;
  poolId: string;
  amount: number;
  bankAccountId: string;
  isFullWithdrawal: boolean;
  reason?: string;
}

// ════════════════════════════════════════════════════════════════════════════════
// TRANSACTION TYPES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Pool transaction record
 */
export interface PoolTransactionRecord {
  id: string;
  poolId: string;
  type: PoolTransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  metadata?: Record<string, unknown>;
  relatedAdvanceId?: string;
  relatedInvestorId?: string;
  createdAt: Date;
}

/**
 * Transaction filter options
 */
export interface TransactionFilterOptions {
  poolId?: string;
  types?: PoolTransactionType[];
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
  relatedAdvanceId?: string;
  relatedInvestorId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Transaction summary
 */
export interface TransactionSummary {
  poolId: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  byType: Record<
    PoolTransactionType,
    {
      count: number;
      totalAmount: number;
      netAmount: number;
    }
  >;
  totals: {
    inflows: number;
    outflows: number;
    netChange: number;
    transactionCount: number;
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// POOL CONFIGURATION TYPES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Pool creation request
 */
export interface CreatePoolRequest {
  name: string;
  description?: string;
  initialCapital: number;
  currency: string;
  riskTier: RiskTier;
  targetReturnRate: number;
  minAdvanceAmount?: number;
  maxAdvanceAmount?: number;
  maxExposureLimit: number;
  minReserveRatio?: number;
  autoRebalanceEnabled?: boolean;
  createdBy: string;
}

/**
 * Pool update request
 */
export interface UpdatePoolRequest {
  poolId: string;
  name?: string;
  description?: string;
  status?: PoolStatus;
  targetReturnRate?: number;
  minAdvanceAmount?: number;
  maxAdvanceAmount?: number;
  maxExposureLimit?: number;
  minReserveRatio?: number;
  autoRebalanceEnabled?: boolean;
  updatedBy: string;
}

/**
 * Pool details response
 */
export interface PoolDetails {
  id: string;
  name: string;
  description?: string;
  status: PoolStatus;
  riskTier: RiskTier;
  currency: string;
  /** Capital breakdown */
  capital: {
    total: number;
    available: number;
    deployed: number;
    reserved: number;
  };
  /** Returns */
  returns: {
    targetRate: number;
    actualRate: number;
  };
  /** Constraints */
  constraints: {
    minAdvanceAmount: number;
    maxAdvanceAmount: number;
    maxExposureLimit: number;
    minReserveRatio: number;
  };
  /** Statistics */
  statistics: {
    totalAdvancesIssued: number;
    totalAdvancesCompleted: number;
    totalAdvancesDefaulted: number;
    totalAdvancesActive: number;
    defaultRate: number;
    totalDisbursed: number;
    totalRepaid: number;
    totalFeesEarned: number;
  };
  /** Settings */
  settings: {
    autoRebalanceEnabled: boolean;
  };
  /** Investor count */
  investorCount: number;
  /** Audit */
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

// ════════════════════════════════════════════════════════════════════════════════
// SERVICE RESPONSE TYPES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Generic service result wrapper
 */
export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  metadata?: {
    cached?: boolean;
    cacheTtl?: number;
    processingTime?: number;
  };
}

/**
 * Paginated list response
 */
export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// UTILITY TYPES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Convert Decimal to number for calculations
 */
export type DecimalToNumber<T> = {
  [K in keyof T]: T[K] extends Decimal ? number : T[K];
};

/**
 * Pool selection criteria
 */
export interface PoolSelectionCriteria {
  riskTier?: RiskTier;
  minAvailableCapital?: number;
  currency?: string;
  status?: PoolStatus[];
  excludePoolIds?: string[];
}

/**
 * Advance eligibility for pool
 */
export interface PoolAdvanceEligibility {
  poolId: string;
  isEligible: boolean;
  maxAllowedAmount: number;
  reasons: string[];
  constraints: {
    amountConstraint?: string;
    reserveConstraint?: string;
    exposureConstraint?: string;
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Get advance percentage for risk tier
 */
export function getAdvancePercentageForTier(tier: RiskTier): number {
  return RISK_TIER_ADVANCE_PERCENTAGES[tier];
}

/**
 * Get fees for risk tier
 */
export function getFeesForTier(tier: RiskTier): {
  farmerFee: number;
  buyerFee: number;
} {
  return RISK_TIER_FEES[tier];
}

/**
 * Calculate effective available capital (after reserve)
 */
export function calculateEffectiveAvailable(
  availableCapital: number,
  totalCapital: number,
  minReserveRatio: number,
): number {
  const requiredReserve = totalCapital * (minReserveRatio / 100);
  return Math.max(0, availableCapital - requiredReserve);
}

/**
 * Calculate utilization rate
 */
export function calculateUtilizationRate(
  deployedCapital: number,
  totalCapital: number,
): number {
  if (totalCapital === 0) return 0;
  return (deployedCapital / totalCapital) * 100;
}

/**
 * Calculate reserve ratio
 */
export function calculateReserveRatio(
  availableCapital: number,
  totalCapital: number,
): number {
  if (totalCapital === 0) return 100;
  return (availableCapital / totalCapital) * 100;
}

/**
 * Check if pool health is within thresholds
 */
export function assessPoolHealth(
  defaultRate: number,
  utilizationRate: number,
  reserveRatio: number,
): "HEALTHY" | "WARNING" | "CRITICAL" {
  if (
    defaultRate >= PERFORMANCE_THRESHOLDS.CRITICAL_DEFAULT_RATE ||
    reserveRatio < 5
  ) {
    return "CRITICAL";
  }

  if (
    defaultRate >= PERFORMANCE_THRESHOLDS.WARNING_DEFAULT_RATE ||
    utilizationRate > PERFORMANCE_THRESHOLDS.MAX_UTILIZATION * 100 ||
    reserveRatio < 10
  ) {
    return "WARNING";
  }

  return "HEALTHY";
}

/**
 * Validate allocation amount against pool constraints
 */
export function validateAllocationAmount(
  amount: number,
  poolAvailable: number,
  poolTotal: number,
  constraints: {
    minAdvance: number;
    maxAdvance: number;
    maxSingleAdvanceRatio: number;
    minReserveRatio: number;
  },
): { valid: boolean; error?: string; errorCode?: AllocationErrorCode } {
  if (amount < constraints.minAdvance) {
    return {
      valid: false,
      error: `Amount ${amount} is below minimum ${constraints.minAdvance}`,
      errorCode: AllocationErrorCode.AMOUNT_BELOW_MINIMUM,
    };
  }

  if (amount > constraints.maxAdvance) {
    return {
      valid: false,
      error: `Amount ${amount} exceeds maximum ${constraints.maxAdvance}`,
      errorCode: AllocationErrorCode.AMOUNT_ABOVE_MAXIMUM,
    };
  }

  const maxSingleAmount = poolTotal * (constraints.maxSingleAdvanceRatio / 100);
  if (amount > maxSingleAmount) {
    return {
      valid: false,
      error: `Amount ${amount} exceeds single advance limit ${maxSingleAmount}`,
      errorCode: AllocationErrorCode.EXPOSURE_LIMIT_EXCEEDED,
    };
  }

  const requiredReserve = poolTotal * (constraints.minReserveRatio / 100);
  const effectiveAvailable = poolAvailable - requiredReserve;

  if (amount > effectiveAvailable) {
    return {
      valid: false,
      error: `Amount ${amount} would violate reserve ratio (available: ${effectiveAvailable})`,
      errorCode: AllocationErrorCode.RESERVE_RATIO_VIOLATION,
    };
  }

  return { valid: true };
}
