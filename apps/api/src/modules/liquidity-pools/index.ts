/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AGROBRIDGE - LIQUIDITY POOLS MODULE
 * Capital Pool Management for Dynamic Cash Flow Bridge
 *
 * This module provides:
 * - Liquidity pool management services
 * - Real-time balance tracking with Redis caching
 * - Capital allocation and release operations
 * - Investor management
 * - Performance metrics and analytics
 *
 * @module liquidity-pools
 * @version 1.0.0
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// Types
export * from "./types/PoolTypes.js";

// Services
export {
  LiquidityPoolService,
  createLiquidityPoolService,
} from "./services/LiquidityPoolService.js";

export {
  PoolBalanceManager,
  createPoolBalanceManager,
  type BalanceReservation,
  type ReservationRequest,
  type BalanceUpdateOperation,
  type BatchBalanceUpdate,
} from "./services/PoolBalanceManager.js";
