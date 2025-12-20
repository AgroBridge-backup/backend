export var RiskTier;
(function (RiskTier) {
    RiskTier["A"] = "A";
    RiskTier["B"] = "B";
    RiskTier["C"] = "C";
})(RiskTier || (RiskTier = {}));
export var ScoreTrend;
(function (ScoreTrend) {
    ScoreTrend["IMPROVING"] = "IMPROVING";
    ScoreTrend["STABLE"] = "STABLE";
    ScoreTrend["DECLINING"] = "DECLINING";
})(ScoreTrend || (ScoreTrend = {}));
export const SCORE_WEIGHTS = {
    DELIVERY: 40,
    QUALITY: 25,
    PAYMENT: 20,
    VOLUME: 10,
    BLOCKCHAIN: 5,
};
export const RISK_TIER_THRESHOLDS = {
    A_MIN: 90,
    B_MIN: 70,
    C_MAX: 70,
};
export const CREDIT_LIMITS = {
    A: {
        maxAdvancePercentage: 85,
        maxAdvanceAmount: 500000,
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
};
export const DEFAULT_CREDIT_SCORING_CONFIG = {
    minScoreForAdvance: 40,
    cacheTtlSeconds: 300,
    autoRecalculate: true,
    recalculationIntervalHours: 24,
    blockchainVerificationEnabled: true,
    blockchainRpcUrl: process.env.BLOCKCHAIN_RPC_URL || 'https://rpc-mumbai.maticvigil.com',
    mlScoringEnabled: false,
    alertThresholds: {
        lowScoreThreshold: 50,
        rapidDeclineThreshold: 15,
        highUtilizationThreshold: 80,
    },
};
export function isValidRiskTier(tier) {
    return Object.values(RiskTier).includes(tier);
}
export function isValidScoreTrend(trend) {
    return Object.values(ScoreTrend).includes(trend);
}
export function decimalToNumber(value) {
    if (value === null || value === undefined)
        return 0;
    if (typeof value === 'number')
        return value;
    return value.toNumber();
}
export function clampScore(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, value));
}
export function getRiskTierFromScore(score) {
    if (score >= RISK_TIER_THRESHOLDS.A_MIN)
        return RiskTier.A;
    if (score >= RISK_TIER_THRESHOLDS.B_MIN)
        return RiskTier.B;
    return RiskTier.C;
}
export function getScoreTrend(change7Days, change30Days, change90Days) {
    const avgChange = (change7Days + change30Days + change90Days) / 3;
    if (avgChange > 2)
        return ScoreTrend.IMPROVING;
    if (avgChange < -2)
        return ScoreTrend.DECLINING;
    return ScoreTrend.STABLE;
}
export function getCreditLimitsForTier(tier) {
    return CREDIT_LIMITS[tier];
}
