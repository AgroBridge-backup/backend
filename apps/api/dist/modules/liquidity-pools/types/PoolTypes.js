export var PoolStatus;
(function (PoolStatus) {
    PoolStatus["ACTIVE"] = "ACTIVE";
    PoolStatus["PAUSED"] = "PAUSED";
    PoolStatus["CLOSED"] = "CLOSED";
    PoolStatus["LIQUIDATING"] = "LIQUIDATING";
})(PoolStatus || (PoolStatus = {}));
export var RiskTier;
(function (RiskTier) {
    RiskTier["A"] = "A";
    RiskTier["B"] = "B";
    RiskTier["C"] = "C";
})(RiskTier || (RiskTier = {}));
export var InvestorType;
(function (InvestorType) {
    InvestorType["INDIVIDUAL"] = "INDIVIDUAL";
    InvestorType["INSTITUTION"] = "INSTITUTION";
    InvestorType["FUND"] = "FUND";
})(InvestorType || (InvestorType = {}));
export var InvestorStatus;
(function (InvestorStatus) {
    InvestorStatus["ACTIVE"] = "ACTIVE";
    InvestorStatus["SUSPENDED"] = "SUSPENDED";
    InvestorStatus["WITHDRAWN"] = "WITHDRAWN";
    InvestorStatus["PENDING_KYC"] = "PENDING_KYC";
})(InvestorStatus || (InvestorStatus = {}));
export var PoolTransactionType;
(function (PoolTransactionType) {
    PoolTransactionType["CAPITAL_DEPOSIT"] = "CAPITAL_DEPOSIT";
    PoolTransactionType["CAPITAL_WITHDRAWAL"] = "CAPITAL_WITHDRAWAL";
    PoolTransactionType["ADVANCE_DISBURSEMENT"] = "ADVANCE_DISBURSEMENT";
    PoolTransactionType["ADVANCE_REPAYMENT"] = "ADVANCE_REPAYMENT";
    PoolTransactionType["FEE_COLLECTION"] = "FEE_COLLECTION";
    PoolTransactionType["INTEREST_DISTRIBUTION"] = "INTEREST_DISTRIBUTION";
    PoolTransactionType["PENALTY_FEE"] = "PENALTY_FEE";
    PoolTransactionType["ADJUSTMENT"] = "ADJUSTMENT";
    PoolTransactionType["RESERVE_ALLOCATION"] = "RESERVE_ALLOCATION";
})(PoolTransactionType || (PoolTransactionType = {}));
export var RebalancingStrategyType;
(function (RebalancingStrategyType) {
    RebalancingStrategyType["CONSERVATIVE"] = "CONSERVATIVE";
    RebalancingStrategyType["MODERATE"] = "MODERATE";
    RebalancingStrategyType["AGGRESSIVE"] = "AGGRESSIVE";
    RebalancingStrategyType["CUSTOM"] = "CUSTOM";
})(RebalancingStrategyType || (RebalancingStrategyType = {}));
export var AllocationPriority;
(function (AllocationPriority) {
    AllocationPriority["LOWEST_RISK"] = "LOWEST_RISK";
    AllocationPriority["HIGHEST_AVAILABLE"] = "HIGHEST_AVAILABLE";
    AllocationPriority["BEST_RETURN"] = "BEST_RETURN";
    AllocationPriority["ROUND_ROBIN"] = "ROUND_ROBIN";
    AllocationPriority["WEIGHTED"] = "WEIGHTED";
})(AllocationPriority || (AllocationPriority = {}));
export const POOL_CONSTRAINTS = {
    MIN_RESERVE_RATIO: 15,
    MAX_SINGLE_ADVANCE_RATIO: 10,
    MIN_ADVANCE_AMOUNT: 5000,
    MAX_ADVANCE_AMOUNT: 500000,
    DEFAULT_CURRENCY: 'MXN',
    CACHE_TTL_SECONDS: 60,
};
export const RISK_TIER_ADVANCE_PERCENTAGES = {
    [RiskTier.A]: 85,
    [RiskTier.B]: 75,
    [RiskTier.C]: 70,
};
export const RISK_TIER_FEES = {
    [RiskTier.A]: { farmerFee: 2.0, buyerFee: 1.0 },
    [RiskTier.B]: { farmerFee: 2.5, buyerFee: 1.25 },
    [RiskTier.C]: { farmerFee: 3.5, buyerFee: 1.75 },
};
export const PERFORMANCE_THRESHOLDS = {
    HEALTHY_DEFAULT_RATE: 0.02,
    WARNING_DEFAULT_RATE: 0.05,
    CRITICAL_DEFAULT_RATE: 0.10,
    MIN_UTILIZATION: 0.50,
    TARGET_UTILIZATION: 0.75,
    MAX_UTILIZATION: 0.85,
};
export var AllocationErrorCode;
(function (AllocationErrorCode) {
    AllocationErrorCode["INSUFFICIENT_FUNDS"] = "INSUFFICIENT_FUNDS";
    AllocationErrorCode["POOL_PAUSED"] = "POOL_PAUSED";
    AllocationErrorCode["POOL_NOT_FOUND"] = "POOL_NOT_FOUND";
    AllocationErrorCode["AMOUNT_BELOW_MINIMUM"] = "AMOUNT_BELOW_MINIMUM";
    AllocationErrorCode["AMOUNT_ABOVE_MAXIMUM"] = "AMOUNT_ABOVE_MAXIMUM";
    AllocationErrorCode["RISK_TIER_MISMATCH"] = "RISK_TIER_MISMATCH";
    AllocationErrorCode["RESERVE_RATIO_VIOLATION"] = "RESERVE_RATIO_VIOLATION";
    AllocationErrorCode["EXPOSURE_LIMIT_EXCEEDED"] = "EXPOSURE_LIMIT_EXCEEDED";
    AllocationErrorCode["FARMER_LIMIT_EXCEEDED"] = "FARMER_LIMIT_EXCEEDED";
    AllocationErrorCode["CONCURRENT_ALLOCATION"] = "CONCURRENT_ALLOCATION";
    AllocationErrorCode["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    AllocationErrorCode["INTERNAL_ERROR"] = "INTERNAL_ERROR";
})(AllocationErrorCode || (AllocationErrorCode = {}));
export function getAdvancePercentageForTier(tier) {
    return RISK_TIER_ADVANCE_PERCENTAGES[tier];
}
export function getFeesForTier(tier) {
    return RISK_TIER_FEES[tier];
}
export function calculateEffectiveAvailable(availableCapital, totalCapital, minReserveRatio) {
    const requiredReserve = totalCapital * (minReserveRatio / 100);
    return Math.max(0, availableCapital - requiredReserve);
}
export function calculateUtilizationRate(deployedCapital, totalCapital) {
    if (totalCapital === 0)
        return 0;
    return (deployedCapital / totalCapital) * 100;
}
export function calculateReserveRatio(availableCapital, totalCapital) {
    if (totalCapital === 0)
        return 100;
    return (availableCapital / totalCapital) * 100;
}
export function assessPoolHealth(defaultRate, utilizationRate, reserveRatio) {
    if (defaultRate >= PERFORMANCE_THRESHOLDS.CRITICAL_DEFAULT_RATE ||
        reserveRatio < 5) {
        return 'CRITICAL';
    }
    if (defaultRate >= PERFORMANCE_THRESHOLDS.WARNING_DEFAULT_RATE ||
        utilizationRate > PERFORMANCE_THRESHOLDS.MAX_UTILIZATION * 100 ||
        reserveRatio < 10) {
        return 'WARNING';
    }
    return 'HEALTHY';
}
export function validateAllocationAmount(amount, poolAvailable, poolTotal, constraints) {
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
