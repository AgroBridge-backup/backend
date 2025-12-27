/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AGROBRIDGE - CASH FLOW BRIDGE MODULE
 * Dynamic Cash Flow Bridge - Complete Financial Module
 *
 * This module provides:
 * - Credit scoring for agricultural producers
 * - Liquidity pool management for capital allocation
 * - Advance contract lifecycle management
 * - RESTful API endpoints for all operations
 *
 * @module cash-flow-bridge
 * @version 1.0.0
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ════════════════════════════════════════════════════════════════════════════════
// CONTROLLERS
// ════════════════════════════════════════════════════════════════════════════════

export {
  CreditScoreController,
  createCreditScoreRouter,
} from "./controllers/credit-score.controller.js";

export {
  AdvanceController,
  createAdvanceRouter,
} from "./controllers/advance.controller.js";

// ════════════════════════════════════════════════════════════════════════════════
// SERVICES
// ════════════════════════════════════════════════════════════════════════════════

export {
  AdvanceContractService,
  createAdvanceContractService,
  AdvanceStatus,
  ApprovalMethod,
  PaymentMethod,
  type AdvanceRequest,
  type AdvanceCalculation,
  type AdvanceContractDetails,
  type RepaymentInput,
  type StatusTransitionResult,
} from "./services/AdvanceContractService.js";

// ════════════════════════════════════════════════════════════════════════════════
// RE-EXPORTS FROM SUBMODULES
// ════════════════════════════════════════════════════════════════════════════════

// Credit Scoring Module
export {
  CreditScoringService,
  createCreditScoringService,
  BlockchainVerifierService,
  createBlockchainVerifierService,
  CreditScoreCalculator,
  createCreditScoreCalculator,
} from "../credit-scoring/index.js";

// Credit scoring types (exclude RiskTier to avoid conflict with liquidity-pools)
export type {
  DeliveryMetrics,
  QualityMetrics,
  PaymentMetrics,
  ActivityMetrics,
  BlockchainMetrics,
  BlockchainDeliveryData,
  ComponentScores,
  CreditScoreResult,
  ScoringFactor,
  ScoreRecommendation,
  CalculateCreditScoreInput,
  CalculateCreditScoreOutput,
  EligibilityCheckInput,
  EligibilityCheckOutput,
  ScoreSimulationInput,
  ScoreSimulationOutput,
  ScoreHistoryEntry,
} from "../credit-scoring/index.js";

export {
  ScoreTrend,
  SCORE_WEIGHTS,
  RISK_TIER_THRESHOLDS,
  CREDIT_LIMITS,
  getRiskTierFromScore,
  getScoreTrend,
  clampScore,
  getCreditLimitsForTier,
} from "../credit-scoring/index.js";

// Liquidity Pools Module (includes RiskTier)
export * from "../liquidity-pools/index.js";
