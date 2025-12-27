/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AGROBRIDGE - ADVANCE CONTRACT SERVICE
 * Complete Advance Lifecycle Management
 *
 * Responsibilities:
 * - Advance request processing and underwriting
 * - Capital allocation coordination
 * - Disbursement initiation
 * - Repayment processing
 * - Status management and transitions
 * - Default handling
 *
 * @module cash-flow-bridge/services
 * @version 1.0.0
 * @author AgroBridge Engineering Team
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { PrismaClient, Prisma } from "@prisma/client";
import type { Redis } from "ioredis";
import {
  type CreditScoringService,
  createCreditScoringService,
} from "../../credit-scoring/services/credit-scoring.service.js";
import {
  type LiquidityPoolService,
  createLiquidityPoolService,
  type PoolAllocationRequest,
  type CapitalReleaseRequest,
  RiskTier,
  getFeesForTier,
  getAdvancePercentageForTier,
} from "../../liquidity-pools/index.js";

// ════════════════════════════════════════════════════════════════════════════════
// FINANCIAL CALCULATION UTILITIES
// Using Prisma.Decimal for financial precision (no external dependency needed)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Rounding modes for financial calculations
 */
const ROUNDING = {
  UP: 0, // Round away from zero
  DOWN: 1, // Round towards zero
  HALF_UP: 4, // Round half away from zero (banker's rounding)
} as const;

/**
 * Round a number to specified decimal places with given rounding mode
 */
function roundTo(value: number, decimals: number, mode: number): number {
  const factor = Math.pow(10, decimals);
  const shifted = value * factor;

  switch (mode) {
    case ROUNDING.UP:
      return (value >= 0 ? Math.ceil(shifted) : Math.floor(shifted)) / factor;
    case ROUNDING.DOWN:
      return (value >= 0 ? Math.floor(shifted) : Math.ceil(shifted)) / factor;
    case ROUNDING.HALF_UP:
    default:
      return Math.round(shifted) / factor;
  }
}

/**
 * Rounding strategy for different financial amounts
 *
 * FINANCIAL COMPLIANCE: All money amounts must be rounded consistently
 */
const ROUNDING_STRATEGIES = {
  // Fees are rounded UP to the nearest cent (favor platform)
  FEE: (amount: number): number => roundTo(amount, 2, ROUNDING.UP),
  // Net amounts are rounded DOWN to the nearest cent (favor farmer)
  NET_TO_FARMER: (amount: number): number => roundTo(amount, 2, ROUNDING.DOWN),
  // General amounts use banker's rounding (fair for both parties)
  AMOUNT: (amount: number): number => roundTo(amount, 2, ROUNDING.HALF_UP),
  // Percentages to 4 decimal places
  PERCENTAGE: (amount: number): number => roundTo(amount, 4, ROUNDING.HALF_UP),
} as const;

/**
 * Safe conversion from Prisma.Decimal to number
 */
function toNumber(value: number | string | Prisma.Decimal): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value);
  return Number(value.toString());
}

// ════════════════════════════════════════════════════════════════════════════════
// TYPES & ENUMS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Advance status enum (mirrors Prisma)
 */
export enum AdvanceStatus {
  PENDING_APPROVAL = "PENDING_APPROVAL",
  UNDER_REVIEW = "UNDER_REVIEW",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  DISBURSED = "DISBURSED",
  ACTIVE = "ACTIVE",
  DELIVERY_IN_PROGRESS = "DELIVERY_IN_PROGRESS",
  DELIVERY_CONFIRMED = "DELIVERY_CONFIRMED",
  PARTIALLY_REPAID = "PARTIALLY_REPAID",
  COMPLETED = "COMPLETED",
  OVERDUE = "OVERDUE",
  DEFAULT_WARNING = "DEFAULT_WARNING",
  DEFAULTED = "DEFAULTED",
  IN_COLLECTIONS = "IN_COLLECTIONS",
  CANCELLED = "CANCELLED",
  REFUNDED = "REFUNDED",
  DISPUTED = "DISPUTED",
}

/**
 * Approval method enum
 */
export enum ApprovalMethod {
  MANUAL = "MANUAL",
  AUTOMATIC = "AUTOMATIC",
  SEMI_AUTO = "SEMI_AUTO",
}

/**
 * Payment method enum
 */
export enum PaymentMethod {
  STRIPE = "STRIPE",
  OPENPAY = "OPENPAY",
  BANK_TRANSFER = "BANK_TRANSFER",
  SPEI = "SPEI",
  CRYPTO = "CRYPTO",
  CASH = "CASH",
}

/**
 * Advance request input
 */
export interface AdvanceRequest {
  farmerId: string;
  orderId: string;
  requestedAmount?: number; // Optional - will use max allowed if not specified
  disbursementMethod?: PaymentMethod;
  bankAccountId?: string;
  notes?: string;
}

/**
 * Advance calculation result
 */
export interface AdvanceCalculation {
  orderId: string;
  orderAmount: number;
  creditScore: number;
  riskTier: RiskTier;
  maxAdvancePercentage: number;
  maxAdvanceAmount: number;
  requestedAmount: number;
  actualAdvanceAmount: number;
  farmerFeePercentage: number;
  farmerFeeAmount: number;
  buyerFeePercentage: number;
  buyerFeeAmount: number;
  platformFeeTotal: number;
  netToFarmer: number;
  expectedRepaymentDate: Date;
  dueDate: Date;
  implicitInterestRate: number;
  implicitInterestAmount: number;
  costOfCapital: number;
  riskProvision: number;
  operatingCosts: number;
  grossProfit: number;
  profitMargin: number;
  isEligible: boolean;
  eligibilityReasons: string[];
}

/**
 * Advance contract details
 */
export interface AdvanceContractDetails {
  id: string;
  contractNumber: string;
  status: AdvanceStatus;
  // Parties
  farmerId: string;
  farmerName?: string;
  buyerId: string;
  buyerName?: string;
  // Order info
  orderId: string;
  orderNumber: string;
  orderAmount: number;
  // Financial terms
  currency: string;
  advancePercentage: number;
  advanceAmount: number;
  farmerFeePercentage: number;
  farmerFeeAmount: number;
  buyerFeePercentage: number;
  buyerFeeAmount: number;
  platformFeeTotal: number;
  netToFarmer: number;
  // Repayment
  amountRepaid: number;
  remainingBalance: number;
  // Timeline
  requestedAt: Date;
  approvedAt?: Date;
  disbursedAt?: Date;
  dueDate: Date;
  expectedDeliveryDate: Date;
  actualDeliveryDate?: Date;
  repaidAt?: Date;
  // Risk
  creditScore: number;
  riskTier: RiskTier;
  fraudScore?: number;
  // Pool
  poolId: string;
  poolName?: string;
  // Audit
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Repayment input
 */
export interface RepaymentInput {
  advanceId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentReference: string;
  source:
    | "BUYER_PAYMENT"
    | "FARMER_PAYMENT"
    | "INSURANCE"
    | "COLLECTIONS"
    | "OTHER";
  notes?: string;
}

/**
 * Status transition result
 */
export interface StatusTransitionResult {
  success: boolean;
  previousStatus: AdvanceStatus;
  newStatus: AdvanceStatus;
  transitionedAt: Date;
  error?: string;
}

/**
 * Service result wrapper
 */
export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

/**
 * Custom error for idempotent operations
 * Thrown when a duplicate operation is detected inside a transaction
 */
class IdempotencyError extends Error {
  public readonly existingId: string;

  constructor(existingId: string) {
    super("Idempotent operation - resource already exists");
    this.name = "IdempotencyError";
    this.existingId = existingId;
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════════════════

const ADVANCE_CONSTANTS = {
  CONTRACT_PREFIX: "ACF",
  MIN_ADVANCE_AMOUNT: 5000,
  MAX_ADVANCE_AMOUNT: 500000,
  DEFAULT_CURRENCY: "MXN",
  DEFAULT_OPERATING_COST: 100, // Fixed cost per advance
  DEFAULT_DELIVERY_DAYS: 30, // Default delivery period
  PAYMENT_GRACE_DAYS: 7, // Grace period after delivery
  ANNUAL_CAPITAL_COST_RATE: 0.08, // 8% annual cost of capital
  RISK_PROVISION_RATES: {
    [RiskTier.A]: 0.02,
    [RiskTier.B]: 0.05,
    [RiskTier.C]: 0.1,
  },
  AUTO_APPROVE_THRESHOLD: 85, // Credit score threshold for auto-approval
  FRAUD_SCORE_THRESHOLD: 30, // Max fraud score for auto-approval
} as const;

const CACHE_KEYS = {
  ADVANCE: (id: string) => `cfb:advance:${id}`,
  FARMER_ADVANCES: (farmerId: string) => `cfb:farmer:${farmerId}:advances`,
  ORDER_ADVANCE: (orderId: string) => `cfb:order:${orderId}:advance`,
} as const;

const CACHE_TTL = 60; // 1 minute

// Valid status transitions
const VALID_TRANSITIONS: Record<AdvanceStatus, AdvanceStatus[]> = {
  [AdvanceStatus.PENDING_APPROVAL]: [
    AdvanceStatus.UNDER_REVIEW,
    AdvanceStatus.APPROVED,
    AdvanceStatus.REJECTED,
    AdvanceStatus.CANCELLED,
  ],
  [AdvanceStatus.UNDER_REVIEW]: [
    AdvanceStatus.APPROVED,
    AdvanceStatus.REJECTED,
    AdvanceStatus.CANCELLED,
  ],
  [AdvanceStatus.APPROVED]: [AdvanceStatus.DISBURSED, AdvanceStatus.CANCELLED],
  [AdvanceStatus.REJECTED]: [],
  [AdvanceStatus.DISBURSED]: [
    AdvanceStatus.ACTIVE,
    AdvanceStatus.CANCELLED,
    AdvanceStatus.REFUNDED,
  ],
  [AdvanceStatus.ACTIVE]: [
    AdvanceStatus.DELIVERY_IN_PROGRESS,
    AdvanceStatus.PARTIALLY_REPAID,
    AdvanceStatus.COMPLETED,
    AdvanceStatus.OVERDUE,
    AdvanceStatus.DISPUTED,
  ],
  [AdvanceStatus.DELIVERY_IN_PROGRESS]: [
    AdvanceStatus.DELIVERY_CONFIRMED,
    AdvanceStatus.OVERDUE,
    AdvanceStatus.DISPUTED,
  ],
  [AdvanceStatus.DELIVERY_CONFIRMED]: [
    AdvanceStatus.PARTIALLY_REPAID,
    AdvanceStatus.COMPLETED,
    AdvanceStatus.OVERDUE,
  ],
  [AdvanceStatus.PARTIALLY_REPAID]: [
    AdvanceStatus.COMPLETED,
    AdvanceStatus.OVERDUE,
  ],
  [AdvanceStatus.COMPLETED]: [],
  [AdvanceStatus.OVERDUE]: [
    AdvanceStatus.PARTIALLY_REPAID,
    AdvanceStatus.COMPLETED,
    AdvanceStatus.DEFAULT_WARNING,
    AdvanceStatus.DISPUTED,
  ],
  [AdvanceStatus.DEFAULT_WARNING]: [
    AdvanceStatus.PARTIALLY_REPAID,
    AdvanceStatus.COMPLETED,
    AdvanceStatus.DEFAULTED,
  ],
  [AdvanceStatus.DEFAULTED]: [
    AdvanceStatus.IN_COLLECTIONS,
    AdvanceStatus.COMPLETED, // If recovered
  ],
  [AdvanceStatus.IN_COLLECTIONS]: [
    AdvanceStatus.COMPLETED, // If recovered
  ],
  [AdvanceStatus.CANCELLED]: [],
  [AdvanceStatus.REFUNDED]: [],
  [AdvanceStatus.DISPUTED]: [
    AdvanceStatus.ACTIVE,
    AdvanceStatus.COMPLETED,
    AdvanceStatus.DEFAULTED,
  ],
};

// ════════════════════════════════════════════════════════════════════════════════
// SERVICE CLASS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Advance Contract Service
 *
 * Manages the complete lifecycle of cash advances from request to completion.
 */
export class AdvanceContractService {
  private readonly prisma: PrismaClient;
  private readonly redis: Redis | null;
  private readonly creditService: CreditScoringService;
  private readonly poolService: LiquidityPoolService;

  constructor(prisma: PrismaClient, redis?: Redis) {
    this.prisma = prisma;
    this.redis = redis || null;
    this.creditService = createCreditScoringService(prisma, redis);
    this.poolService = createLiquidityPoolService(prisma, redis);
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // ADVANCE REQUEST & CALCULATION
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * Calculate advance terms for an order
   * Does not create the advance - just calculates terms
   */
  async calculateAdvanceTerms(
    farmerId: string,
    orderId: string,
    requestedAmount?: number,
  ): Promise<ServiceResult<AdvanceCalculation>> {
    try {
      // 1. Get order details
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { producer: true },
      });

      if (!order) {
        return { success: false, error: "Order not found" };
      }

      if (order.producerId !== farmerId) {
        return {
          success: false,
          error: "Order does not belong to this farmer",
        };
      }

      // Check if advance already exists
      const existingAdvance = await this.prisma.advanceContract.findUnique({
        where: { orderId },
      });

      if (existingAdvance) {
        return {
          success: false,
          error: "Advance already exists for this order",
        };
      }

      // 2. Get credit score
      const creditResult = await this.creditService.calculateScore({
        producerId: farmerId,
        forceRecalculate: false,
        includeDetails: false,
      });

      if (!creditResult.success || !creditResult.data) {
        return { success: false, error: "Could not retrieve credit score" };
      }

      const creditScore = creditResult.data.overallScore;
      const riskTier = creditResult.data.riskTier as RiskTier;

      // ════════════════════════════════════════════════════════════════════════════════
      // 3. Calculate advance terms with proper rounding
      // FINANCIAL COMPLIANCE: All money calculations use consistent rounding strategies
      // ════════════════════════════════════════════════════════════════════════════════

      const orderAmount = toNumber(order.totalAmount);
      const maxAdvancePercentage = getAdvancePercentageForTier(riskTier);
      const maxAdvanceAmount = ROUNDING_STRATEGIES.AMOUNT(
        (orderAmount * maxAdvancePercentage) / 100,
      );

      const requestedAmountValue = requestedAmount ?? maxAdvanceAmount;
      const actualAdvanceAmount = ROUNDING_STRATEGIES.AMOUNT(
        Math.min(requestedAmountValue, maxAdvanceAmount),
      );

      // Check eligibility
      const eligibilityReasons: string[] = [];
      let isEligible = true;

      if (!order.advanceEligible) {
        isEligible = false;
        eligibilityReasons.push("Order is not marked as advance eligible");
      }

      if (actualAdvanceAmount < ADVANCE_CONSTANTS.MIN_ADVANCE_AMOUNT) {
        isEligible = false;
        eligibilityReasons.push(
          `Amount below minimum (${ADVANCE_CONSTANTS.MIN_ADVANCE_AMOUNT})`,
        );
      }

      if (actualAdvanceAmount > ADVANCE_CONSTANTS.MAX_ADVANCE_AMOUNT) {
        isEligible = false;
        eligibilityReasons.push(
          `Amount above maximum (${ADVANCE_CONSTANTS.MAX_ADVANCE_AMOUNT})`,
        );
      }

      // Check credit eligibility
      const creditEligibility = await this.creditService.checkEligibility({
        producerId: farmerId,
        requestedAmount: actualAdvanceAmount,
        orderId,
      });

      if (!creditEligibility.isEligible) {
        isEligible = false;
        if (creditEligibility.reason) {
          eligibilityReasons.push(creditEligibility.reason);
        }
        if (creditEligibility.conditions) {
          eligibilityReasons.push(...creditEligibility.conditions);
        }
      }

      // ════════════════════════════════════════════════════════════════════════════════
      // 4. Calculate fees with proper rounding strategy
      // FINANCIAL COMPLIANCE:
      // - Platform fees rounded UP (favor platform for risk)
      // - Net to farmer rounded DOWN (conservative estimate for farmer)
      // ════════════════════════════════════════════════════════════════════════════════

      const fees = getFeesForTier(riskTier);
      const farmerFeePercentage = fees.farmerFee;
      const buyerFeePercentage = fees.buyerFee;

      // Calculate fee amounts with proper rounding
      const farmerFeeAmount = ROUNDING_STRATEGIES.FEE(
        (actualAdvanceAmount * farmerFeePercentage) / 100,
      );
      const buyerFeeAmount = ROUNDING_STRATEGIES.FEE(
        (actualAdvanceAmount * buyerFeePercentage) / 100,
      );
      const platformFeeTotal = ROUNDING_STRATEGIES.AMOUNT(
        farmerFeeAmount + buyerFeeAmount,
      );
      const netToFarmer = ROUNDING_STRATEGIES.NET_TO_FARMER(
        actualAdvanceAmount - farmerFeeAmount,
      );

      // 5. Calculate timeline
      const expectedDeliveryDate = order.expectedDeliveryDate;
      const dueDate = new Date(expectedDeliveryDate);
      dueDate.setDate(dueDate.getDate() + ADVANCE_CONSTANTS.PAYMENT_GRACE_DAYS);

      // ════════════════════════════════════════════════════════════════════════════════
      // 6. Calculate costs and profit with proper rounding
      // ════════════════════════════════════════════════════════════════════════════════

      const daysOutstanding = Math.max(
        1,
        Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      );

      const dailyCapitalRate = ADVANCE_CONSTANTS.ANNUAL_CAPITAL_COST_RATE / 365;
      const implicitInterestRate = ROUNDING_STRATEGIES.PERCENTAGE(
        dailyCapitalRate * daysOutstanding * 100,
      );
      const implicitInterestAmount = ROUNDING_STRATEGIES.AMOUNT(
        (actualAdvanceAmount * implicitInterestRate) / 100,
      );

      const costOfCapital = implicitInterestAmount;
      const riskProvision = ROUNDING_STRATEGIES.AMOUNT(
        actualAdvanceAmount * ADVANCE_CONSTANTS.RISK_PROVISION_RATES[riskTier],
      );
      const operatingCosts = ADVANCE_CONSTANTS.DEFAULT_OPERATING_COST;

      const totalCosts = ROUNDING_STRATEGIES.AMOUNT(
        costOfCapital + riskProvision + operatingCosts,
      );
      const grossProfit = ROUNDING_STRATEGIES.AMOUNT(
        platformFeeTotal - totalCosts,
      );
      const profitMargin =
        platformFeeTotal > 0
          ? ROUNDING_STRATEGIES.PERCENTAGE(
              (grossProfit / platformFeeTotal) * 100,
            )
          : 0;

      const calculation: AdvanceCalculation = {
        orderId,
        orderAmount,
        creditScore,
        riskTier,
        maxAdvancePercentage,
        maxAdvanceAmount,
        requestedAmount: requestedAmount || maxAdvanceAmount,
        actualAdvanceAmount,
        farmerFeePercentage,
        farmerFeeAmount,
        buyerFeePercentage,
        buyerFeeAmount,
        platformFeeTotal,
        netToFarmer,
        expectedRepaymentDate: dueDate,
        dueDate,
        implicitInterestRate,
        implicitInterestAmount,
        costOfCapital,
        riskProvision,
        operatingCosts,
        grossProfit,
        profitMargin,
        isEligible,
        eligibilityReasons: isEligible
          ? ["All checks passed"]
          : eligibilityReasons,
      };

      return { success: true, data: calculation };
    } catch (error) {
      console.error("Error calculating advance terms:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to calculate advance",
      };
    }
  }

  /**
   * Request a new advance
   */
  async requestAdvance(
    request: AdvanceRequest,
  ): Promise<ServiceResult<AdvanceContractDetails>> {
    try {
      // 1. Calculate terms first
      const calcResult = await this.calculateAdvanceTerms(
        request.farmerId,
        request.orderId,
        request.requestedAmount,
      );

      if (!calcResult.success || !calcResult.data) {
        return { success: false, error: calcResult.error };
      }

      const calculation = calcResult.data;

      if (!calculation.isEligible) {
        return {
          success: false,
          error: `Not eligible: ${calculation.eligibilityReasons.join(", ")}`,
        };
      }

      // 2. Get order for additional details
      const order = await this.prisma.order.findUnique({
        where: { id: request.orderId },
      });

      if (!order) {
        return { success: false, error: "Order not found" };
      }

      // 3. Determine approval method
      const shouldAutoApprove =
        calculation.creditScore >= ADVANCE_CONSTANTS.AUTO_APPROVE_THRESHOLD;

      // 4. Find an active pool for this advance
      const activePool = await this.prisma.liquidityPool.findFirst({
        where: {
          status: "ACTIVE",
          availableCapital: { gte: calculation.actualAdvanceAmount },
        },
        orderBy: { availableCapital: "desc" },
      });

      if (!activePool) {
        return {
          success: false,
          error: "No liquidity pool available with sufficient capital",
        };
      }

      // 5. Prepare allocation request
      const allocationRequest: PoolAllocationRequest = {
        advanceId: "", // Will be set after advance creation
        farmerId: request.farmerId,
        orderId: request.orderId,
        requestedAmount: calculation.actualAdvanceAmount,
        currency: order.currency,
        riskTier: calculation.riskTier,
        creditScore: calculation.creditScore,
        expectedRepaymentDate: calculation.dueDate,
        expectedDeliveryDate: order.expectedDeliveryDate,
        preferredPoolId: activePool.id,
      };

      // 6. Create advance contract in transaction with idempotency
      // The orderId has a unique constraint so duplicate requests will fail
      const result = await this.prisma.$transaction(async (tx) => {
        // IDEMPOTENCY CHECK: Re-check for existing advance inside transaction
        // This handles race conditions where two requests come in simultaneously
        const existingAdvance = await tx.advanceContract.findUnique({
          where: { orderId: request.orderId },
        });

        if (existingAdvance) {
          // Return existing advance for idempotent behavior
          throw new IdempotencyError(existingAdvance.id);
        }

        // RACE CONDITION FIX: Generate contract number INSIDE transaction with row lock
        const contractNumber = await this.generateContractNumberInTx(tx);

        // Create the advance contract
        const advance = await tx.advanceContract.create({
          data: {
            contractNumber,
            orderId: request.orderId,
            farmerId: request.farmerId,
            buyerId: order.buyerId,
            poolId: activePool.id, // Use pre-selected pool
            currency: order.currency,
            orderAmount: order.totalAmount,
            advancePercentage: new Prisma.Decimal(
              (calculation.actualAdvanceAmount / calculation.orderAmount) * 100,
            ),
            advanceAmount: new Prisma.Decimal(calculation.actualAdvanceAmount),
            farmerFeePercentage: new Prisma.Decimal(
              calculation.farmerFeePercentage,
            ),
            farmerFeeAmount: new Prisma.Decimal(calculation.farmerFeeAmount),
            buyerFeePercentage: new Prisma.Decimal(
              calculation.buyerFeePercentage,
            ),
            buyerFeeAmount: new Prisma.Decimal(calculation.buyerFeeAmount),
            implicitInterest: new Prisma.Decimal(
              calculation.implicitInterestAmount,
            ),
            platformFeeTotal: new Prisma.Decimal(calculation.platformFeeTotal),
            costOfCapital: new Prisma.Decimal(calculation.costOfCapital),
            operatingCosts: new Prisma.Decimal(calculation.operatingCosts),
            riskProvision: new Prisma.Decimal(calculation.riskProvision),
            totalRevenue: new Prisma.Decimal(calculation.platformFeeTotal),
            grossProfit: new Prisma.Decimal(calculation.grossProfit),
            profitMargin: new Prisma.Decimal(calculation.profitMargin),
            expectedDeliveryDate: order.expectedDeliveryDate,
            dueDate: calculation.dueDate,
            status: shouldAutoApprove
              ? AdvanceStatus.APPROVED
              : AdvanceStatus.PENDING_APPROVAL,
            creditScoreValue: new Prisma.Decimal(calculation.creditScore),
            riskTier: calculation.riskTier,
            riskAssessmentScore: new Prisma.Decimal(calculation.creditScore),
            approvalMethod: shouldAutoApprove
              ? ApprovalMethod.AUTOMATIC
              : ApprovalMethod.MANUAL,
            approvedAt: shouldAutoApprove ? new Date() : null,
            remainingBalance: new Prisma.Decimal(
              calculation.actualAdvanceAmount,
            ),
            disbursementMethod:
              request.disbursementMethod || PaymentMethod.STRIPE,
          },
        });

        // Mark order as advance requested
        await tx.order.update({
          where: { id: request.orderId },
          data: {
            advanceRequested: true,
            advanceRequestedAt: new Date(),
          },
        });

        // Record initial status history
        await tx.advanceStatusHistory.create({
          data: {
            advanceId: advance.id,
            fromStatus: null,
            toStatus: advance.status,
            changedBy: "SYSTEM",
            reason: "Advance request created",
          },
        });

        if (shouldAutoApprove) {
          // Record approval status
          await tx.advanceStatusHistory.create({
            data: {
              advanceId: advance.id,
              fromStatus: AdvanceStatus.PENDING_APPROVAL,
              toStatus: AdvanceStatus.APPROVED,
              changedBy: "SYSTEM",
              reason: "Auto-approved based on credit score",
            },
          });
        }

        return advance;
      });

      // 7. Now allocate capital (outside transaction for pool service)
      allocationRequest.advanceId = result.id;
      const allocation =
        await this.poolService.allocateCapital(allocationRequest);

      if (!allocation.success || !allocation.allocation) {
        // Rollback - cancel the advance
        await this.prisma.advanceContract.update({
          where: { id: result.id },
          data: {
            status: AdvanceStatus.CANCELLED,
            rejectionReason: `Capital allocation failed: ${allocation.error}`,
          },
        });

        return {
          success: false,
          error: `Capital allocation failed: ${allocation.error}`,
        };
      }

      // 8. Update advance with pool ID
      await this.prisma.advanceContract.update({
        where: { id: result.id },
        data: {
          poolId: allocation.allocation.poolId,
        },
      });

      // 9. Return advance details
      return await this.getAdvanceDetails(result.id);
    } catch (error) {
      // Handle idempotent requests gracefully
      if (error instanceof IdempotencyError) {
        console.log(
          `[Idempotency] Returning existing advance: ${error.existingId}`,
        );
        return await this.getAdvanceDetails(error.existingId);
      }

      console.error("Error requesting advance:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to request advance",
      };
    }
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // ADVANCE RETRIEVAL
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * Get advance contract details
   */
  async getAdvanceDetails(
    advanceId: string,
  ): Promise<ServiceResult<AdvanceContractDetails>> {
    try {
      // Check cache
      if (this.redis) {
        const cached = await this.redis.get(CACHE_KEYS.ADVANCE(advanceId));
        if (cached) {
          return { success: true, data: JSON.parse(cached) };
        }
      }

      const advance = await this.prisma.advanceContract.findUnique({
        where: { id: advanceId },
        include: {
          order: true,
          farmer: {
            include: { user: true },
          },
          pool: true,
        },
      });

      if (!advance) {
        return { success: false, error: "Advance not found" };
      }

      const details: AdvanceContractDetails = {
        id: advance.id,
        contractNumber: advance.contractNumber,
        status: advance.status as AdvanceStatus,
        farmerId: advance.farmerId,
        farmerName: advance.farmer.businessName,
        buyerId: advance.buyerId,
        orderId: advance.orderId,
        orderNumber: advance.order.orderNumber,
        orderAmount: Number(advance.orderAmount),
        currency: advance.currency,
        advancePercentage: Number(advance.advancePercentage),
        advanceAmount: Number(advance.advanceAmount),
        farmerFeePercentage: Number(advance.farmerFeePercentage),
        farmerFeeAmount: Number(advance.farmerFeeAmount),
        buyerFeePercentage: Number(advance.buyerFeePercentage),
        buyerFeeAmount: Number(advance.buyerFeeAmount),
        platformFeeTotal: Number(advance.platformFeeTotal),
        netToFarmer:
          Number(advance.advanceAmount) - Number(advance.farmerFeeAmount),
        amountRepaid: Number(advance.amountRepaid),
        remainingBalance: Number(advance.remainingBalance),
        requestedAt: advance.requestedAt,
        approvedAt: advance.approvedAt || undefined,
        disbursedAt: advance.disbursedAt || undefined,
        dueDate: advance.dueDate,
        expectedDeliveryDate: advance.expectedDeliveryDate,
        actualDeliveryDate: advance.actualDeliveryDate || undefined,
        repaidAt: advance.repaidAt || undefined,
        creditScore: Number(advance.creditScoreValue),
        riskTier: advance.riskTier as RiskTier,
        fraudScore: advance.fraudScore ? Number(advance.fraudScore) : undefined,
        poolId: advance.poolId,
        poolName: advance.pool?.name,
        createdAt: advance.createdAt,
        updatedAt: advance.updatedAt,
      };

      // Cache
      if (this.redis) {
        await this.redis.setex(
          CACHE_KEYS.ADVANCE(advanceId),
          CACHE_TTL,
          JSON.stringify(details),
        );
      }

      return { success: true, data: details };
    } catch (error) {
      console.error("Error getting advance details:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get advance",
      };
    }
  }

  /**
   * Get advances for a farmer
   */
  async getFarmerAdvances(
    farmerId: string,
    status?: AdvanceStatus[],
  ): Promise<ServiceResult<AdvanceContractDetails[]>> {
    try {
      const where: Prisma.AdvanceContractWhereInput = {
        farmerId,
        deletedAt: null,
      };

      if (status?.length) {
        where.status = { in: status };
      }

      const advances = await this.prisma.advanceContract.findMany({
        where,
        include: {
          order: true,
          farmer: { include: { user: true } },
          pool: true,
        },
        orderBy: { createdAt: "desc" },
      });

      const details: AdvanceContractDetails[] = advances.map((advance) => ({
        id: advance.id,
        contractNumber: advance.contractNumber,
        status: advance.status as AdvanceStatus,
        farmerId: advance.farmerId,
        farmerName: advance.farmer.businessName,
        buyerId: advance.buyerId,
        orderId: advance.orderId,
        orderNumber: advance.order.orderNumber,
        orderAmount: Number(advance.orderAmount),
        currency: advance.currency,
        advancePercentage: Number(advance.advancePercentage),
        advanceAmount: Number(advance.advanceAmount),
        farmerFeePercentage: Number(advance.farmerFeePercentage),
        farmerFeeAmount: Number(advance.farmerFeeAmount),
        buyerFeePercentage: Number(advance.buyerFeePercentage),
        buyerFeeAmount: Number(advance.buyerFeeAmount),
        platformFeeTotal: Number(advance.platformFeeTotal),
        netToFarmer:
          Number(advance.advanceAmount) - Number(advance.farmerFeeAmount),
        amountRepaid: Number(advance.amountRepaid),
        remainingBalance: Number(advance.remainingBalance),
        requestedAt: advance.requestedAt,
        approvedAt: advance.approvedAt || undefined,
        disbursedAt: advance.disbursedAt || undefined,
        dueDate: advance.dueDate,
        expectedDeliveryDate: advance.expectedDeliveryDate,
        actualDeliveryDate: advance.actualDeliveryDate || undefined,
        repaidAt: advance.repaidAt || undefined,
        creditScore: Number(advance.creditScoreValue),
        riskTier: advance.riskTier as RiskTier,
        fraudScore: advance.fraudScore ? Number(advance.fraudScore) : undefined,
        poolId: advance.poolId,
        poolName: advance.pool?.name,
        createdAt: advance.createdAt,
        updatedAt: advance.updatedAt,
      }));

      return { success: true, data: details };
    } catch (error) {
      console.error("Error getting farmer advances:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get advances",
      };
    }
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // STATUS TRANSITIONS
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * Transition advance to a new status
   */
  async transitionStatus(
    advanceId: string,
    newStatus: AdvanceStatus,
    userId: string,
    reason?: string,
  ): Promise<ServiceResult<StatusTransitionResult>> {
    try {
      const advance = await this.prisma.advanceContract.findUnique({
        where: { id: advanceId },
      });

      if (!advance) {
        return { success: false, error: "Advance not found" };
      }

      const currentStatus = advance.status as AdvanceStatus;

      // Validate transition
      const validTransitions = VALID_TRANSITIONS[currentStatus];
      if (!validTransitions.includes(newStatus)) {
        return {
          success: false,
          error: `Invalid transition from ${currentStatus} to ${newStatus}`,
        };
      }

      // Execute transition
      await this.prisma.$transaction(async (tx) => {
        // Update status
        const updateData: Prisma.AdvanceContractUpdateInput = {
          status: newStatus,
        };

        // Set timestamps based on transition
        if (newStatus === AdvanceStatus.APPROVED) {
          updateData.approvedAt = new Date();
        } else if (newStatus === AdvanceStatus.DISBURSED) {
          updateData.disbursedAt = new Date();
        } else if (newStatus === AdvanceStatus.COMPLETED) {
          updateData.repaidAt = new Date();
        }

        await tx.advanceContract.update({
          where: { id: advanceId },
          data: updateData,
        });

        // Record history
        await tx.advanceStatusHistory.create({
          data: {
            advanceId,
            fromStatus: currentStatus,
            toStatus: newStatus,
            changedBy: userId,
            reason: reason || `Status changed to ${newStatus}`,
          },
        });
      });

      // Invalidate cache
      await this.invalidateAdvanceCache(advanceId);

      return {
        success: true,
        data: {
          success: true,
          previousStatus: currentStatus,
          newStatus,
          transitionedAt: new Date(),
        },
      };
    } catch (error) {
      console.error("Error transitioning status:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to transition status",
      };
    }
  }

  /**
   * Disburse an approved advance
   */
  async disburseAdvance(
    advanceId: string,
    disbursementReference: string,
    disbursementFee?: number,
  ): Promise<ServiceResult<{ disbursedAt: Date; reference: string }>> {
    try {
      const advance = await this.prisma.advanceContract.findUnique({
        where: { id: advanceId },
      });

      if (!advance) {
        return { success: false, error: "Advance not found" };
      }

      if (advance.status !== AdvanceStatus.APPROVED) {
        return {
          success: false,
          error: "Advance must be approved before disbursement",
        };
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.advanceContract.update({
          where: { id: advanceId },
          data: {
            status: AdvanceStatus.DISBURSED,
            disbursedAt: new Date(),
            disbursementReference,
            disbursementFee: disbursementFee
              ? new Prisma.Decimal(disbursementFee)
              : undefined,
          },
        });

        // Record transaction
        const txnNumber = `TXN-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
        await tx.advanceTransaction.create({
          data: {
            transactionNumber: txnNumber,
            advanceId,
            type: "ADVANCE_DISBURSEMENT",
            amount: advance.advanceAmount,
            paymentMethod: advance.disbursementMethod,
            paymentProvider:
              advance.disbursementMethod === "STRIPE" ? "Stripe" : "Bank",
            paymentReference: disbursementReference,
            paymentStatus: "COMPLETED",
            balanceBefore: advance.remainingBalance,
            balanceAfter: advance.remainingBalance,
            description: `Advance disbursed to farmer`,
            processedAt: new Date(),
          },
        });

        // Record status history
        await tx.advanceStatusHistory.create({
          data: {
            advanceId,
            fromStatus: AdvanceStatus.APPROVED,
            toStatus: AdvanceStatus.DISBURSED,
            changedBy: "SYSTEM",
            reason: "Funds disbursed successfully",
          },
        });
      });

      // Transition to ACTIVE
      await this.transitionStatus(
        advanceId,
        AdvanceStatus.ACTIVE,
        "SYSTEM",
        "Post-disbursement",
      );

      await this.invalidateAdvanceCache(advanceId);

      return {
        success: true,
        data: {
          disbursedAt: new Date(),
          reference: disbursementReference,
        },
      };
    } catch (error) {
      console.error("Error disbursing advance:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to disburse advance",
      };
    }
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // REPAYMENT PROCESSING
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * Process a repayment
   */
  async processRepayment(input: RepaymentInput): Promise<
    ServiceResult<{
      amountApplied: number;
      remainingBalance: number;
      isFullyRepaid: boolean;
      feesCollected: number;
    }>
  > {
    try {
      const advance = await this.prisma.advanceContract.findUnique({
        where: { id: input.advanceId },
      });

      if (!advance) {
        return { success: false, error: "Advance not found" };
      }

      // Validate status allows repayment
      const repayableStatuses = [
        AdvanceStatus.ACTIVE,
        AdvanceStatus.DELIVERY_IN_PROGRESS,
        AdvanceStatus.DELIVERY_CONFIRMED,
        AdvanceStatus.PARTIALLY_REPAID,
        AdvanceStatus.OVERDUE,
        AdvanceStatus.DEFAULT_WARNING,
      ];

      if (!repayableStatuses.includes(advance.status as AdvanceStatus)) {
        return {
          success: false,
          error: `Cannot process repayment for advance in status ${advance.status}`,
        };
      }

      const currentBalance = Number(advance.remainingBalance);
      const amountToApply = Math.min(input.amount, currentBalance);
      const newBalance = currentBalance - amountToApply;
      const isFullyRepaid = newBalance <= 0;

      // Calculate fees (buyer fee on this repayment proportionally)
      const totalAdvance = Number(advance.advanceAmount);
      const buyerFeeTotal = Number(advance.buyerFeeAmount);
      const feesCollected = (amountToApply / totalAdvance) * buyerFeeTotal;

      await this.prisma.$transaction(async (tx) => {
        // Update advance
        const newStatus = isFullyRepaid
          ? AdvanceStatus.COMPLETED
          : AdvanceStatus.PARTIALLY_REPAID;

        await tx.advanceContract.update({
          where: { id: input.advanceId },
          data: {
            amountRepaid: {
              increment: new Prisma.Decimal(amountToApply),
            },
            remainingBalance: new Prisma.Decimal(newBalance),
            status: newStatus,
            repaidAt: isFullyRepaid ? new Date() : undefined,
          },
        });

        // Record transaction
        const repaymentTxnNumber = `TXN-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
        await tx.advanceTransaction.create({
          data: {
            transactionNumber: repaymentTxnNumber,
            advanceId: input.advanceId,
            type: isFullyRepaid ? "FINAL_REPAYMENT" : "PARTIAL_REPAYMENT",
            amount: new Prisma.Decimal(amountToApply),
            paymentMethod: input.paymentMethod,
            paymentProvider:
              input.paymentMethod === "STRIPE" ? "Stripe" : "Bank",
            paymentReference: input.paymentReference,
            paymentStatus: "COMPLETED",
            balanceBefore: new Prisma.Decimal(currentBalance),
            balanceAfter: new Prisma.Decimal(newBalance),
            description: input.notes || `Repayment from ${input.source}`,
            processedAt: new Date(),
          },
        });

        // Record status history
        await tx.advanceStatusHistory.create({
          data: {
            advanceId: input.advanceId,
            fromStatus: advance.status,
            toStatus: newStatus,
            changedBy: "SYSTEM",
            reason: `Repayment of ${amountToApply} received`,
          },
        });
      });

      // Release capital back to pool
      const releaseRequest: CapitalReleaseRequest = {
        advanceId: input.advanceId,
        poolId: advance.poolId,
        amount: amountToApply,
        releaseType: isFullyRepaid ? "FULL_REPAYMENT" : "PARTIAL_REPAYMENT",
        source: input.source,
        paymentReference: input.paymentReference,
        feesCollected,
      };

      await this.poolService.releaseCapital(releaseRequest);

      // Update credit score
      if (isFullyRepaid) {
        await this.creditService.recalculateScore(advance.farmerId);
      }

      await this.invalidateAdvanceCache(input.advanceId);

      return {
        success: true,
        data: {
          amountApplied: amountToApply,
          remainingBalance: newBalance,
          isFullyRepaid,
          feesCollected,
        },
      };
    } catch (error) {
      console.error("Error processing repayment:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to process repayment",
      };
    }
  }

  /**
   * Mark advance as defaulted
   */
  async markAsDefaulted(
    advanceId: string,
    reason: string,
    recoveredAmount: number = 0,
  ): Promise<ServiceResult<{ lossAmount: number }>> {
    try {
      const advance = await this.prisma.advanceContract.findUnique({
        where: { id: advanceId },
      });

      if (!advance) {
        return { success: false, error: "Advance not found" };
      }

      const remainingBalance = Number(advance.remainingBalance);
      const lossAmount = remainingBalance - recoveredAmount;

      await this.prisma.$transaction(async (tx) => {
        await tx.advanceContract.update({
          where: { id: advanceId },
          data: {
            status: AdvanceStatus.DEFAULTED,
            amountRepaid: {
              increment: new Prisma.Decimal(recoveredAmount),
            },
            remainingBalance: new Prisma.Decimal(0),
          },
        });

        await tx.advanceStatusHistory.create({
          data: {
            advanceId,
            fromStatus: advance.status,
            toStatus: AdvanceStatus.DEFAULTED,
            changedBy: "SYSTEM",
            reason,
          },
        });
      });

      // Handle pool default
      await this.poolService.handleDefault(
        advanceId,
        advance.poolId,
        remainingBalance,
        recoveredAmount,
      );

      // Update credit score (negative impact)
      await this.creditService.recalculateScore(advance.farmerId);

      await this.invalidateAdvanceCache(advanceId);

      return {
        success: true,
        data: { lossAmount },
      };
    } catch (error) {
      console.error("Error marking as defaulted:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to mark as defaulted",
      };
    }
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * Generate unique contract number INSIDE a transaction
   * Uses SELECT FOR UPDATE to prevent race conditions
   *
   * @param tx - Prisma transaction client
   * @returns Unique contract number in format ACF-YYYY-XXXXX
   *
   * SECURITY FIX: Contract number generation MUST be inside transaction
   * to prevent duplicate contract numbers from race conditions
   */
  private async generateContractNumberInTx(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = ADVANCE_CONSTANTS.CONTRACT_PREFIX;

    // Use raw query with FOR UPDATE to lock the row during selection
    // This prevents two concurrent transactions from getting the same number
    const result = await tx.$queryRaw<{ contractNumber: string }[]>`
      SELECT "contractNumber"
      FROM "AdvanceContract"
      WHERE "contractNumber" LIKE ${`${prefix}-${year}-%`}
      ORDER BY "contractNumber" DESC
      LIMIT 1
      FOR UPDATE
    `;

    let sequence = 1;
    if (result.length > 0 && result[0].contractNumber) {
      const parts = result[0].contractNumber.split("-");
      sequence = parseInt(parts[2], 10) + 1;
    }

    // Add safety check - if parsed sequence is NaN or 0, start at 1
    if (isNaN(sequence) || sequence < 1) {
      sequence = 1;
    }

    return `${prefix}-${year}-${sequence.toString().padStart(5, "0")}`;
  }

  /**
   * Invalidate advance cache
   */
  private async invalidateAdvanceCache(advanceId: string): Promise<void> {
    if (!this.redis) return;

    const advance = await this.prisma.advanceContract.findUnique({
      where: { id: advanceId },
      select: { farmerId: true, orderId: true },
    });

    if (advance) {
      await Promise.all([
        this.redis.del(CACHE_KEYS.ADVANCE(advanceId)),
        this.redis.del(CACHE_KEYS.FARMER_ADVANCES(advance.farmerId)),
        this.redis.del(CACHE_KEYS.ORDER_ADVANCE(advance.orderId)),
      ]);
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Create a new AdvanceContractService instance
 */
export function createAdvanceContractService(
  prisma: PrismaClient,
  redis?: Redis,
): AdvanceContractService {
  return new AdvanceContractService(prisma, redis);
}
