/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AGROBRIDGE - POOL BALANCE MANAGER
 * Real-Time Balance Tracking with Redis Caching
 *
 * Responsibilities:
 * - Real-time balance tracking across all pools
 * - Redis-based caching for <100ms response times
 * - Balance reservation system for pending allocations
 * - Multi-pool aggregation and summaries
 * - Balance change event publishing
 *
 * @module liquidity-pools/services
 * @version 1.0.0
 * @author AgroBridge Engineering Team
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { PrismaClient, Prisma } from "@prisma/client";
import type { Redis } from "ioredis";
import {
  PoolStatus,
  RiskTier,
  PoolTransactionType,
  type PoolBalance,
  type PoolBalanceChange,
  type PoolBalanceSummary,
  type TransactionFilterOptions,
  type TransactionSummary,
  type PoolTransactionRecord,
  calculateEffectiveAvailable,
  calculateUtilizationRate,
  calculateReserveRatio,
  assessPoolHealth,
} from "../types/PoolTypes.js";

// ════════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════════════════

const CACHE_KEYS = {
  POOL_BALANCE: (poolId: string) => `cfb:pool:balance:${poolId}`,
  POOL_RESERVED: (poolId: string) => `cfb:pool:reserved:${poolId}`,
  RESERVATION: (reservationId: string) => `cfb:reservation:${reservationId}`,
  ALL_POOLS_SUMMARY: "cfb:pools:summary",
  BALANCE_LOCK: (poolId: string) => `cfb:lock:balance:${poolId}`,
} as const;

const CACHE_TTL = {
  BALANCE: 30, // 30 seconds
  RESERVATION: 300, // 5 minutes for reservation hold
  SUMMARY: 60, // 1 minute
  LOCK: 10, // 10 seconds for distributed lock
} as const;

const PUBSUB_CHANNELS = {
  BALANCE_CHANGED: "cfb:balance:changed",
  RESERVATION_CREATED: "cfb:reservation:created",
  RESERVATION_RELEASED: "cfb:reservation:released",
} as const;

// ════════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Balance reservation for pending allocations
 */
export interface BalanceReservation {
  id: string;
  poolId: string;
  amount: number;
  advanceId: string;
  farmerId: string;
  expiresAt: Date;
  createdAt: Date;
  status: "ACTIVE" | "COMMITTED" | "RELEASED" | "EXPIRED";
}

/**
 * Reservation request
 */
export interface ReservationRequest {
  poolId: string;
  advanceId: string;
  farmerId: string;
  amount: number;
  ttlSeconds?: number;
}

/**
 * Balance update operation
 */
export interface BalanceUpdateOperation {
  poolId: string;
  operation: "INCREMENT" | "DECREMENT" | "SET";
  field:
    | "availableCapital"
    | "deployedCapital"
    | "reservedCapital"
    | "totalCapital";
  amount: number;
  transactionType: PoolTransactionType;
  description: string;
  metadata?: Record<string, unknown>;
  relatedAdvanceId?: string;
  relatedInvestorId?: string;
}

/**
 * Batch balance update
 */
export interface BatchBalanceUpdate {
  operations: BalanceUpdateOperation[];
  atomic: boolean;
}

// ════════════════════════════════════════════════════════════════════════════════
// SERVICE CLASS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Pool Balance Manager
 *
 * Provides real-time balance management with:
 * - Sub-100ms balance queries via Redis caching
 * - Distributed locking for concurrent updates
 * - Reservation system for pending allocations
 * - Event publishing for balance changes
 */
export class PoolBalanceManager {
  private readonly prisma: PrismaClient;
  private readonly redis: Redis | null;
  private readonly eventSubscribers: Map<
    string,
    Set<(event: PoolBalanceChange) => void>
  >;

  constructor(prisma: PrismaClient, redis?: Redis) {
    this.prisma = prisma;
    this.redis = redis || null;
    this.eventSubscribers = new Map();
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // REAL-TIME BALANCE QUERIES
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * Get real-time pool balance with cache
   * Target: <100ms response time
   */
  async getBalance(poolId: string): Promise<PoolBalance | null> {
    const startTime = Date.now();

    // Try cache first
    if (this.redis) {
      const cached = await this.redis.get(CACHE_KEYS.POOL_BALANCE(poolId));
      if (cached) {
        const balance = JSON.parse(cached) as PoolBalance;
        balance.fromCache = true;
        balance.timestamp = new Date(balance.timestamp);
        return balance;
      }
    }

    // Fall back to database
    const pool = await this.prisma.liquidityPool.findUnique({
      where: { id: poolId },
    });

    if (!pool) return null;

    // Get active reservations
    const reservedAmount = await this.getReservedAmount(poolId);

    const balance = this.calculatePoolBalance(pool, reservedAmount);

    // Cache the result
    if (this.redis) {
      await this.redis.setex(
        CACHE_KEYS.POOL_BALANCE(poolId),
        CACHE_TTL.BALANCE,
        JSON.stringify(balance),
      );
    }

    const elapsed = Date.now() - startTime;
    if (elapsed > 100) {
      console.warn(`Pool balance query took ${elapsed}ms for pool ${poolId}`);
    }

    return balance;
  }

  /**
   * Get balances for multiple pools
   */
  async getBalances(poolIds: string[]): Promise<Map<string, PoolBalance>> {
    const results = new Map<string, PoolBalance>();

    // Try to get all from cache at once
    if (this.redis && poolIds.length > 0) {
      const cacheKeys = poolIds.map((id) => CACHE_KEYS.POOL_BALANCE(id));
      const cached = await this.redis.mget(...cacheKeys);

      const uncachedIds: string[] = [];
      cached.forEach((value, index) => {
        if (value) {
          const balance = JSON.parse(value) as PoolBalance;
          balance.fromCache = true;
          balance.timestamp = new Date(balance.timestamp);
          results.set(poolIds[index], balance);
        } else {
          uncachedIds.push(poolIds[index]);
        }
      });

      // Fetch uncached from database
      if (uncachedIds.length > 0) {
        const pools = await this.prisma.liquidityPool.findMany({
          where: { id: { in: uncachedIds } },
        });

        for (const pool of pools) {
          const reservedAmount = await this.getReservedAmount(pool.id);
          const balance = this.calculatePoolBalance(pool, reservedAmount);
          results.set(pool.id, balance);

          // Cache for next time
          await this.redis.setex(
            CACHE_KEYS.POOL_BALANCE(pool.id),
            CACHE_TTL.BALANCE,
            JSON.stringify(balance),
          );
        }
      }
    } else {
      // No Redis - fetch all from database
      const pools = await this.prisma.liquidityPool.findMany({
        where: { id: { in: poolIds } },
      });

      for (const pool of pools) {
        const reservedAmount = await this.getReservedAmount(pool.id);
        results.set(pool.id, this.calculatePoolBalance(pool, reservedAmount));
      }
    }

    return results;
  }

  /**
   * Get aggregate summary of all pools
   */
  async getSummary(): Promise<PoolBalanceSummary> {
    // Try cache
    if (this.redis) {
      const cached = await this.redis.get(CACHE_KEYS.ALL_POOLS_SUMMARY);
      if (cached) {
        const summary = JSON.parse(cached) as PoolBalanceSummary;
        summary.timestamp = new Date(summary.timestamp);
        return summary;
      }
    }

    // Calculate from database
    const pools = await this.prisma.liquidityPool.findMany();

    const summary: PoolBalanceSummary = {
      totalPools: pools.length,
      activePools: pools.filter((p) => p.status === "ACTIVE").length,
      aggregateCapital: {
        total: 0,
        available: 0,
        deployed: 0,
        reserved: 0,
      },
      averageUtilization: 0,
      averageReserveRatio: 0,
      poolsByStatus: {
        [PoolStatus.ACTIVE]: 0,
        [PoolStatus.PAUSED]: 0,
        [PoolStatus.CLOSED]: 0,
        [PoolStatus.LIQUIDATING]: 0,
      },
      poolsByRiskTier: {
        [RiskTier.A]: 0,
        [RiskTier.B]: 0,
        [RiskTier.C]: 0,
      },
      timestamp: new Date(),
    };

    let totalUtilization = 0;
    let totalReserveRatio = 0;

    for (const pool of pools) {
      const total = Number(pool.totalCapital);
      const available = Number(pool.availableCapital);
      const deployed = Number(pool.deployedCapital);
      const reserved = Number(pool.reservedCapital);

      summary.aggregateCapital.total += total;
      summary.aggregateCapital.available += available;
      summary.aggregateCapital.deployed += deployed;
      summary.aggregateCapital.reserved += reserved;

      totalUtilization += calculateUtilizationRate(deployed, total);
      totalReserveRatio += calculateReserveRatio(available, total);

      summary.poolsByStatus[pool.status as PoolStatus]++;
      summary.poolsByRiskTier[pool.riskTier as RiskTier]++;
    }

    if (pools.length > 0) {
      summary.averageUtilization = totalUtilization / pools.length;
      summary.averageReserveRatio = totalReserveRatio / pools.length;
    }

    // Cache
    if (this.redis) {
      await this.redis.setex(
        CACHE_KEYS.ALL_POOLS_SUMMARY,
        CACHE_TTL.SUMMARY,
        JSON.stringify(summary),
      );
    }

    return summary;
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // RESERVATION SYSTEM
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * Create a reservation for pending allocation
   * This temporarily holds capital while advance is being processed
   */
  async createReservation(request: ReservationRequest): Promise<{
    success: boolean;
    reservation?: BalanceReservation;
    error?: string;
  }> {
    const ttl = request.ttlSeconds || CACHE_TTL.RESERVATION;
    const reservationId = `res_${request.advanceId}_${Date.now()}`;

    // Acquire lock for the pool
    const lockAcquired = await this.acquireLock(request.poolId);
    if (!lockAcquired) {
      return {
        success: false,
        error: "Could not acquire lock for pool. Please retry.",
      };
    }

    try {
      // Get current balance
      const balance = await this.getBalance(request.poolId);
      if (!balance) {
        return { success: false, error: "Pool not found" };
      }

      // Check if reservation is possible
      if (request.amount > balance.effectiveAvailable) {
        return {
          success: false,
          error: `Insufficient effective available capital (${balance.effectiveAvailable})`,
        };
      }

      const reservation: BalanceReservation = {
        id: reservationId,
        poolId: request.poolId,
        amount: request.amount,
        advanceId: request.advanceId,
        farmerId: request.farmerId,
        expiresAt: new Date(Date.now() + ttl * 1000),
        createdAt: new Date(),
        status: "ACTIVE",
      };

      if (this.redis) {
        // Store reservation
        await this.redis.setex(
          CACHE_KEYS.RESERVATION(reservationId),
          ttl,
          JSON.stringify(reservation),
        );

        // Update pool reserved amount
        await this.redis.hincrby(
          CACHE_KEYS.POOL_RESERVED(request.poolId),
          reservationId,
          request.amount,
        );

        // Invalidate balance cache
        await this.invalidateBalanceCache(request.poolId);

        // Publish event
        await this.redis.publish(
          PUBSUB_CHANNELS.RESERVATION_CREATED,
          JSON.stringify(reservation),
        );
      } else {
        // Without Redis, update database directly
        await this.prisma.liquidityPool.update({
          where: { id: request.poolId },
          data: {
            reservedCapital: {
              increment: new Prisma.Decimal(request.amount),
            },
          },
        });
      }

      return { success: true, reservation };
    } finally {
      await this.releaseLock(request.poolId);
    }
  }

  /**
   * Commit a reservation (convert to actual allocation)
   */
  async commitReservation(reservationId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    if (!this.redis) {
      return { success: true }; // No-op without Redis
    }

    const reservationData = await this.redis.get(
      CACHE_KEYS.RESERVATION(reservationId),
    );
    if (!reservationData) {
      return { success: false, error: "Reservation not found or expired" };
    }

    const reservation = JSON.parse(reservationData) as BalanceReservation;

    // Remove reservation
    await this.redis.del(CACHE_KEYS.RESERVATION(reservationId));
    await this.redis.hdel(
      CACHE_KEYS.POOL_RESERVED(reservation.poolId),
      reservationId,
    );
    await this.invalidateBalanceCache(reservation.poolId);

    return { success: true };
  }

  /**
   * Release a reservation (cancel pending allocation)
   */
  async releaseReservation(reservationId: string): Promise<{
    success: boolean;
    releasedAmount?: number;
    error?: string;
  }> {
    if (!this.redis) {
      return { success: true, releasedAmount: 0 };
    }

    const reservationData = await this.redis.get(
      CACHE_KEYS.RESERVATION(reservationId),
    );
    if (!reservationData) {
      return { success: false, error: "Reservation not found or expired" };
    }

    const reservation = JSON.parse(reservationData) as BalanceReservation;

    // Acquire lock
    const lockAcquired = await this.acquireLock(reservation.poolId);
    if (!lockAcquired) {
      return { success: false, error: "Could not acquire lock" };
    }

    try {
      // Remove reservation
      await this.redis.del(CACHE_KEYS.RESERVATION(reservationId));
      await this.redis.hdel(
        CACHE_KEYS.POOL_RESERVED(reservation.poolId),
        reservationId,
      );
      await this.invalidateBalanceCache(reservation.poolId);

      // Publish event
      await this.redis.publish(
        PUBSUB_CHANNELS.RESERVATION_RELEASED,
        JSON.stringify(reservation),
      );

      return { success: true, releasedAmount: reservation.amount };
    } finally {
      await this.releaseLock(reservation.poolId);
    }
  }

  /**
   * Get all active reservations for a pool
   */
  async getPoolReservations(poolId: string): Promise<BalanceReservation[]> {
    if (!this.redis) return [];

    const reservationAmounts = await this.redis.hgetall(
      CACHE_KEYS.POOL_RESERVED(poolId),
    );
    const reservations: BalanceReservation[] = [];

    for (const reservationId of Object.keys(reservationAmounts)) {
      const data = await this.redis.get(CACHE_KEYS.RESERVATION(reservationId));
      if (data) {
        const reservation = JSON.parse(data) as BalanceReservation;
        reservation.expiresAt = new Date(reservation.expiresAt);
        reservation.createdAt = new Date(reservation.createdAt);
        reservations.push(reservation);
      }
    }

    return reservations;
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // BALANCE UPDATES
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * Update pool balance with transaction recording
   */
  async updateBalance(operation: BalanceUpdateOperation): Promise<{
    success: boolean;
    balanceBefore?: PoolBalance;
    balanceAfter?: PoolBalance;
    transactionId?: string;
    error?: string;
  }> {
    const lockAcquired = await this.acquireLock(operation.poolId);
    if (!lockAcquired) {
      return { success: false, error: "Could not acquire lock" };
    }

    try {
      // Get current balance
      const balanceBefore = await this.getBalance(operation.poolId);
      if (!balanceBefore) {
        return { success: false, error: "Pool not found" };
      }

      // Build update data
      const updateData: Prisma.LiquidityPoolUpdateInput = {};
      const fieldValue = this.getBalanceFieldValue(
        balanceBefore,
        operation.field,
      );

      let newValue: number;
      switch (operation.operation) {
        case "INCREMENT":
          newValue = fieldValue + operation.amount;
          updateData[operation.field] = {
            increment: new Prisma.Decimal(operation.amount),
          };
          break;
        case "DECREMENT":
          newValue = fieldValue - operation.amount;
          updateData[operation.field] = {
            decrement: new Prisma.Decimal(operation.amount),
          };
          break;
        case "SET":
          newValue = operation.amount;
          updateData[operation.field] = new Prisma.Decimal(operation.amount);
          break;
      }

      // Execute update with transaction
      const result = await this.prisma.$transaction(async (tx) => {
        const updatedPool = await tx.liquidityPool.update({
          where: { id: operation.poolId },
          data: updateData,
        });

        const transaction = await tx.poolTransaction.create({
          data: {
            poolId: operation.poolId,
            type: operation.transactionType,
            amount: new Prisma.Decimal(operation.amount),
            balanceBefore: new Prisma.Decimal(fieldValue),
            balanceAfter: new Prisma.Decimal(newValue!),
            description: operation.description,
            metadata: operation.metadata as Prisma.InputJsonValue,
            relatedAdvanceId: operation.relatedAdvanceId,
            relatedInvestorId: operation.relatedInvestorId,
          },
        });

        return { pool: updatedPool, transaction };
      });

      // Invalidate cache
      await this.invalidateBalanceCache(operation.poolId);

      // Get new balance
      const balanceAfter = await this.getBalance(operation.poolId);

      // Publish balance change event
      if (balanceAfter) {
        await this.publishBalanceChange({
          poolId: operation.poolId,
          changeType: operation.transactionType,
          amount: operation.amount,
          balanceBefore,
          balanceAfter,
          relatedEntityId:
            operation.relatedAdvanceId || operation.relatedInvestorId,
          relatedEntityType: operation.relatedAdvanceId
            ? "ADVANCE"
            : operation.relatedInvestorId
              ? "INVESTOR"
              : undefined,
          timestamp: new Date(),
        });
      }

      return {
        success: true,
        balanceBefore,
        balanceAfter: balanceAfter!,
        transactionId: result.transaction.id,
      };
    } finally {
      await this.releaseLock(operation.poolId);
    }
  }

  /**
   * Execute batch balance updates atomically
   */
  async batchUpdateBalances(batch: BatchBalanceUpdate): Promise<{
    success: boolean;
    results?: Array<{
      poolId: string;
      success: boolean;
      transactionId?: string;
      error?: string;
    }>;
    error?: string;
  }> {
    if (batch.atomic) {
      // All operations in single transaction
      try {
        const results = await this.prisma.$transaction(async (tx) => {
          const transactionResults: Array<{
            poolId: string;
            success: boolean;
            transactionId?: string;
          }> = [];

          for (const operation of batch.operations) {
            const pool = await tx.liquidityPool.findUnique({
              where: { id: operation.poolId },
            });

            if (!pool) {
              throw new Error(`Pool ${operation.poolId} not found`);
            }

            const fieldValue = this.getBalanceFieldValueFromPool(
              pool,
              operation.field,
            );
            let newValue: number;

            const updateData: Prisma.LiquidityPoolUpdateInput = {};
            switch (operation.operation) {
              case "INCREMENT":
                newValue = fieldValue + operation.amount;
                updateData[operation.field] = {
                  increment: new Prisma.Decimal(operation.amount),
                };
                break;
              case "DECREMENT":
                newValue = fieldValue - operation.amount;
                updateData[operation.field] = {
                  decrement: new Prisma.Decimal(operation.amount),
                };
                break;
              case "SET":
                newValue = operation.amount;
                updateData[operation.field] = new Prisma.Decimal(
                  operation.amount,
                );
                break;
            }

            await tx.liquidityPool.update({
              where: { id: operation.poolId },
              data: updateData,
            });

            const transaction = await tx.poolTransaction.create({
              data: {
                poolId: operation.poolId,
                type: operation.transactionType,
                amount: new Prisma.Decimal(operation.amount),
                balanceBefore: new Prisma.Decimal(fieldValue),
                balanceAfter: new Prisma.Decimal(newValue!),
                description: operation.description,
                metadata: operation.metadata as Prisma.InputJsonValue,
                relatedAdvanceId: operation.relatedAdvanceId,
                relatedInvestorId: operation.relatedInvestorId,
              },
            });

            transactionResults.push({
              poolId: operation.poolId,
              success: true,
              transactionId: transaction.id,
            });
          }

          return transactionResults;
        });

        // Invalidate all affected pool caches
        const poolIds = [...new Set(batch.operations.map((o) => o.poolId))];
        await Promise.all(poolIds.map((id) => this.invalidateBalanceCache(id)));

        return { success: true, results };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Batch update failed",
        };
      }
    } else {
      // Non-atomic: execute each independently
      const results = await Promise.all(
        batch.operations.map(async (operation) => {
          const result = await this.updateBalance(operation);
          return {
            poolId: operation.poolId,
            success: result.success,
            transactionId: result.transactionId,
            error: result.error,
          };
        }),
      );

      return {
        success: results.every((r) => r.success),
        results,
      };
    }
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // TRANSACTION QUERIES
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * Get pool transactions with filtering
   */
  async getTransactions(
    options: TransactionFilterOptions,
  ): Promise<PoolTransactionRecord[]> {
    const where: Prisma.PoolTransactionWhereInput = {};

    if (options.poolId) where.poolId = options.poolId;
    if (options.types?.length) where.type = { in: options.types };
    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }
    if (options.minAmount !== undefined || options.maxAmount !== undefined) {
      const amountFilter: { gte?: number; lte?: number } = {};
      if (options.minAmount !== undefined) {
        amountFilter.gte = options.minAmount;
      }
      if (options.maxAmount !== undefined) {
        amountFilter.lte = options.maxAmount;
      }
      where.amount = amountFilter;
    }
    if (options.relatedAdvanceId)
      where.relatedAdvanceId = options.relatedAdvanceId;
    if (options.relatedInvestorId)
      where.relatedInvestorId = options.relatedInvestorId;

    const transactions = await this.prisma.poolTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: options.offset || 0,
      take: options.limit || 50,
    });

    return transactions.map((t) => ({
      id: t.id,
      poolId: t.poolId,
      type: t.type as PoolTransactionType,
      amount: Number(t.amount),
      balanceBefore: Number(t.balanceBefore),
      balanceAfter: Number(t.balanceAfter),
      description: t.description,
      metadata: t.metadata as Record<string, unknown> | undefined,
      relatedAdvanceId: t.relatedAdvanceId || undefined,
      relatedInvestorId: t.relatedInvestorId || undefined,
      createdAt: t.createdAt,
    }));
  }

  /**
   * Get transaction summary for a pool
   */
  async getTransactionSummary(
    poolId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<TransactionSummary> {
    const transactions = await this.prisma.poolTransaction.findMany({
      where: {
        poolId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const byType: TransactionSummary["byType"] =
      {} as TransactionSummary["byType"];

    // Initialize all types
    Object.values(PoolTransactionType).forEach((type) => {
      byType[type] = { count: 0, totalAmount: 0, netAmount: 0 };
    });

    let inflows = 0;
    let outflows = 0;

    for (const tx of transactions) {
      const type = tx.type as PoolTransactionType;
      const amount = Number(tx.amount);

      byType[type].count++;
      byType[type].totalAmount += Math.abs(amount);

      // Determine if inflow or outflow
      if (
        [
          PoolTransactionType.CAPITAL_DEPOSIT,
          PoolTransactionType.ADVANCE_REPAYMENT,
          PoolTransactionType.FEE_COLLECTION,
          PoolTransactionType.PENALTY_FEE,
          PoolTransactionType.INTEREST_DISTRIBUTION,
        ].includes(type)
      ) {
        inflows += Math.abs(amount);
        byType[type].netAmount += Math.abs(amount);
      } else {
        outflows += Math.abs(amount);
        byType[type].netAmount -= Math.abs(amount);
      }
    }

    return {
      poolId,
      period: { startDate, endDate },
      byType,
      totals: {
        inflows,
        outflows,
        netChange: inflows - outflows,
        transactionCount: transactions.length,
      },
    };
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // EVENT SUBSCRIPTION
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * Subscribe to balance change events for a pool
   */
  subscribe(
    poolId: string,
    callback: (event: PoolBalanceChange) => void,
  ): () => void {
    if (!this.eventSubscribers.has(poolId)) {
      this.eventSubscribers.set(poolId, new Set());
    }

    this.eventSubscribers.get(poolId)!.add(callback);

    // Return unsubscribe function
    return () => {
      const subscribers = this.eventSubscribers.get(poolId);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          this.eventSubscribers.delete(poolId);
        }
      }
    };
  }

  /**
   * Subscribe to all balance change events
   */
  subscribeAll(callback: (event: PoolBalanceChange) => void): () => void {
    return this.subscribe("*", callback);
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * Calculate pool balance from database record
   */
  private calculatePoolBalance(
    pool: Prisma.LiquidityPoolGetPayload<{}>,
    reservedAmount: number,
  ): PoolBalance {
    const totalCapital = Number(pool.totalCapital);
    const availableCapital = Number(pool.availableCapital);
    const deployedCapital = Number(pool.deployedCapital);
    const dbReservedCapital = Number(pool.reservedCapital);
    const minReserveRatio = Number(pool.minReserveRatio);

    // Total reserved includes both DB reserved and active reservations
    const totalReserved = dbReservedCapital + reservedAmount;
    const effectiveAvailable = availableCapital - reservedAmount;

    const requiredReserve = totalCapital * (minReserveRatio / 100);
    const actualEffectiveAvailable = calculateEffectiveAvailable(
      effectiveAvailable,
      totalCapital,
      minReserveRatio,
    );
    const utilizationRate = calculateUtilizationRate(
      deployedCapital,
      totalCapital,
    );
    const reserveRatio = calculateReserveRatio(
      effectiveAvailable,
      totalCapital,
    );

    return {
      poolId: pool.id,
      poolName: pool.name,
      status: pool.status as PoolStatus,
      riskTier: pool.riskTier as RiskTier,
      currency: pool.currency,
      totalCapital,
      availableCapital: effectiveAvailable,
      deployedCapital,
      reservedCapital: totalReserved,
      requiredReserve,
      effectiveAvailable: actualEffectiveAvailable,
      utilizationRate,
      reserveRatio,
      isHealthy:
        assessPoolHealth(
          Number(pool.defaultRate),
          utilizationRate,
          reserveRatio,
        ) === "HEALTHY",
      timestamp: new Date(),
      fromCache: false,
    };
  }

  /**
   * Get total reserved amount for a pool from Redis
   */
  private async getReservedAmount(poolId: string): Promise<number> {
    if (!this.redis) return 0;

    const reservations = await this.redis.hgetall(
      CACHE_KEYS.POOL_RESERVED(poolId),
    );
    return Object.values(reservations).reduce(
      (sum, val) => sum + parseInt(val, 10),
      0,
    );
  }

  /**
   * Get balance field value from PoolBalance
   */
  private getBalanceFieldValue(
    balance: PoolBalance,
    field:
      | "availableCapital"
      | "deployedCapital"
      | "reservedCapital"
      | "totalCapital",
  ): number {
    return balance[field];
  }

  /**
   * Get balance field value from database pool record
   */
  private getBalanceFieldValueFromPool(
    pool: Prisma.LiquidityPoolGetPayload<{}>,
    field:
      | "availableCapital"
      | "deployedCapital"
      | "reservedCapital"
      | "totalCapital",
  ): number {
    return Number(pool[field]);
  }

  /**
   * Acquire distributed lock for pool
   */
  private async acquireLock(poolId: string): Promise<boolean> {
    if (!this.redis) return true;

    const lockKey = CACHE_KEYS.BALANCE_LOCK(poolId);
    const lockValue = `lock_${Date.now()}_${Math.random()}`;

    // Try to set lock with NX (only if not exists) and EX (expiration)
    const result = await this.redis.set(
      lockKey,
      lockValue,
      "EX",
      CACHE_TTL.LOCK,
      "NX",
    );
    return result === "OK";
  }

  /**
   * Release distributed lock for pool
   */
  private async releaseLock(poolId: string): Promise<void> {
    if (!this.redis) return;
    await this.redis.del(CACHE_KEYS.BALANCE_LOCK(poolId));
  }

  /**
   * Invalidate balance cache for a pool
   */
  private async invalidateBalanceCache(poolId: string): Promise<void> {
    if (!this.redis) return;

    await Promise.all([
      this.redis.del(CACHE_KEYS.POOL_BALANCE(poolId)),
      this.redis.del(CACHE_KEYS.ALL_POOLS_SUMMARY),
    ]);
  }

  /**
   * Publish balance change event
   */
  private async publishBalanceChange(event: PoolBalanceChange): Promise<void> {
    // Notify local subscribers
    const poolSubscribers = this.eventSubscribers.get(event.poolId);
    const allSubscribers = this.eventSubscribers.get("*");

    if (poolSubscribers) {
      poolSubscribers.forEach((callback) => callback(event));
    }
    if (allSubscribers) {
      allSubscribers.forEach((callback) => callback(event));
    }

    // Publish to Redis for distributed subscribers
    if (this.redis) {
      await this.redis.publish(
        PUBSUB_CHANNELS.BALANCE_CHANGED,
        JSON.stringify(event),
      );
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Create a new PoolBalanceManager instance
 */
export function createPoolBalanceManager(
  prisma: PrismaClient,
  redis?: Redis,
): PoolBalanceManager {
  return new PoolBalanceManager(prisma, redis);
}
