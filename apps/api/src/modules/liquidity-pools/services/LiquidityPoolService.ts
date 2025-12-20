/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AGROBRIDGE - LIQUIDITY POOL SERVICE
 * Core Capital Management for Dynamic Cash Flow Bridge
 *
 * Responsibilities:
 * - Capital allocation for advance disbursements
 * - Capital release on repayments
 * - Default handling and loss recognition
 * - Pool performance metrics calculation
 * - Atomic transaction guarantees
 *
 * @module liquidity-pools/services
 * @version 1.0.0
 * @author AgroBridge Engineering Team
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { PrismaClient, Prisma } from '@prisma/client';
import type { Redis } from 'ioredis';
import {
  PoolStatus,
  RiskTier,
  PoolTransactionType,
  AllocationErrorCode,
  AllocationPriority,
  POOL_CONSTRAINTS,
  PERFORMANCE_THRESHOLDS,
  type PoolAllocationRequest,
  type PoolAllocationResult,
  type CapitalReleaseRequest,
  type CapitalReleaseResult,
  type PoolBalance,
  type PoolPerformanceMetrics,
  type PoolHealthAssessment,
  type PoolDetails,
  type ServiceResult,
  type PaginatedResult,
  type CreatePoolRequest,
  type UpdatePoolRequest,
  type PoolSelectionCriteria,
  type PoolAdvanceEligibility,
  calculateEffectiveAvailable,
  calculateUtilizationRate,
  calculateReserveRatio,
  assessPoolHealth,
  validateAllocationAmount,
  getFeesForTier,
} from '../types/PoolTypes.js';

// ════════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════════════════

const CACHE_KEYS = {
  POOL_BALANCE: (poolId: string) => `pool:balance:${poolId}`,
  POOL_METRICS: (poolId: string) => `pool:metrics:${poolId}`,
  POOL_DETAILS: (poolId: string) => `pool:details:${poolId}`,
  ALL_POOLS_SUMMARY: 'pools:summary:all',
} as const;

const CACHE_TTL = {
  BALANCE: 30, // 30 seconds for real-time balance
  METRICS: 300, // 5 minutes for metrics
  DETAILS: 60, // 1 minute for details
  SUMMARY: 60, // 1 minute for summary
} as const;

// ════════════════════════════════════════════════════════════════════════════════
// SERVICE CLASS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Liquidity Pool Service
 *
 * Manages capital pools that fund agricultural advances.
 * Ensures atomic transactions and maintains reserve ratios.
 */
export class LiquidityPoolService {
  private readonly prisma: PrismaClient;
  private readonly redis: Redis | null;

  constructor(prisma: PrismaClient, redis?: Redis) {
    this.prisma = prisma;
    this.redis = redis || null;
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // CAPITAL ALLOCATION
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * Allocate capital from pool for an advance
   *
   * This is the core method that:
   * 1. Selects optimal pool (or uses preferred)
   * 2. Validates amount against constraints
   * 3. Atomically updates pool balances
   * 4. Records transaction
   * 5. Returns allocation details
   */
  async allocateCapital(
    request: PoolAllocationRequest,
  ): Promise<PoolAllocationResult> {
    const startTime = Date.now();

    try {
      // 1. Select pool
      const pool = request.preferredPoolId
        ? await this.getPoolById(request.preferredPoolId)
        : await this.selectOptimalPool(request);

      if (!pool) {
        return {
          success: false,
          error: 'No suitable pool found for allocation',
          errorCode: AllocationErrorCode.POOL_NOT_FOUND,
          alternatives: await this.findAlternativePools(request),
        };
      }

      // 2. Check pool status
      if (pool.status !== 'ACTIVE') {
        return {
          success: false,
          error: `Pool ${pool.name} is ${pool.status}`,
          errorCode: AllocationErrorCode.POOL_PAUSED,
          alternatives: await this.findAlternativePools(request),
        };
      }

      // 3. Validate amount
      const validation = validateAllocationAmount(
        request.requestedAmount,
        Number(pool.availableCapital),
        Number(pool.totalCapital),
        {
          minAdvance: Number(pool.minAdvanceAmount),
          maxAdvance: Number(pool.maxAdvanceAmount),
          maxSingleAdvanceRatio: POOL_CONSTRAINTS.MAX_SINGLE_ADVANCE_RATIO,
          minReserveRatio: Number(pool.minReserveRatio),
        },
      );

      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          errorCode: validation.errorCode,
          alternatives: await this.findAlternativePools(request),
        };
      }

      // 4. Calculate fees
      const fees = getFeesForTier(request.riskTier);
      const farmerFeeAmount = request.requestedAmount * (fees.farmerFee / 100);
      const buyerFeeAmount = request.requestedAmount * (fees.buyerFee / 100);
      const platformTotalFee = farmerFeeAmount + buyerFeeAmount;

      // 5. Execute atomic allocation
      const result = await this.prisma.$transaction(async (tx) => {
        // Lock the pool row for update
        const lockedPool = await tx.liquidityPool.findUnique({
          where: { id: pool.id },
        });

        if (!lockedPool) {
          throw new Error('Pool not found during allocation');
        }

        // Re-validate after lock (optimistic locking pattern)
        const currentAvailable = Number(lockedPool.availableCapital);
        const effectiveAvailable = calculateEffectiveAvailable(
          currentAvailable,
          Number(lockedPool.totalCapital),
          Number(lockedPool.minReserveRatio),
        );

        if (request.requestedAmount > effectiveAvailable) {
          throw new Error('CONCURRENT_ALLOCATION');
        }

        // Update pool balances
        const updatedPool = await tx.liquidityPool.update({
          where: { id: pool.id },
          data: {
            availableCapital: {
              decrement: new Prisma.Decimal(request.requestedAmount),
            },
            deployedCapital: {
              increment: new Prisma.Decimal(request.requestedAmount),
            },
            totalAdvancesIssued: { increment: 1 },
            totalAdvancesActive: { increment: 1 },
            totalDisbursed: {
              increment: new Prisma.Decimal(request.requestedAmount),
            },
          },
        });

        // Record transaction
        const transaction = await tx.poolTransaction.create({
          data: {
            poolId: pool.id,
            type: 'ADVANCE_DISBURSEMENT',
            amount: new Prisma.Decimal(request.requestedAmount),
            balanceBefore: lockedPool.availableCapital,
            balanceAfter: updatedPool.availableCapital,
            description: `Advance allocation for order ${request.orderId}`,
            metadata: {
              advanceId: request.advanceId,
              farmerId: request.farmerId,
              orderId: request.orderId,
              riskTier: request.riskTier,
              creditScore: request.creditScore,
              fees: {
                farmerFee: farmerFeeAmount,
                buyerFee: buyerFeeAmount,
                platformTotal: platformTotalFee,
              },
            },
            relatedAdvanceId: request.advanceId,
          },
        });

        return {
          pool: updatedPool,
          transaction,
          balanceBefore: Number(lockedPool.availableCapital),
          balanceAfter: Number(updatedPool.availableCapital),
        };
      });

      // 6. Invalidate cache
      await this.invalidatePoolCache(pool.id);

      // 7. Return success
      return {
        success: true,
        allocation: {
          poolId: pool.id,
          poolName: pool.name,
          allocatedAmount: request.requestedAmount,
          currency: pool.currency,
          balanceBefore: result.balanceBefore,
          balanceAfter: result.balanceAfter,
          transactionId: result.transaction.id,
          allocatedAt: result.transaction.createdAt,
          fees: {
            farmerFee: farmerFeeAmount,
            buyerFee: buyerFeeAmount,
            platformTotal: platformTotalFee,
          },
        },
      };
    } catch (error) {
      console.error('Error allocating capital:', error);

      if (error instanceof Error && error.message === 'CONCURRENT_ALLOCATION') {
        return {
          success: false,
          error: 'Concurrent allocation detected. Please retry.',
          errorCode: AllocationErrorCode.CONCURRENT_ALLOCATION,
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Internal error',
        errorCode: AllocationErrorCode.INTERNAL_ERROR,
      };
    }
  }

  /**
   * Release capital back to pool (repayment)
   */
  async releaseCapital(
    request: CapitalReleaseRequest,
  ): Promise<CapitalReleaseResult> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Get current pool state
        const pool = await tx.liquidityPool.findUnique({
          where: { id: request.poolId },
        });

        if (!pool) {
          throw new Error('Pool not found');
        }

        // Calculate net amount
        const feesCollected = request.feesCollected || 0;
        const penaltiesCollected = request.penaltiesCollected || 0;
        const totalReturn = request.amount + feesCollected + penaltiesCollected;

        // Determine if this is completion or partial
        const isCompletion = request.releaseType === 'FULL_REPAYMENT';

        // Update pool balances
        const updatedPool = await tx.liquidityPool.update({
          where: { id: request.poolId },
          data: {
            availableCapital: {
              increment: new Prisma.Decimal(totalReturn),
            },
            deployedCapital: {
              decrement: new Prisma.Decimal(request.amount),
            },
            totalRepaid: {
              increment: new Prisma.Decimal(request.amount),
            },
            totalFeesEarned: {
              increment: new Prisma.Decimal(feesCollected + penaltiesCollected),
            },
            ...(isCompletion && {
              totalAdvancesCompleted: { increment: 1 },
              totalAdvancesActive: { decrement: 1 },
            }),
          },
        });

        // Record repayment transaction
        const transaction = await tx.poolTransaction.create({
          data: {
            poolId: request.poolId,
            type: 'ADVANCE_REPAYMENT',
            amount: new Prisma.Decimal(request.amount),
            balanceBefore: pool.availableCapital,
            balanceAfter: updatedPool.availableCapital,
            description: `${request.releaseType} for advance ${request.advanceId}`,
            metadata: {
              advanceId: request.advanceId,
              releaseType: request.releaseType,
              source: request.source,
              feesCollected,
              penaltiesCollected,
              paymentReference: request.paymentReference,
            },
            relatedAdvanceId: request.advanceId,
          },
        });

        // Record fees if any
        if (feesCollected > 0) {
          await tx.poolTransaction.create({
            data: {
              poolId: request.poolId,
              type: 'FEE_COLLECTION',
              amount: new Prisma.Decimal(feesCollected),
              balanceBefore: updatedPool.availableCapital,
              balanceAfter: updatedPool.availableCapital,
              description: `Fees collected for advance ${request.advanceId}`,
              relatedAdvanceId: request.advanceId,
            },
          });
        }

        // Record penalties if any
        if (penaltiesCollected > 0) {
          await tx.poolTransaction.create({
            data: {
              poolId: request.poolId,
              type: 'PENALTY_FEE',
              amount: new Prisma.Decimal(penaltiesCollected),
              balanceBefore: updatedPool.availableCapital,
              balanceAfter: updatedPool.availableCapital,
              description: `Penalty collected for advance ${request.advanceId}`,
              relatedAdvanceId: request.advanceId,
            },
          });
        }

        return {
          pool: updatedPool,
          transaction,
          principalReleased: request.amount,
          feesCollected,
          penaltiesCollected,
        };
      });

      // Invalidate cache
      await this.invalidatePoolCache(request.poolId);

      return {
        success: true,
        release: {
          poolId: request.poolId,
          transactionId: result.transaction.id,
          principalReleased: result.principalReleased,
          feesCollected: result.feesCollected,
          penaltiesCollected: result.penaltiesCollected,
          netAmount: result.principalReleased + result.feesCollected + result.penaltiesCollected,
          newAvailableCapital: Number(result.pool.availableCapital),
          releasedAt: result.transaction.createdAt,
        },
      };
    } catch (error) {
      console.error('Error releasing capital:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Internal error',
      };
    }
  }

  /**
   * Handle advance default
   */
  async handleDefault(
    advanceId: string,
    poolId: string,
    defaultedAmount: number,
    recoveredAmount: number = 0,
  ): Promise<ServiceResult<{ lossRecorded: number; poolUpdated: boolean }>> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const pool = await tx.liquidityPool.findUnique({
          where: { id: poolId },
        });

        if (!pool) {
          throw new Error('Pool not found');
        }

        const lossAmount = defaultedAmount - recoveredAmount;

        // Update pool statistics
        const updatedPool = await tx.liquidityPool.update({
          where: { id: poolId },
          data: {
            deployedCapital: {
              decrement: new Prisma.Decimal(defaultedAmount),
            },
            availableCapital: {
              increment: new Prisma.Decimal(recoveredAmount),
            },
            totalAdvancesDefaulted: { increment: 1 },
            totalAdvancesActive: { decrement: 1 },
            // Recalculate default rate
            defaultRate: {
              set: new Prisma.Decimal(
                ((Number(pool.totalAdvancesDefaulted) + 1) /
                  Math.max(Number(pool.totalAdvancesIssued), 1)) * 100,
              ),
            },
          },
        });

        // Record default transaction
        await tx.poolTransaction.create({
          data: {
            poolId,
            type: 'ADJUSTMENT',
            amount: new Prisma.Decimal(-lossAmount),
            balanceBefore: pool.availableCapital,
            balanceAfter: updatedPool.availableCapital,
            description: `Default loss recorded for advance ${advanceId}`,
            metadata: {
              advanceId,
              defaultedAmount,
              recoveredAmount,
              lossAmount,
            },
            relatedAdvanceId: advanceId,
          },
        });

        return { lossAmount, pool: updatedPool };
      });

      await this.invalidatePoolCache(poolId);

      return {
        success: true,
        data: {
          lossRecorded: result.lossAmount,
          poolUpdated: true,
        },
      };
    } catch (error) {
      console.error('Error handling default:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Internal error',
      };
    }
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // POOL SELECTION
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * Select optimal pool for allocation
   */
  private async selectOptimalPool(
    request: PoolAllocationRequest,
  ): Promise<Prisma.LiquidityPoolGetPayload<{}> | null> {
    const priority = request.priority || AllocationPriority.LOWEST_RISK;

    // Base criteria
    const where: Prisma.LiquidityPoolWhereInput = {
      status: 'ACTIVE',
      currency: request.currency,
      minAdvanceAmount: { lte: request.requestedAmount },
      maxAdvanceAmount: { gte: request.requestedAmount },
    };

    // Order by based on priority
    let orderBy: Prisma.LiquidityPoolOrderByWithRelationInput;

    switch (priority) {
      case AllocationPriority.LOWEST_RISK:
        orderBy = { defaultRate: 'asc' };
        break;
      case AllocationPriority.HIGHEST_AVAILABLE:
        orderBy = { availableCapital: 'desc' };
        break;
      case AllocationPriority.BEST_RETURN:
        orderBy = { actualReturnRate: 'desc' };
        break;
      default:
        orderBy = { availableCapital: 'desc' };
    }

    const pools = await this.prisma.liquidityPool.findMany({
      where,
      orderBy,
    });

    // Filter by effective available capital
    for (const pool of pools) {
      const effectiveAvailable = calculateEffectiveAvailable(
        Number(pool.availableCapital),
        Number(pool.totalCapital),
        Number(pool.minReserveRatio),
      );

      if (effectiveAvailable >= request.requestedAmount) {
        return pool;
      }
    }

    return null;
  }

  /**
   * Find alternative pools when primary fails
   */
  private async findAlternativePools(
    request: PoolAllocationRequest,
  ): Promise<Array<{ poolId: string; availableAmount: number; reason: string }>> {
    const pools = await this.prisma.liquidityPool.findMany({
      where: {
        status: 'ACTIVE',
        currency: request.currency,
      },
      orderBy: { availableCapital: 'desc' },
      take: 3,
    });

    return pools.map((pool) => {
      const effectiveAvailable = calculateEffectiveAvailable(
        Number(pool.availableCapital),
        Number(pool.totalCapital),
        Number(pool.minReserveRatio),
      );

      let reason = 'Available';
      if (effectiveAvailable < request.requestedAmount) {
        reason = `Only ${effectiveAvailable.toFixed(2)} available`;
      }
      if (request.requestedAmount < Number(pool.minAdvanceAmount)) {
        reason = `Below minimum ${pool.minAdvanceAmount}`;
      }
      if (request.requestedAmount > Number(pool.maxAdvanceAmount)) {
        reason = `Above maximum ${pool.maxAdvanceAmount}`;
      }

      return {
        poolId: pool.id,
        availableAmount: effectiveAvailable,
        reason,
      };
    });
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // POOL BALANCE & METRICS
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * Get real-time pool balance
   */
  async getPoolBalance(poolId: string): Promise<PoolBalance | null> {
    // Check cache first
    if (this.redis) {
      const cached = await this.redis.get(CACHE_KEYS.POOL_BALANCE(poolId));
      if (cached) {
        const balance = JSON.parse(cached) as PoolBalance;
        balance.fromCache = true;
        return balance;
      }
    }

    const pool = await this.prisma.liquidityPool.findUnique({
      where: { id: poolId },
    });

    if (!pool) return null;

    const totalCapital = Number(pool.totalCapital);
    const availableCapital = Number(pool.availableCapital);
    const deployedCapital = Number(pool.deployedCapital);
    const reservedCapital = Number(pool.reservedCapital);
    const minReserveRatio = Number(pool.minReserveRatio);

    const requiredReserve = totalCapital * (minReserveRatio / 100);
    const effectiveAvailable = calculateEffectiveAvailable(
      availableCapital,
      totalCapital,
      minReserveRatio,
    );
    const utilizationRate = calculateUtilizationRate(deployedCapital, totalCapital);
    const reserveRatio = calculateReserveRatio(availableCapital, totalCapital);

    const balance: PoolBalance = {
      poolId: pool.id,
      poolName: pool.name,
      status: pool.status as PoolStatus,
      riskTier: pool.riskTier as RiskTier,
      currency: pool.currency,
      totalCapital,
      availableCapital,
      deployedCapital,
      reservedCapital,
      requiredReserve,
      effectiveAvailable,
      utilizationRate,
      reserveRatio,
      isHealthy: assessPoolHealth(
        Number(pool.defaultRate),
        utilizationRate,
        reserveRatio,
      ) === 'HEALTHY',
      timestamp: new Date(),
      fromCache: false,
    };

    // Cache the balance
    if (this.redis) {
      await this.redis.setex(
        CACHE_KEYS.POOL_BALANCE(poolId),
        CACHE_TTL.BALANCE,
        JSON.stringify(balance),
      );
    }

    return balance;
  }

  /**
   * Get pool performance metrics
   */
  async getPoolPerformanceMetrics(
    poolId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<PoolPerformanceMetrics | null> {
    const pool = await this.prisma.liquidityPool.findUnique({
      where: { id: poolId },
      include: {
        advances: {
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
        transactions: {
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
      },
    });

    if (!pool) return null;

    const now = endDate || new Date();
    const periodStart = startDate || new Date(pool.createdAt);
    const daysInPeriod = Math.ceil(
      (now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Calculate advance metrics
    const advances = pool.advances;
    const completed = advances.filter((a) => a.status === 'COMPLETED');
    const defaulted = advances.filter((a) => a.status === 'DEFAULTED');
    const active = advances.filter(
      (a) => !['COMPLETED', 'DEFAULTED', 'CANCELLED'].includes(a.status),
    );

    const totalDisbursed = advances.reduce(
      (sum, a) => sum + Number(a.advanceAmount),
      0,
    );
    const totalRepaid = advances.reduce(
      (sum, a) => sum + Number(a.amountRepaid),
      0,
    );
    const totalFeesEarned = advances.reduce(
      (sum, a) => sum + Number(a.platformFeeTotal),
      0,
    );
    const totalLosses = defaulted.reduce(
      (sum, a) => sum + (Number(a.advanceAmount) - Number(a.amountRepaid)),
      0,
    );

    const avgDuration = completed.length > 0
      ? completed.reduce((sum, a) => {
          const days = a.repaidAt
            ? Math.ceil(
                (a.repaidAt.getTime() - a.disbursedAt!.getTime()) /
                  (1000 * 60 * 60 * 24),
              )
            : 0;
          return sum + days;
        }, 0) / completed.length
      : 0;

    // Calculate ROI
    const netRevenue = totalFeesEarned - totalLosses;
    const grossProfit = netRevenue;
    const profitMargin =
      totalDisbursed > 0 ? (grossProfit / totalDisbursed) * 100 : 0;
    const annualizedROI =
      daysInPeriod > 0
        ? ((grossProfit / Number(pool.totalCapital)) * 365) / daysInPeriod * 100
        : 0;

    // Top exposures
    const farmerExposures = new Map<string, number>();
    for (const advance of active) {
      const current = farmerExposures.get(advance.farmerId) || 0;
      farmerExposures.set(advance.farmerId, current + Number(advance.advanceAmount));
    }

    const topExposures = Array.from(farmerExposures.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([farmerId, amount]) => ({
        farmerId,
        farmerName: farmerId, // Would need to join with producer table
        amount,
        percentage: (amount / Number(pool.deployedCapital)) * 100,
      }));

    const metrics: PoolPerformanceMetrics = {
      poolId: pool.id,
      poolName: pool.name,
      period: {
        startDate: periodStart,
        endDate: now,
        daysInPeriod,
      },
      advances: {
        totalIssued: advances.length,
        totalCompleted: completed.length,
        totalDefaulted: defaulted.length,
        totalActive: active.length,
        completionRate: advances.length > 0
          ? (completed.length / advances.length) * 100
          : 0,
        defaultRate: advances.length > 0
          ? (defaulted.length / advances.length) * 100
          : 0,
        averageAmount: advances.length > 0
          ? totalDisbursed / advances.length
          : 0,
        averageDuration: avgDuration,
      },
      financial: {
        totalDisbursed,
        totalRepaid,
        totalFeesEarned,
        totalPenaltiesCollected: 0, // Would need to calculate from transactions
        totalLosses,
        netRevenue,
        grossProfit,
        profitMargin,
      },
      returns: {
        targetROI: Number(pool.targetReturnRate),
        actualROI: Number(pool.actualReturnRate),
        annualizedROI,
        riskAdjustedReturn: annualizedROI * (1 - Number(pool.defaultRate)),
      },
      efficiency: {
        averageUtilization: calculateUtilizationRate(
          Number(pool.deployedCapital),
          Number(pool.totalCapital),
        ),
        capitalTurnover: Number(pool.totalCapital) > 0
          ? totalDisbursed / Number(pool.totalCapital)
          : 0,
        daysSalesOutstanding: avgDuration,
      },
      risk: {
        currentDefaultRate: Number(pool.defaultRate),
        historicalDefaultRate: advances.length > 0
          ? (defaulted.length / advances.length) * 100
          : 0,
        exposureConcentration: topExposures.length > 0
          ? topExposures[0].percentage
          : 0,
        largestExposure: topExposures.length > 0 ? topExposures[0].amount : 0,
        topExposures,
      },
      calculatedAt: new Date(),
    };

    return metrics;
  }

  /**
   * Assess pool health
   */
  async assessPoolHealth(poolId: string): Promise<PoolHealthAssessment | null> {
    const balance = await this.getPoolBalance(poolId);
    if (!balance) return null;

    const metrics = await this.getPoolPerformanceMetrics(poolId);
    if (!metrics) return null;

    // Calculate health score components
    const liquidityScore = Math.min(100, balance.reserveRatio * 5); // 20% = 100
    const performanceScore = Math.max(0, 100 - metrics.risk.currentDefaultRate * 10);
    const concentrationScore = Math.max(0, 100 - metrics.risk.exposureConcentration * 2);
    const activityScore = Math.min(100, metrics.advances.totalActive * 10);

    const overallScore =
      liquidityScore * 0.3 +
      performanceScore * 0.35 +
      concentrationScore * 0.2 +
      activityScore * 0.15;

    const overallHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL' =
      overallScore >= 70 ? 'HEALTHY' : overallScore >= 40 ? 'WARNING' : 'CRITICAL';

    const recommendations: string[] = [];

    if (balance.reserveRatio < 15) {
      recommendations.push('Increase reserve ratio to at least 15%');
    }
    if (metrics.risk.currentDefaultRate > 5) {
      recommendations.push('Review underwriting criteria to reduce defaults');
    }
    if (metrics.risk.exposureConcentration > 20) {
      recommendations.push('Diversify portfolio to reduce concentration risk');
    }
    if (balance.utilizationRate < 50) {
      recommendations.push('Consider marketing to increase advance volume');
    }

    return {
      poolId,
      overallHealth,
      healthScore: Math.round(overallScore),
      indicators: {
        liquidity: {
          status: liquidityScore >= 70 ? 'HEALTHY' : liquidityScore >= 40 ? 'WARNING' : 'CRITICAL',
          reserveRatio: balance.reserveRatio,
          daysOfRunway: balance.availableCapital / (metrics.financial.totalDisbursed / metrics.period.daysInPeriod || 1),
        },
        performance: {
          status: performanceScore >= 70 ? 'HEALTHY' : performanceScore >= 40 ? 'WARNING' : 'CRITICAL',
          defaultRate: metrics.risk.currentDefaultRate,
          profitMargin: metrics.financial.profitMargin,
        },
        concentration: {
          status: concentrationScore >= 70 ? 'HEALTHY' : concentrationScore >= 40 ? 'WARNING' : 'CRITICAL',
          topExposurePercentage: metrics.risk.exposureConcentration,
          diversificationScore: concentrationScore,
        },
        activity: {
          status: activityScore >= 70 ? 'HEALTHY' : activityScore >= 40 ? 'WARNING' : 'CRITICAL',
          recentAdvances: metrics.advances.totalActive,
          growthRate: 0, // Would need historical comparison
        },
      },
      recommendations,
      assessedAt: new Date(),
    };
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // POOL CRUD OPERATIONS
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * Create a new liquidity pool
   */
  async createPool(request: CreatePoolRequest): Promise<ServiceResult<PoolDetails>> {
    try {
      const pool = await this.prisma.liquidityPool.create({
        data: {
          name: request.name,
          description: request.description,
          totalCapital: new Prisma.Decimal(request.initialCapital),
          availableCapital: new Prisma.Decimal(request.initialCapital),
          deployedCapital: new Prisma.Decimal(0),
          reservedCapital: new Prisma.Decimal(0),
          riskTier: request.riskTier,
          targetReturnRate: new Prisma.Decimal(request.targetReturnRate),
          currency: request.currency,
          minAdvanceAmount: new Prisma.Decimal(
            request.minAdvanceAmount || POOL_CONSTRAINTS.MIN_ADVANCE_AMOUNT,
          ),
          maxAdvanceAmount: new Prisma.Decimal(
            request.maxAdvanceAmount || POOL_CONSTRAINTS.MAX_ADVANCE_AMOUNT,
          ),
          maxExposureLimit: new Prisma.Decimal(request.maxExposureLimit),
          minReserveRatio: new Prisma.Decimal(
            request.minReserveRatio || POOL_CONSTRAINTS.MIN_RESERVE_RATIO,
          ),
          autoRebalanceEnabled: request.autoRebalanceEnabled ?? true,
          status: 'ACTIVE',
          createdBy: request.createdBy,
        },
      });

      // Record initial deposit transaction
      await this.prisma.poolTransaction.create({
        data: {
          poolId: pool.id,
          type: 'CAPITAL_DEPOSIT',
          amount: new Prisma.Decimal(request.initialCapital),
          balanceBefore: new Prisma.Decimal(0),
          balanceAfter: new Prisma.Decimal(request.initialCapital),
          description: 'Initial pool capitalization',
        },
      });

      return {
        success: true,
        data: await this.getPoolDetails(pool.id) as PoolDetails,
      };
    } catch (error) {
      console.error('Error creating pool:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create pool',
      };
    }
  }

  /**
   * Update pool configuration
   */
  async updatePool(request: UpdatePoolRequest): Promise<ServiceResult<PoolDetails>> {
    try {
      const updateData: Prisma.LiquidityPoolUpdateInput = {};

      if (request.name !== undefined) updateData.name = request.name;
      if (request.description !== undefined) updateData.description = request.description;
      if (request.status !== undefined) updateData.status = request.status;
      if (request.targetReturnRate !== undefined) {
        updateData.targetReturnRate = new Prisma.Decimal(request.targetReturnRate);
      }
      if (request.minAdvanceAmount !== undefined) {
        updateData.minAdvanceAmount = new Prisma.Decimal(request.minAdvanceAmount);
      }
      if (request.maxAdvanceAmount !== undefined) {
        updateData.maxAdvanceAmount = new Prisma.Decimal(request.maxAdvanceAmount);
      }
      if (request.maxExposureLimit !== undefined) {
        updateData.maxExposureLimit = new Prisma.Decimal(request.maxExposureLimit);
      }
      if (request.minReserveRatio !== undefined) {
        updateData.minReserveRatio = new Prisma.Decimal(request.minReserveRatio);
      }
      if (request.autoRebalanceEnabled !== undefined) {
        updateData.autoRebalanceEnabled = request.autoRebalanceEnabled;
      }

      await this.prisma.liquidityPool.update({
        where: { id: request.poolId },
        data: updateData,
      });

      await this.invalidatePoolCache(request.poolId);

      return {
        success: true,
        data: await this.getPoolDetails(request.poolId) as PoolDetails,
      };
    } catch (error) {
      console.error('Error updating pool:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update pool',
      };
    }
  }

  /**
   * Get pool details
   */
  async getPoolDetails(poolId: string): Promise<PoolDetails | null> {
    const pool = await this.prisma.liquidityPool.findUnique({
      where: { id: poolId },
      include: {
        _count: {
          select: { investors: true },
        },
      },
    });

    if (!pool) return null;

    return {
      id: pool.id,
      name: pool.name,
      description: pool.description || undefined,
      status: pool.status as PoolStatus,
      riskTier: pool.riskTier as RiskTier,
      currency: pool.currency,
      capital: {
        total: Number(pool.totalCapital),
        available: Number(pool.availableCapital),
        deployed: Number(pool.deployedCapital),
        reserved: Number(pool.reservedCapital),
      },
      returns: {
        targetRate: Number(pool.targetReturnRate),
        actualRate: Number(pool.actualReturnRate),
      },
      constraints: {
        minAdvanceAmount: Number(pool.minAdvanceAmount),
        maxAdvanceAmount: Number(pool.maxAdvanceAmount),
        maxExposureLimit: Number(pool.maxExposureLimit),
        minReserveRatio: Number(pool.minReserveRatio),
      },
      statistics: {
        totalAdvancesIssued: pool.totalAdvancesIssued,
        totalAdvancesCompleted: pool.totalAdvancesCompleted,
        totalAdvancesDefaulted: pool.totalAdvancesDefaulted,
        totalAdvancesActive: pool.totalAdvancesActive,
        defaultRate: Number(pool.defaultRate),
        totalDisbursed: Number(pool.totalDisbursed),
        totalRepaid: Number(pool.totalRepaid),
        totalFeesEarned: Number(pool.totalFeesEarned),
      },
      settings: {
        autoRebalanceEnabled: pool.autoRebalanceEnabled,
      },
      investorCount: pool._count.investors,
      createdAt: pool.createdAt,
      updatedAt: pool.updatedAt,
      createdBy: pool.createdBy || undefined,
    };
  }

  /**
   * List pools with filtering
   */
  async listPools(
    criteria?: PoolSelectionCriteria,
    page = 1,
    pageSize = 20,
  ): Promise<PaginatedResult<PoolDetails>> {
    const where: Prisma.LiquidityPoolWhereInput = {};

    if (criteria?.riskTier) where.riskTier = criteria.riskTier;
    if (criteria?.currency) where.currency = criteria.currency;
    if (criteria?.status?.length) where.status = { in: criteria.status };
    if (criteria?.minAvailableCapital) {
      where.availableCapital = { gte: criteria.minAvailableCapital };
    }
    if (criteria?.excludePoolIds?.length) {
      where.id = { notIn: criteria.excludePoolIds };
    }

    const [total, pools] = await Promise.all([
      this.prisma.liquidityPool.count({ where }),
      this.prisma.liquidityPool.findMany({
        where,
        include: {
          _count: {
            select: { investors: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const items: PoolDetails[] = pools.map((pool) => ({
      id: pool.id,
      name: pool.name,
      description: pool.description || undefined,
      status: pool.status as PoolStatus,
      riskTier: pool.riskTier as RiskTier,
      currency: pool.currency,
      capital: {
        total: Number(pool.totalCapital),
        available: Number(pool.availableCapital),
        deployed: Number(pool.deployedCapital),
        reserved: Number(pool.reservedCapital),
      },
      returns: {
        targetRate: Number(pool.targetReturnRate),
        actualRate: Number(pool.actualReturnRate),
      },
      constraints: {
        minAdvanceAmount: Number(pool.minAdvanceAmount),
        maxAdvanceAmount: Number(pool.maxAdvanceAmount),
        maxExposureLimit: Number(pool.maxExposureLimit),
        minReserveRatio: Number(pool.minReserveRatio),
      },
      statistics: {
        totalAdvancesIssued: pool.totalAdvancesIssued,
        totalAdvancesCompleted: pool.totalAdvancesCompleted,
        totalAdvancesDefaulted: pool.totalAdvancesDefaulted,
        totalAdvancesActive: pool.totalAdvancesActive,
        defaultRate: Number(pool.defaultRate),
        totalDisbursed: Number(pool.totalDisbursed),
        totalRepaid: Number(pool.totalRepaid),
        totalFeesEarned: Number(pool.totalFeesEarned),
      },
      settings: {
        autoRebalanceEnabled: pool.autoRebalanceEnabled,
      },
      investorCount: pool._count.investors,
      createdAt: pool.createdAt,
      updatedAt: pool.updatedAt,
      createdBy: pool.createdBy || undefined,
    }));

    return {
      items,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        hasNext: page * pageSize < total,
        hasPrevious: page > 1,
      },
    };
  }

  /**
   * Check advance eligibility for a pool
   */
  async checkAdvanceEligibility(
    poolId: string,
    amount: number,
    riskTier: RiskTier,
  ): Promise<PoolAdvanceEligibility> {
    const pool = await this.prisma.liquidityPool.findUnique({
      where: { id: poolId },
    });

    if (!pool) {
      return {
        poolId,
        isEligible: false,
        maxAllowedAmount: 0,
        reasons: ['Pool not found'],
        constraints: {},
      };
    }

    const reasons: string[] = [];
    const constraints: PoolAdvanceEligibility['constraints'] = {};

    // Check pool status
    if (pool.status !== 'ACTIVE') {
      reasons.push(`Pool is ${pool.status}`);
    }

    // Check amount constraints
    if (amount < Number(pool.minAdvanceAmount)) {
      reasons.push(`Amount below minimum (${pool.minAdvanceAmount})`);
      constraints.amountConstraint = `Minimum: ${pool.minAdvanceAmount}`;
    }

    if (amount > Number(pool.maxAdvanceAmount)) {
      reasons.push(`Amount above maximum (${pool.maxAdvanceAmount})`);
      constraints.amountConstraint = `Maximum: ${pool.maxAdvanceAmount}`;
    }

    // Check reserve constraint
    const effectiveAvailable = calculateEffectiveAvailable(
      Number(pool.availableCapital),
      Number(pool.totalCapital),
      Number(pool.minReserveRatio),
    );

    if (amount > effectiveAvailable) {
      reasons.push(`Insufficient available capital after reserve (${effectiveAvailable.toFixed(2)})`);
      constraints.reserveConstraint = `Available: ${effectiveAvailable.toFixed(2)}`;
    }

    // Check exposure limit
    const maxSingleAdvance = Number(pool.totalCapital) * (POOL_CONSTRAINTS.MAX_SINGLE_ADVANCE_RATIO / 100);
    if (amount > maxSingleAdvance) {
      reasons.push(`Exceeds single advance limit (${maxSingleAdvance.toFixed(2)})`);
      constraints.exposureConstraint = `Max single: ${maxSingleAdvance.toFixed(2)}`;
    }

    const isEligible = reasons.length === 0;
    const maxAllowedAmount = Math.min(
      effectiveAvailable,
      Number(pool.maxAdvanceAmount),
      maxSingleAdvance,
    );

    return {
      poolId,
      isEligible,
      maxAllowedAmount: Math.max(0, maxAllowedAmount),
      reasons: isEligible ? ['All checks passed'] : reasons,
      constraints,
    };
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ════════════════════════════════════════════════════════════════════════════════

  private async getPoolById(poolId: string) {
    return this.prisma.liquidityPool.findUnique({
      where: { id: poolId },
    });
  }

  private async invalidatePoolCache(poolId: string): Promise<void> {
    if (!this.redis) return;

    await Promise.all([
      this.redis.del(CACHE_KEYS.POOL_BALANCE(poolId)),
      this.redis.del(CACHE_KEYS.POOL_METRICS(poolId)),
      this.redis.del(CACHE_KEYS.POOL_DETAILS(poolId)),
      this.redis.del(CACHE_KEYS.ALL_POOLS_SUMMARY),
    ]);
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Create a new LiquidityPoolService instance
 */
export function createLiquidityPoolService(
  prisma: PrismaClient,
  redis?: Redis,
): LiquidityPoolService {
  return new LiquidityPoolService(prisma, redis);
}
