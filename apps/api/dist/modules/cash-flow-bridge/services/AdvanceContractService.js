import { Prisma } from '@prisma/client';
import { createCreditScoringService, } from '../../credit-scoring/services/credit-scoring.service.js';
import { createLiquidityPoolService, RiskTier, getFeesForTier, getAdvancePercentageForTier, } from '../../liquidity-pools/index.js';
const ROUNDING = {
    UP: 0,
    DOWN: 1,
    HALF_UP: 4,
};
function roundTo(value, decimals, mode) {
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
const ROUNDING_STRATEGIES = {
    FEE: (amount) => roundTo(amount, 2, ROUNDING.UP),
    NET_TO_FARMER: (amount) => roundTo(amount, 2, ROUNDING.DOWN),
    AMOUNT: (amount) => roundTo(amount, 2, ROUNDING.HALF_UP),
    PERCENTAGE: (amount) => roundTo(amount, 4, ROUNDING.HALF_UP),
};
function toNumber(value) {
    if (typeof value === 'number')
        return value;
    if (typeof value === 'string')
        return parseFloat(value);
    return Number(value.toString());
}
export var AdvanceStatus;
(function (AdvanceStatus) {
    AdvanceStatus["PENDING_APPROVAL"] = "PENDING_APPROVAL";
    AdvanceStatus["UNDER_REVIEW"] = "UNDER_REVIEW";
    AdvanceStatus["APPROVED"] = "APPROVED";
    AdvanceStatus["REJECTED"] = "REJECTED";
    AdvanceStatus["DISBURSED"] = "DISBURSED";
    AdvanceStatus["ACTIVE"] = "ACTIVE";
    AdvanceStatus["DELIVERY_IN_PROGRESS"] = "DELIVERY_IN_PROGRESS";
    AdvanceStatus["DELIVERY_CONFIRMED"] = "DELIVERY_CONFIRMED";
    AdvanceStatus["PARTIALLY_REPAID"] = "PARTIALLY_REPAID";
    AdvanceStatus["COMPLETED"] = "COMPLETED";
    AdvanceStatus["OVERDUE"] = "OVERDUE";
    AdvanceStatus["DEFAULT_WARNING"] = "DEFAULT_WARNING";
    AdvanceStatus["DEFAULTED"] = "DEFAULTED";
    AdvanceStatus["IN_COLLECTIONS"] = "IN_COLLECTIONS";
    AdvanceStatus["CANCELLED"] = "CANCELLED";
    AdvanceStatus["REFUNDED"] = "REFUNDED";
    AdvanceStatus["DISPUTED"] = "DISPUTED";
})(AdvanceStatus || (AdvanceStatus = {}));
export var ApprovalMethod;
(function (ApprovalMethod) {
    ApprovalMethod["MANUAL"] = "MANUAL";
    ApprovalMethod["AUTOMATIC"] = "AUTOMATIC";
    ApprovalMethod["SEMI_AUTO"] = "SEMI_AUTO";
})(ApprovalMethod || (ApprovalMethod = {}));
export var PaymentMethod;
(function (PaymentMethod) {
    PaymentMethod["STRIPE"] = "STRIPE";
    PaymentMethod["OPENPAY"] = "OPENPAY";
    PaymentMethod["BANK_TRANSFER"] = "BANK_TRANSFER";
    PaymentMethod["SPEI"] = "SPEI";
    PaymentMethod["CRYPTO"] = "CRYPTO";
    PaymentMethod["CASH"] = "CASH";
})(PaymentMethod || (PaymentMethod = {}));
class IdempotencyError extends Error {
    existingId;
    constructor(existingId) {
        super('Idempotent operation - resource already exists');
        this.name = 'IdempotencyError';
        this.existingId = existingId;
    }
}
const ADVANCE_CONSTANTS = {
    CONTRACT_PREFIX: 'ACF',
    MIN_ADVANCE_AMOUNT: 5000,
    MAX_ADVANCE_AMOUNT: 500000,
    DEFAULT_CURRENCY: 'MXN',
    DEFAULT_OPERATING_COST: 100,
    DEFAULT_DELIVERY_DAYS: 30,
    PAYMENT_GRACE_DAYS: 7,
    ANNUAL_CAPITAL_COST_RATE: 0.08,
    RISK_PROVISION_RATES: {
        [RiskTier.A]: 0.02,
        [RiskTier.B]: 0.05,
        [RiskTier.C]: 0.10,
    },
    AUTO_APPROVE_THRESHOLD: 85,
    FRAUD_SCORE_THRESHOLD: 30,
};
const CACHE_KEYS = {
    ADVANCE: (id) => `cfb:advance:${id}`,
    FARMER_ADVANCES: (farmerId) => `cfb:farmer:${farmerId}:advances`,
    ORDER_ADVANCE: (orderId) => `cfb:order:${orderId}:advance`,
};
const CACHE_TTL = 60;
const VALID_TRANSITIONS = {
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
    [AdvanceStatus.APPROVED]: [
        AdvanceStatus.DISBURSED,
        AdvanceStatus.CANCELLED,
    ],
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
        AdvanceStatus.COMPLETED,
    ],
    [AdvanceStatus.IN_COLLECTIONS]: [
        AdvanceStatus.COMPLETED,
    ],
    [AdvanceStatus.CANCELLED]: [],
    [AdvanceStatus.REFUNDED]: [],
    [AdvanceStatus.DISPUTED]: [
        AdvanceStatus.ACTIVE,
        AdvanceStatus.COMPLETED,
        AdvanceStatus.DEFAULTED,
    ],
};
export class AdvanceContractService {
    prisma;
    redis;
    creditService;
    poolService;
    constructor(prisma, redis) {
        this.prisma = prisma;
        this.redis = redis || null;
        this.creditService = createCreditScoringService(prisma, redis);
        this.poolService = createLiquidityPoolService(prisma, redis);
    }
    async calculateAdvanceTerms(farmerId, orderId, requestedAmount) {
        try {
            const order = await this.prisma.order.findUnique({
                where: { id: orderId },
                include: { producer: true },
            });
            if (!order) {
                return { success: false, error: 'Order not found' };
            }
            if (order.producerId !== farmerId) {
                return { success: false, error: 'Order does not belong to this farmer' };
            }
            const existingAdvance = await this.prisma.advanceContract.findUnique({
                where: { orderId },
            });
            if (existingAdvance) {
                return { success: false, error: 'Advance already exists for this order' };
            }
            const creditResult = await this.creditService.calculateScore({
                producerId: farmerId,
                forceRecalculate: false,
                includeDetails: false,
            });
            if (!creditResult.success || !creditResult.data) {
                return { success: false, error: 'Could not retrieve credit score' };
            }
            const creditScore = creditResult.data.overallScore;
            const riskTier = creditResult.data.riskTier;
            const orderAmount = toNumber(order.totalAmount);
            const maxAdvancePercentage = getAdvancePercentageForTier(riskTier);
            const maxAdvanceAmount = ROUNDING_STRATEGIES.AMOUNT(orderAmount * maxAdvancePercentage / 100);
            const requestedAmountValue = requestedAmount ?? maxAdvanceAmount;
            const actualAdvanceAmount = ROUNDING_STRATEGIES.AMOUNT(Math.min(requestedAmountValue, maxAdvanceAmount));
            const eligibilityReasons = [];
            let isEligible = true;
            if (!order.advanceEligible) {
                isEligible = false;
                eligibilityReasons.push('Order is not marked as advance eligible');
            }
            if (actualAdvanceAmount < ADVANCE_CONSTANTS.MIN_ADVANCE_AMOUNT) {
                isEligible = false;
                eligibilityReasons.push(`Amount below minimum (${ADVANCE_CONSTANTS.MIN_ADVANCE_AMOUNT})`);
            }
            if (actualAdvanceAmount > ADVANCE_CONSTANTS.MAX_ADVANCE_AMOUNT) {
                isEligible = false;
                eligibilityReasons.push(`Amount above maximum (${ADVANCE_CONSTANTS.MAX_ADVANCE_AMOUNT})`);
            }
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
            const fees = getFeesForTier(riskTier);
            const farmerFeePercentage = fees.farmerFee;
            const buyerFeePercentage = fees.buyerFee;
            const farmerFeeAmount = ROUNDING_STRATEGIES.FEE(actualAdvanceAmount * farmerFeePercentage / 100);
            const buyerFeeAmount = ROUNDING_STRATEGIES.FEE(actualAdvanceAmount * buyerFeePercentage / 100);
            const platformFeeTotal = ROUNDING_STRATEGIES.AMOUNT(farmerFeeAmount + buyerFeeAmount);
            const netToFarmer = ROUNDING_STRATEGIES.NET_TO_FARMER(actualAdvanceAmount - farmerFeeAmount);
            const expectedDeliveryDate = order.expectedDeliveryDate;
            const dueDate = new Date(expectedDeliveryDate);
            dueDate.setDate(dueDate.getDate() + ADVANCE_CONSTANTS.PAYMENT_GRACE_DAYS);
            const daysOutstanding = Math.max(1, Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
            const dailyCapitalRate = ADVANCE_CONSTANTS.ANNUAL_CAPITAL_COST_RATE / 365;
            const implicitInterestRate = ROUNDING_STRATEGIES.PERCENTAGE(dailyCapitalRate * daysOutstanding * 100);
            const implicitInterestAmount = ROUNDING_STRATEGIES.AMOUNT(actualAdvanceAmount * implicitInterestRate / 100);
            const costOfCapital = implicitInterestAmount;
            const riskProvision = ROUNDING_STRATEGIES.AMOUNT(actualAdvanceAmount * ADVANCE_CONSTANTS.RISK_PROVISION_RATES[riskTier]);
            const operatingCosts = ADVANCE_CONSTANTS.DEFAULT_OPERATING_COST;
            const totalCosts = ROUNDING_STRATEGIES.AMOUNT(costOfCapital + riskProvision + operatingCosts);
            const grossProfit = ROUNDING_STRATEGIES.AMOUNT(platformFeeTotal - totalCosts);
            const profitMargin = platformFeeTotal > 0
                ? ROUNDING_STRATEGIES.PERCENTAGE((grossProfit / platformFeeTotal) * 100)
                : 0;
            const calculation = {
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
                eligibilityReasons: isEligible ? ['All checks passed'] : eligibilityReasons,
            };
            return { success: true, data: calculation };
        }
        catch (error) {
            console.error('Error calculating advance terms:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to calculate advance',
            };
        }
    }
    async requestAdvance(request) {
        try {
            const calcResult = await this.calculateAdvanceTerms(request.farmerId, request.orderId, request.requestedAmount);
            if (!calcResult.success || !calcResult.data) {
                return { success: false, error: calcResult.error };
            }
            const calculation = calcResult.data;
            if (!calculation.isEligible) {
                return {
                    success: false,
                    error: `Not eligible: ${calculation.eligibilityReasons.join(', ')}`,
                };
            }
            const order = await this.prisma.order.findUnique({
                where: { id: request.orderId },
            });
            if (!order) {
                return { success: false, error: 'Order not found' };
            }
            const shouldAutoApprove = calculation.creditScore >= ADVANCE_CONSTANTS.AUTO_APPROVE_THRESHOLD;
            const activePool = await this.prisma.liquidityPool.findFirst({
                where: {
                    status: 'ACTIVE',
                    availableCapital: { gte: calculation.actualAdvanceAmount },
                },
                orderBy: { availableCapital: 'desc' },
            });
            if (!activePool) {
                return {
                    success: false,
                    error: 'No liquidity pool available with sufficient capital',
                };
            }
            const allocationRequest = {
                advanceId: '',
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
            const result = await this.prisma.$transaction(async (tx) => {
                const existingAdvance = await tx.advanceContract.findUnique({
                    where: { orderId: request.orderId },
                });
                if (existingAdvance) {
                    throw new IdempotencyError(existingAdvance.id);
                }
                const contractNumber = await this.generateContractNumberInTx(tx);
                const advance = await tx.advanceContract.create({
                    data: {
                        contractNumber,
                        orderId: request.orderId,
                        farmerId: request.farmerId,
                        buyerId: order.buyerId,
                        poolId: activePool.id,
                        currency: order.currency,
                        orderAmount: order.totalAmount,
                        advancePercentage: new Prisma.Decimal((calculation.actualAdvanceAmount / calculation.orderAmount) * 100),
                        advanceAmount: new Prisma.Decimal(calculation.actualAdvanceAmount),
                        farmerFeePercentage: new Prisma.Decimal(calculation.farmerFeePercentage),
                        farmerFeeAmount: new Prisma.Decimal(calculation.farmerFeeAmount),
                        buyerFeePercentage: new Prisma.Decimal(calculation.buyerFeePercentage),
                        buyerFeeAmount: new Prisma.Decimal(calculation.buyerFeeAmount),
                        implicitInterest: new Prisma.Decimal(calculation.implicitInterestAmount),
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
                        remainingBalance: new Prisma.Decimal(calculation.actualAdvanceAmount),
                        disbursementMethod: request.disbursementMethod || PaymentMethod.STRIPE,
                    },
                });
                await tx.order.update({
                    where: { id: request.orderId },
                    data: {
                        advanceRequested: true,
                        advanceRequestedAt: new Date(),
                    },
                });
                await tx.advanceStatusHistory.create({
                    data: {
                        advanceId: advance.id,
                        fromStatus: null,
                        toStatus: advance.status,
                        changedBy: 'SYSTEM',
                        reason: 'Advance request created',
                    },
                });
                if (shouldAutoApprove) {
                    await tx.advanceStatusHistory.create({
                        data: {
                            advanceId: advance.id,
                            fromStatus: AdvanceStatus.PENDING_APPROVAL,
                            toStatus: AdvanceStatus.APPROVED,
                            changedBy: 'SYSTEM',
                            reason: 'Auto-approved based on credit score',
                        },
                    });
                }
                return advance;
            });
            allocationRequest.advanceId = result.id;
            const allocation = await this.poolService.allocateCapital(allocationRequest);
            if (!allocation.success || !allocation.allocation) {
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
            await this.prisma.advanceContract.update({
                where: { id: result.id },
                data: {
                    poolId: allocation.allocation.poolId,
                },
            });
            return await this.getAdvanceDetails(result.id);
        }
        catch (error) {
            if (error instanceof IdempotencyError) {
                console.log(`[Idempotency] Returning existing advance: ${error.existingId}`);
                return await this.getAdvanceDetails(error.existingId);
            }
            console.error('Error requesting advance:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to request advance',
            };
        }
    }
    async getAdvanceDetails(advanceId) {
        try {
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
                return { success: false, error: 'Advance not found' };
            }
            const details = {
                id: advance.id,
                contractNumber: advance.contractNumber,
                status: advance.status,
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
                netToFarmer: Number(advance.advanceAmount) - Number(advance.farmerFeeAmount),
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
                riskTier: advance.riskTier,
                fraudScore: advance.fraudScore ? Number(advance.fraudScore) : undefined,
                poolId: advance.poolId,
                poolName: advance.pool?.name,
                createdAt: advance.createdAt,
                updatedAt: advance.updatedAt,
            };
            if (this.redis) {
                await this.redis.setex(CACHE_KEYS.ADVANCE(advanceId), CACHE_TTL, JSON.stringify(details));
            }
            return { success: true, data: details };
        }
        catch (error) {
            console.error('Error getting advance details:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get advance',
            };
        }
    }
    async getFarmerAdvances(farmerId, status) {
        try {
            const where = {
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
                orderBy: { createdAt: 'desc' },
            });
            const details = advances.map((advance) => ({
                id: advance.id,
                contractNumber: advance.contractNumber,
                status: advance.status,
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
                netToFarmer: Number(advance.advanceAmount) - Number(advance.farmerFeeAmount),
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
                riskTier: advance.riskTier,
                fraudScore: advance.fraudScore ? Number(advance.fraudScore) : undefined,
                poolId: advance.poolId,
                poolName: advance.pool?.name,
                createdAt: advance.createdAt,
                updatedAt: advance.updatedAt,
            }));
            return { success: true, data: details };
        }
        catch (error) {
            console.error('Error getting farmer advances:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get advances',
            };
        }
    }
    async transitionStatus(advanceId, newStatus, userId, reason) {
        try {
            const advance = await this.prisma.advanceContract.findUnique({
                where: { id: advanceId },
            });
            if (!advance) {
                return { success: false, error: 'Advance not found' };
            }
            const currentStatus = advance.status;
            const validTransitions = VALID_TRANSITIONS[currentStatus];
            if (!validTransitions.includes(newStatus)) {
                return {
                    success: false,
                    error: `Invalid transition from ${currentStatus} to ${newStatus}`,
                };
            }
            await this.prisma.$transaction(async (tx) => {
                const updateData = {
                    status: newStatus,
                };
                if (newStatus === AdvanceStatus.APPROVED) {
                    updateData.approvedAt = new Date();
                }
                else if (newStatus === AdvanceStatus.DISBURSED) {
                    updateData.disbursedAt = new Date();
                }
                else if (newStatus === AdvanceStatus.COMPLETED) {
                    updateData.repaidAt = new Date();
                }
                await tx.advanceContract.update({
                    where: { id: advanceId },
                    data: updateData,
                });
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
        }
        catch (error) {
            console.error('Error transitioning status:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to transition status',
            };
        }
    }
    async disburseAdvance(advanceId, disbursementReference, disbursementFee) {
        try {
            const advance = await this.prisma.advanceContract.findUnique({
                where: { id: advanceId },
            });
            if (!advance) {
                return { success: false, error: 'Advance not found' };
            }
            if (advance.status !== AdvanceStatus.APPROVED) {
                return { success: false, error: 'Advance must be approved before disbursement' };
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
                const txnNumber = `TXN-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
                await tx.advanceTransaction.create({
                    data: {
                        transactionNumber: txnNumber,
                        advanceId,
                        type: 'ADVANCE_DISBURSEMENT',
                        amount: advance.advanceAmount,
                        paymentMethod: advance.disbursementMethod,
                        paymentProvider: advance.disbursementMethod === 'STRIPE' ? 'Stripe' : 'Bank',
                        paymentReference: disbursementReference,
                        paymentStatus: 'COMPLETED',
                        balanceBefore: advance.remainingBalance,
                        balanceAfter: advance.remainingBalance,
                        description: `Advance disbursed to farmer`,
                        processedAt: new Date(),
                    },
                });
                await tx.advanceStatusHistory.create({
                    data: {
                        advanceId,
                        fromStatus: AdvanceStatus.APPROVED,
                        toStatus: AdvanceStatus.DISBURSED,
                        changedBy: 'SYSTEM',
                        reason: 'Funds disbursed successfully',
                    },
                });
            });
            await this.transitionStatus(advanceId, AdvanceStatus.ACTIVE, 'SYSTEM', 'Post-disbursement');
            await this.invalidateAdvanceCache(advanceId);
            return {
                success: true,
                data: {
                    disbursedAt: new Date(),
                    reference: disbursementReference,
                },
            };
        }
        catch (error) {
            console.error('Error disbursing advance:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to disburse advance',
            };
        }
    }
    async processRepayment(input) {
        try {
            const advance = await this.prisma.advanceContract.findUnique({
                where: { id: input.advanceId },
            });
            if (!advance) {
                return { success: false, error: 'Advance not found' };
            }
            const repayableStatuses = [
                AdvanceStatus.ACTIVE,
                AdvanceStatus.DELIVERY_IN_PROGRESS,
                AdvanceStatus.DELIVERY_CONFIRMED,
                AdvanceStatus.PARTIALLY_REPAID,
                AdvanceStatus.OVERDUE,
                AdvanceStatus.DEFAULT_WARNING,
            ];
            if (!repayableStatuses.includes(advance.status)) {
                return {
                    success: false,
                    error: `Cannot process repayment for advance in status ${advance.status}`,
                };
            }
            const currentBalance = Number(advance.remainingBalance);
            const amountToApply = Math.min(input.amount, currentBalance);
            const newBalance = currentBalance - amountToApply;
            const isFullyRepaid = newBalance <= 0;
            const totalAdvance = Number(advance.advanceAmount);
            const buyerFeeTotal = Number(advance.buyerFeeAmount);
            const feesCollected = (amountToApply / totalAdvance) * buyerFeeTotal;
            await this.prisma.$transaction(async (tx) => {
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
                const repaymentTxnNumber = `TXN-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
                await tx.advanceTransaction.create({
                    data: {
                        transactionNumber: repaymentTxnNumber,
                        advanceId: input.advanceId,
                        type: isFullyRepaid ? 'FINAL_REPAYMENT' : 'PARTIAL_REPAYMENT',
                        amount: new Prisma.Decimal(amountToApply),
                        paymentMethod: input.paymentMethod,
                        paymentProvider: input.paymentMethod === 'STRIPE' ? 'Stripe' : 'Bank',
                        paymentReference: input.paymentReference,
                        paymentStatus: 'COMPLETED',
                        balanceBefore: new Prisma.Decimal(currentBalance),
                        balanceAfter: new Prisma.Decimal(newBalance),
                        description: input.notes || `Repayment from ${input.source}`,
                        processedAt: new Date(),
                    },
                });
                await tx.advanceStatusHistory.create({
                    data: {
                        advanceId: input.advanceId,
                        fromStatus: advance.status,
                        toStatus: newStatus,
                        changedBy: 'SYSTEM',
                        reason: `Repayment of ${amountToApply} received`,
                    },
                });
            });
            const releaseRequest = {
                advanceId: input.advanceId,
                poolId: advance.poolId,
                amount: amountToApply,
                releaseType: isFullyRepaid ? 'FULL_REPAYMENT' : 'PARTIAL_REPAYMENT',
                source: input.source,
                paymentReference: input.paymentReference,
                feesCollected,
            };
            await this.poolService.releaseCapital(releaseRequest);
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
        }
        catch (error) {
            console.error('Error processing repayment:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to process repayment',
            };
        }
    }
    async markAsDefaulted(advanceId, reason, recoveredAmount = 0) {
        try {
            const advance = await this.prisma.advanceContract.findUnique({
                where: { id: advanceId },
            });
            if (!advance) {
                return { success: false, error: 'Advance not found' };
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
                        changedBy: 'SYSTEM',
                        reason,
                    },
                });
            });
            await this.poolService.handleDefault(advanceId, advance.poolId, remainingBalance, recoveredAmount);
            await this.creditService.recalculateScore(advance.farmerId);
            await this.invalidateAdvanceCache(advanceId);
            return {
                success: true,
                data: { lossAmount },
            };
        }
        catch (error) {
            console.error('Error marking as defaulted:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to mark as defaulted',
            };
        }
    }
    async generateContractNumberInTx(tx) {
        const year = new Date().getFullYear();
        const prefix = ADVANCE_CONSTANTS.CONTRACT_PREFIX;
        const result = await tx.$queryRaw `
      SELECT "contractNumber"
      FROM "AdvanceContract"
      WHERE "contractNumber" LIKE ${`${prefix}-${year}-%`}
      ORDER BY "contractNumber" DESC
      LIMIT 1
      FOR UPDATE
    `;
        let sequence = 1;
        if (result.length > 0 && result[0].contractNumber) {
            const parts = result[0].contractNumber.split('-');
            sequence = parseInt(parts[2], 10) + 1;
        }
        if (isNaN(sequence) || sequence < 1) {
            sequence = 1;
        }
        return `${prefix}-${year}-${sequence.toString().padStart(5, '0')}`;
    }
    async invalidateAdvanceCache(advanceId) {
        if (!this.redis)
            return;
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
export function createAdvanceContractService(prisma, redis) {
    return new AdvanceContractService(prisma, redis);
}
