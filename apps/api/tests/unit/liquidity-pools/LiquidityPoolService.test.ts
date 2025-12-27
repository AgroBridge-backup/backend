/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AGROBRIDGE - LIQUIDITY POOL SERVICE TEST SUITE
 * Comprehensive Tests for Capital Pool Management
 *
 * Test Coverage:
 * - Capital allocation and pool selection
 * - Capital release (repayments)
 * - Default handling and loss recognition
 * - Pool CRUD operations
 * - Pool balance and performance metrics
 * - Health assessment
 * - Utility functions
 *
 * @module liquidity-pools/tests
 * @version 1.0.0
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PrismaClient, Prisma } from '@prisma/client';
import type { Redis } from 'ioredis';
import { LiquidityPoolService, createLiquidityPoolService } from '../../../src/modules/liquidity-pools/services/LiquidityPoolService.js';
import {
  PoolStatus,
  RiskTier,
  AllocationErrorCode,
  AllocationPriority,
  POOL_CONSTRAINTS,
  PERFORMANCE_THRESHOLDS,
  calculateEffectiveAvailable,
  calculateUtilizationRate,
  calculateReserveRatio,
  assessPoolHealth,
  validateAllocationAmount,
  getFeesForTier,
  getAdvancePercentageForTier,
  RISK_TIER_ADVANCE_PERCENTAGES,
  RISK_TIER_FEES,
} from '../../../src/modules/liquidity-pools/types/PoolTypes.js';

// ════════════════════════════════════════════════════════════════════════════════
// MOCK DATA FACTORIES
// ════════════════════════════════════════════════════════════════════════════════

const createMockPool = (overrides: Partial<Prisma.LiquidityPoolGetPayload<{}>> = {}) => ({
  id: 'pool_test123',
  name: 'Test Pool A',
  description: 'Test liquidity pool',
  status: 'ACTIVE',
  riskTier: 'A',
  currency: 'MXN',
  totalCapital: new Prisma.Decimal(1000000),
  availableCapital: new Prisma.Decimal(600000),
  deployedCapital: new Prisma.Decimal(400000),
  reservedCapital: new Prisma.Decimal(0),
  targetReturnRate: new Prisma.Decimal(12),
  actualReturnRate: new Prisma.Decimal(10.5),
  minAdvanceAmount: new Prisma.Decimal(5000),
  maxAdvanceAmount: new Prisma.Decimal(500000),
  maxExposureLimit: new Prisma.Decimal(200000),
  minReserveRatio: new Prisma.Decimal(15),
  defaultRate: new Prisma.Decimal(0.015), // 1.5% default rate (decimal format)
  totalAdvancesIssued: 50,
  totalAdvancesCompleted: 40,
  totalAdvancesDefaulted: 2,
  totalAdvancesActive: 8,
  totalDisbursed: new Prisma.Decimal(5000000),
  totalRepaid: new Prisma.Decimal(4500000),
  totalFeesEarned: new Prisma.Decimal(150000),
  autoRebalanceEnabled: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-06-01'),
  createdBy: 'admin_user123',
  ...overrides,
});

const createMockAllocationRequest = (overrides = {}) => ({
  advanceId: 'adv_test123',
  farmerId: 'farmer_abc',
  orderId: 'order_xyz',
  requestedAmount: 50000,
  currency: 'MXN',
  riskTier: RiskTier.A,
  creditScore: 720,
  expectedRepaymentDate: new Date('2024-12-01'),
  expectedDeliveryDate: new Date('2024-11-01'),
  ...overrides,
});

const createMockReleaseRequest = (overrides = {}) => ({
  advanceId: 'adv_test123',
  poolId: 'pool_test123',
  amount: 50000,
  releaseType: 'FULL_REPAYMENT' as const,
  source: 'BUYER_PAYMENT' as const,
  feesCollected: 1500,
  penaltiesCollected: 0,
  ...overrides,
});

const createMockTransaction = (overrides = {}) => ({
  id: 'txn_test123',
  poolId: 'pool_test123',
  type: 'ADVANCE_DISBURSEMENT',
  amount: new Prisma.Decimal(50000),
  balanceBefore: new Prisma.Decimal(600000),
  balanceAfter: new Prisma.Decimal(550000),
  description: 'Test transaction',
  metadata: {},
  relatedAdvanceId: 'adv_test123',
  relatedInvestorId: null,
  createdAt: new Date(),
  ...overrides,
});

// ════════════════════════════════════════════════════════════════════════════════
// MOCK SETUP
// ════════════════════════════════════════════════════════════════════════════════

const mockPrisma = {
  liquidityPool: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  poolTransaction: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
} as unknown as PrismaClient;

const mockRedis = {
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  mget: vi.fn(),
} as unknown as Redis;

describe('LiquidityPoolService', () => {
  let service: LiquidityPoolService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LiquidityPoolService(mockPrisma, mockRedis);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // CAPITAL ALLOCATION TESTS
  // ════════════════════════════════════════════════════════════════════════════════

  describe('allocateCapital', () => {
    describe('Successful Allocations', () => {
      it('should allocate capital from preferred pool successfully', async () => {
        const mockPool = createMockPool();
        const request = createMockAllocationRequest({ preferredPoolId: mockPool.id });

        (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);
        (mockPrisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => {
          const tx = {
            liquidityPool: {
              findUnique: vi.fn().mockResolvedValue(mockPool),
              update: vi.fn().mockResolvedValue({
                ...mockPool,
                availableCapital: new Prisma.Decimal(550000),
                deployedCapital: new Prisma.Decimal(450000),
              }),
            },
            poolTransaction: {
              create: vi.fn().mockResolvedValue(createMockTransaction()),
            },
          };
          return fn(tx);
        });

        const result = await service.allocateCapital(request);

        expect(result.success).toBe(true);
        expect(result.allocation).toBeDefined();
        expect(result.allocation!.poolId).toBe(mockPool.id);
        expect(result.allocation!.allocatedAmount).toBe(request.requestedAmount);
        expect(result.allocation!.fees).toBeDefined();
      });

      it('should select optimal pool when no preferred pool specified', async () => {
        const mockPool = createMockPool();
        const request = createMockAllocationRequest();

        (mockPrisma.liquidityPool.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockPool]);
        (mockPrisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => {
          const tx = {
            liquidityPool: {
              findUnique: vi.fn().mockResolvedValue(mockPool),
              update: vi.fn().mockResolvedValue({
                ...mockPool,
                availableCapital: new Prisma.Decimal(550000),
              }),
            },
            poolTransaction: {
              create: vi.fn().mockResolvedValue(createMockTransaction()),
            },
          };
          return fn(tx);
        });

        const result = await service.allocateCapital(request);

        expect(result.success).toBe(true);
        expect(mockPrisma.liquidityPool.findMany).toHaveBeenCalled();
      });

      it('should calculate fees correctly based on risk tier', async () => {
        const mockPool = createMockPool();
        const request = createMockAllocationRequest({
          preferredPoolId: mockPool.id,
          riskTier: RiskTier.B,
          requestedAmount: 100000,
        });

        (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);
        (mockPrisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => {
          const tx = {
            liquidityPool: {
              findUnique: vi.fn().mockResolvedValue(mockPool),
              update: vi.fn().mockResolvedValue(mockPool),
            },
            poolTransaction: {
              create: vi.fn().mockResolvedValue(createMockTransaction()),
            },
          };
          return fn(tx);
        });

        const result = await service.allocateCapital(request);

        expect(result.success).toBe(true);
        // Tier B fees: farmer 2.5%, buyer 1.25%
        const expectedFarmerFee = 100000 * 0.025; // 2500
        const expectedBuyerFee = 100000 * 0.0125; // 1250
        expect(result.allocation!.fees.farmerFee).toBe(expectedFarmerFee);
        expect(result.allocation!.fees.buyerFee).toBe(expectedBuyerFee);
        expect(result.allocation!.fees.platformTotal).toBe(expectedFarmerFee + expectedBuyerFee);
      });

      it('should handle allocation with all priority modes', async () => {
        const mockPool = createMockPool();
        const priorities = [
          AllocationPriority.LOWEST_RISK,
          AllocationPriority.HIGHEST_AVAILABLE,
          AllocationPriority.BEST_RETURN,
        ];

        for (const priority of priorities) {
          vi.clearAllMocks();
          const request = createMockAllocationRequest({ priority });

          (mockPrisma.liquidityPool.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockPool]);
          (mockPrisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => {
            const tx = {
              liquidityPool: {
                findUnique: vi.fn().mockResolvedValue(mockPool),
                update: vi.fn().mockResolvedValue(mockPool),
              },
              poolTransaction: {
                create: vi.fn().mockResolvedValue(createMockTransaction()),
              },
            };
            return fn(tx);
          });

          const result = await service.allocateCapital(request);
          expect(result.success).toBe(true);
        }
      });
    });

    describe('Allocation Failures', () => {
      it('should return error when pool not found', async () => {
        const request = createMockAllocationRequest({ preferredPoolId: 'nonexistent_pool' });

        (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        (mockPrisma.liquidityPool.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

        const result = await service.allocateCapital(request);

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe(AllocationErrorCode.POOL_NOT_FOUND);
      });

      it('should return error when pool is paused', async () => {
        const pausedPool = createMockPool({ status: 'PAUSED' });
        const request = createMockAllocationRequest({ preferredPoolId: pausedPool.id });

        (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(pausedPool);
        (mockPrisma.liquidityPool.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

        const result = await service.allocateCapital(request);

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe(AllocationErrorCode.POOL_PAUSED);
      });

      it('should return error when amount is below minimum', async () => {
        const mockPool = createMockPool({ minAdvanceAmount: new Prisma.Decimal(10000) });
        const request = createMockAllocationRequest({
          preferredPoolId: mockPool.id,
          requestedAmount: 5000, // Below minimum
        });

        (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);
        (mockPrisma.liquidityPool.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

        const result = await service.allocateCapital(request);

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe(AllocationErrorCode.AMOUNT_BELOW_MINIMUM);
      });

      it('should return error when amount is above maximum', async () => {
        const mockPool = createMockPool({ maxAdvanceAmount: new Prisma.Decimal(100000) });
        const request = createMockAllocationRequest({
          preferredPoolId: mockPool.id,
          requestedAmount: 200000, // Above maximum
        });

        (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);
        (mockPrisma.liquidityPool.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

        const result = await service.allocateCapital(request);

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe(AllocationErrorCode.AMOUNT_ABOVE_MAXIMUM);
      });

      it('should return error when allocation would violate reserve ratio', async () => {
        // Pool with low available capital
        const mockPool = createMockPool({
          totalCapital: new Prisma.Decimal(100000),
          availableCapital: new Prisma.Decimal(20000), // 20% reserve
          minReserveRatio: new Prisma.Decimal(15), // Need 15% = 15000 reserve
        });
        const request = createMockAllocationRequest({
          preferredPoolId: mockPool.id,
          requestedAmount: 10000, // Would leave only 10000 (10% < 15% required)
        });

        (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);
        (mockPrisma.liquidityPool.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

        const result = await service.allocateCapital(request);

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe(AllocationErrorCode.RESERVE_RATIO_VIOLATION);
      });

      it('should handle concurrent allocation conflict', async () => {
        const mockPool = createMockPool();
        const request = createMockAllocationRequest({ preferredPoolId: mockPool.id });

        (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);
        (mockPrisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async () => {
          throw new Error('CONCURRENT_ALLOCATION');
        });

        const result = await service.allocateCapital(request);

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe(AllocationErrorCode.CONCURRENT_ALLOCATION);
      });

      it('should provide alternative pools on failure', async () => {
        const mockPool = createMockPool({ status: 'PAUSED' });
        const alternativePool = createMockPool({ id: 'pool_alternative', name: 'Alternative Pool' });
        const request = createMockAllocationRequest({ preferredPoolId: mockPool.id });

        (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);
        (mockPrisma.liquidityPool.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([alternativePool]);

        const result = await service.allocateCapital(request);

        expect(result.success).toBe(false);
        expect(result.alternatives).toBeDefined();
        expect(result.alternatives!.length).toBeGreaterThan(0);
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // CAPITAL RELEASE TESTS
  // ════════════════════════════════════════════════════════════════════════════════

  describe('releaseCapital', () => {
    it('should release capital successfully on full repayment', async () => {
      const mockPool = createMockPool();
      const request = createMockReleaseRequest();

      (mockPrisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => {
        const tx = {
          liquidityPool: {
            findUnique: vi.fn().mockResolvedValue(mockPool),
            update: vi.fn().mockResolvedValue({
              ...mockPool,
              availableCapital: new Prisma.Decimal(651500), // 600000 + 50000 + 1500 fees
              deployedCapital: new Prisma.Decimal(350000),
            }),
          },
          poolTransaction: {
            create: vi.fn().mockResolvedValue(createMockTransaction({ type: 'ADVANCE_REPAYMENT' })),
          },
        };
        return fn(tx);
      });

      const result = await service.releaseCapital(request);

      expect(result.success).toBe(true);
      expect(result.release).toBeDefined();
      expect(result.release!.principalReleased).toBe(50000);
      expect(result.release!.feesCollected).toBe(1500);
    });

    it('should handle partial repayment correctly', async () => {
      const mockPool = createMockPool();
      const request = createMockReleaseRequest({
        releaseType: 'PARTIAL_REPAYMENT',
        amount: 25000,
      });

      (mockPrisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => {
        const tx = {
          liquidityPool: {
            findUnique: vi.fn().mockResolvedValue(mockPool),
            update: vi.fn().mockResolvedValue(mockPool),
          },
          poolTransaction: {
            create: vi.fn().mockResolvedValue(createMockTransaction()),
          },
        };
        return fn(tx);
      });

      const result = await service.releaseCapital(request);

      expect(result.success).toBe(true);
      expect(result.release!.principalReleased).toBe(25000);
    });

    it('should record fees and penalties separately', async () => {
      const mockPool = createMockPool();
      const request = createMockReleaseRequest({
        feesCollected: 2000,
        penaltiesCollected: 500,
      });

      let transactionCount = 0;
      (mockPrisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => {
        const tx = {
          liquidityPool: {
            findUnique: vi.fn().mockResolvedValue(mockPool),
            update: vi.fn().mockResolvedValue(mockPool),
          },
          poolTransaction: {
            create: vi.fn().mockImplementation(() => {
              transactionCount++;
              return createMockTransaction();
            }),
          },
        };
        return fn(tx);
      });

      const result = await service.releaseCapital(request);

      expect(result.success).toBe(true);
      // Should create 3 transactions: repayment, fees, penalties
      expect(transactionCount).toBe(3);
    });

    it('should return error when pool not found', async () => {
      const request = createMockReleaseRequest({ poolId: 'nonexistent_pool' });

      (mockPrisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => {
        const tx = {
          liquidityPool: {
            findUnique: vi.fn().mockResolvedValue(null),
          },
        };
        return fn(tx);
      });

      const result = await service.releaseCapital(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Pool not found');
    });

    it('should calculate net amount correctly', async () => {
      const mockPool = createMockPool();
      const request = createMockReleaseRequest({
        amount: 50000,
        feesCollected: 2500,
        penaltiesCollected: 1000,
      });

      (mockPrisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => {
        const tx = {
          liquidityPool: {
            findUnique: vi.fn().mockResolvedValue(mockPool),
            update: vi.fn().mockResolvedValue(mockPool),
          },
          poolTransaction: {
            create: vi.fn().mockResolvedValue(createMockTransaction()),
          },
        };
        return fn(tx);
      });

      const result = await service.releaseCapital(request);

      expect(result.success).toBe(true);
      expect(result.release!.netAmount).toBe(50000 + 2500 + 1000); // 53500
    });
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // DEFAULT HANDLING TESTS
  // ════════════════════════════════════════════════════════════════════════════════

  describe('handleDefault', () => {
    it('should handle advance default with no recovery', async () => {
      const mockPool = createMockPool();

      (mockPrisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => {
        const tx = {
          liquidityPool: {
            findUnique: vi.fn().mockResolvedValue(mockPool),
            update: vi.fn().mockResolvedValue({
              ...mockPool,
              totalAdvancesDefaulted: 3,
              deployedCapital: new Prisma.Decimal(350000),
            }),
          },
          poolTransaction: {
            create: vi.fn().mockResolvedValue(createMockTransaction({ type: 'ADJUSTMENT' })),
          },
        };
        return fn(tx);
      });

      const result = await service.handleDefault('adv_123', 'pool_test123', 50000, 0);

      expect(result.success).toBe(true);
      expect(result.data!.lossRecorded).toBe(50000);
      expect(result.data!.poolUpdated).toBe(true);
    });

    it('should handle default with partial recovery', async () => {
      const mockPool = createMockPool();

      (mockPrisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => {
        const tx = {
          liquidityPool: {
            findUnique: vi.fn().mockResolvedValue(mockPool),
            update: vi.fn().mockResolvedValue(mockPool),
          },
          poolTransaction: {
            create: vi.fn().mockResolvedValue(createMockTransaction()),
          },
        };
        return fn(tx);
      });

      const result = await service.handleDefault('adv_123', 'pool_test123', 50000, 20000);

      expect(result.success).toBe(true);
      expect(result.data!.lossRecorded).toBe(30000); // 50000 - 20000 recovered
    });

    it('should return error when pool not found', async () => {
      (mockPrisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => {
        const tx = {
          liquidityPool: {
            findUnique: vi.fn().mockResolvedValue(null),
          },
        };
        return fn(tx);
      });

      const result = await service.handleDefault('adv_123', 'nonexistent_pool', 50000);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Pool not found');
    });
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // POOL BALANCE TESTS
  // ════════════════════════════════════════════════════════════════════════════════

  describe('getPoolBalance', () => {
    it('should return pool balance from cache if available', async () => {
      const cachedBalance = {
        poolId: 'pool_test123',
        poolName: 'Test Pool',
        status: PoolStatus.ACTIVE,
        totalCapital: 1000000,
        availableCapital: 600000,
        fromCache: true,
      };

      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify(cachedBalance));

      const result = await service.getPoolBalance('pool_test123');

      expect(result).toBeDefined();
      expect(result!.fromCache).toBe(true);
      expect(mockPrisma.liquidityPool.findUnique).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache when not in cache', async () => {
      const mockPool = createMockPool();

      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);

      const result = await service.getPoolBalance('pool_test123');

      expect(result).toBeDefined();
      expect(result!.poolId).toBe('pool_test123');
      expect(result!.fromCache).toBe(false);
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should calculate effective available correctly', async () => {
      const mockPool = createMockPool({
        totalCapital: new Prisma.Decimal(100000),
        availableCapital: new Prisma.Decimal(30000),
        minReserveRatio: new Prisma.Decimal(15),
      });

      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);

      const result = await service.getPoolBalance('pool_test123');

      // Required reserve: 100000 * 0.15 = 15000
      // Effective available: 30000 - 15000 = 15000
      expect(result!.effectiveAvailable).toBe(15000);
    });

    it('should return null when pool not found', async () => {
      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.getPoolBalance('nonexistent_pool');

      expect(result).toBeNull();
    });

    it('should assess pool health correctly', async () => {
      const healthyPool = createMockPool({
        defaultRate: new Prisma.Decimal(0.01), // 1% default rate (decimal format)
        totalCapital: new Prisma.Decimal(100000),
        availableCapital: new Prisma.Decimal(30000), // 30% reserve
        deployedCapital: new Prisma.Decimal(70000), // 70% utilization
      });

      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(healthyPool);

      const result = await service.getPoolBalance('pool_test123');

      expect(result!.isHealthy).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // POOL CRUD TESTS
  // ════════════════════════════════════════════════════════════════════════════════

  describe('createPool', () => {
    it('should create a new pool successfully', async () => {
      const createRequest = {
        name: 'New Test Pool',
        description: 'A new liquidity pool',
        initialCapital: 500000,
        currency: 'MXN',
        riskTier: RiskTier.A,
        targetReturnRate: 12,
        maxExposureLimit: 100000,
        createdBy: 'admin_123',
      };

      const createdPool = createMockPool({
        id: 'pool_new123',
        name: createRequest.name,
        totalCapital: new Prisma.Decimal(createRequest.initialCapital),
        availableCapital: new Prisma.Decimal(createRequest.initialCapital),
      });

      (mockPrisma.liquidityPool.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdPool);
      (mockPrisma.poolTransaction.create as ReturnType<typeof vi.fn>).mockResolvedValue(createMockTransaction());
      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...createdPool,
        _count: { investors: 0 },
      });

      const result = await service.createPool(createRequest);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.name).toBe(createRequest.name);
    });

    it('should record initial capital deposit transaction', async () => {
      const createRequest = {
        name: 'New Pool',
        initialCapital: 500000,
        currency: 'MXN',
        riskTier: RiskTier.A,
        targetReturnRate: 12,
        maxExposureLimit: 100000,
        createdBy: 'admin_123',
      };

      const createdPool = createMockPool({ id: 'pool_new' });

      (mockPrisma.liquidityPool.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdPool);
      (mockPrisma.poolTransaction.create as ReturnType<typeof vi.fn>).mockResolvedValue(createMockTransaction());
      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...createdPool,
        _count: { investors: 0 },
      });

      await service.createPool(createRequest);

      expect(mockPrisma.poolTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'CAPITAL_DEPOSIT',
            description: 'Initial pool capitalization',
          }),
        }),
      );
    });

    it('should apply default constraints when not specified', async () => {
      const createRequest = {
        name: 'Minimal Pool',
        initialCapital: 100000,
        currency: 'MXN',
        riskTier: RiskTier.B,
        targetReturnRate: 10,
        maxExposureLimit: 50000,
        createdBy: 'admin_123',
      };

      (mockPrisma.liquidityPool.create as ReturnType<typeof vi.fn>).mockImplementation(async (args) => {
        // Verify defaults are applied
        expect(Number(args.data.minAdvanceAmount)).toBe(POOL_CONSTRAINTS.MIN_ADVANCE_AMOUNT);
        expect(Number(args.data.maxAdvanceAmount)).toBe(POOL_CONSTRAINTS.MAX_ADVANCE_AMOUNT);
        expect(Number(args.data.minReserveRatio)).toBe(POOL_CONSTRAINTS.MIN_RESERVE_RATIO);
        return createMockPool();
      });
      (mockPrisma.poolTransaction.create as ReturnType<typeof vi.fn>).mockResolvedValue(createMockTransaction());
      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...createMockPool(),
        _count: { investors: 0 },
      });

      await service.createPool(createRequest);

      expect(mockPrisma.liquidityPool.create).toHaveBeenCalled();
    });
  });

  describe('updatePool', () => {
    it('should update pool successfully', async () => {
      const updateRequest = {
        poolId: 'pool_test123',
        name: 'Updated Pool Name',
        status: PoolStatus.PAUSED,
        updatedBy: 'admin_123',
      };

      const updatedPool = createMockPool({
        name: updateRequest.name,
        status: updateRequest.status,
      });

      (mockPrisma.liquidityPool.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedPool);
      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...updatedPool,
        _count: { investors: 0 },
      });

      const result = await service.updatePool(updateRequest);

      expect(result.success).toBe(true);
      expect(result.data!.name).toBe('Updated Pool Name');
    });

    it('should invalidate cache after update', async () => {
      const updateRequest = {
        poolId: 'pool_test123',
        name: 'New Name',
        updatedBy: 'admin_123',
      };

      (mockPrisma.liquidityPool.update as ReturnType<typeof vi.fn>).mockResolvedValue(createMockPool());
      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...createMockPool(),
        _count: { investors: 0 },
      });

      await service.updatePool(updateRequest);

      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  describe('getPoolDetails', () => {
    it('should return full pool details', async () => {
      const mockPool = createMockPool();

      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockPool,
        _count: { investors: 5 },
      });

      const result = await service.getPoolDetails('pool_test123');

      expect(result).toBeDefined();
      expect(result!.capital).toEqual({
        total: 1000000,
        available: 600000,
        deployed: 400000,
        reserved: 0,
      });
      expect(result!.statistics.totalAdvancesIssued).toBe(50);
      expect(result!.investorCount).toBe(5);
    });

    it('should return null for non-existent pool', async () => {
      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.getPoolDetails('nonexistent_pool');

      expect(result).toBeNull();
    });
  });

  describe('listPools', () => {
    it('should return paginated list of pools', async () => {
      const mockPools = [
        createMockPool({ id: 'pool_1' }),
        createMockPool({ id: 'pool_2' }),
      ];

      (mockPrisma.liquidityPool.count as ReturnType<typeof vi.fn>).mockResolvedValue(10);
      (mockPrisma.liquidityPool.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPools.map((p) => ({ ...p, _count: { investors: 2 } })),
      );

      const result = await service.listPools({}, 1, 2);

      expect(result.items.length).toBe(2);
      expect(result.pagination.total).toBe(10);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.pageSize).toBe(2);
      expect(result.pagination.totalPages).toBe(5);
    });

    it('should filter by risk tier', async () => {
      (mockPrisma.liquidityPool.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (mockPrisma.liquidityPool.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { ...createMockPool({ riskTier: 'A' }), _count: { investors: 0 } },
      ]);

      await service.listPools({ riskTier: RiskTier.A });

      expect(mockPrisma.liquidityPool.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ riskTier: RiskTier.A }),
        }),
      );
    });

    it('should filter by status', async () => {
      (mockPrisma.liquidityPool.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (mockPrisma.liquidityPool.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await service.listPools({ status: [PoolStatus.ACTIVE, PoolStatus.PAUSED] });

      expect(mockPrisma.liquidityPool.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: [PoolStatus.ACTIVE, PoolStatus.PAUSED] },
          }),
        }),
      );
    });
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // ADVANCE ELIGIBILITY TESTS
  // ════════════════════════════════════════════════════════════════════════════════

  describe('checkAdvanceEligibility', () => {
    it('should return eligible when all checks pass', async () => {
      const mockPool = createMockPool({
        status: 'ACTIVE',
        minAdvanceAmount: new Prisma.Decimal(5000),
        maxAdvanceAmount: new Prisma.Decimal(100000),
        totalCapital: new Prisma.Decimal(1000000),
        availableCapital: new Prisma.Decimal(300000),
        minReserveRatio: new Prisma.Decimal(15),
      });

      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);

      const result = await service.checkAdvanceEligibility('pool_test123', 50000, RiskTier.A);

      expect(result.isEligible).toBe(true);
      expect(result.reasons).toContain('All checks passed');
    });

    it('should return ineligible when pool is not active', async () => {
      const mockPool = createMockPool({ status: 'PAUSED' });

      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);

      const result = await service.checkAdvanceEligibility('pool_test123', 50000, RiskTier.A);

      expect(result.isEligible).toBe(false);
      expect(result.reasons).toContain('Pool is PAUSED');
    });

    it('should return ineligible when amount below minimum', async () => {
      const mockPool = createMockPool({ minAdvanceAmount: new Prisma.Decimal(10000) });

      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);

      const result = await service.checkAdvanceEligibility('pool_test123', 5000, RiskTier.A);

      expect(result.isEligible).toBe(false);
      expect(result.reasons.some((r) => r.includes('below minimum'))).toBe(true);
    });

    it('should return ineligible when amount above maximum', async () => {
      const mockPool = createMockPool({ maxAdvanceAmount: new Prisma.Decimal(50000) });

      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);

      const result = await service.checkAdvanceEligibility('pool_test123', 100000, RiskTier.A);

      expect(result.isEligible).toBe(false);
      expect(result.reasons.some((r) => r.includes('above maximum'))).toBe(true);
    });

    it('should return ineligible when insufficient effective capital', async () => {
      const mockPool = createMockPool({
        totalCapital: new Prisma.Decimal(100000),
        availableCapital: new Prisma.Decimal(20000), // 20% available
        minReserveRatio: new Prisma.Decimal(15), // Need 15% = 15000 reserve
      });

      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);

      // Effective available = 20000 - 15000 = 5000, requesting 10000
      const result = await service.checkAdvanceEligibility('pool_test123', 10000, RiskTier.A);

      expect(result.isEligible).toBe(false);
      expect(result.reasons.some((r) => r.includes('Insufficient available capital'))).toBe(true);
    });

    it('should calculate max allowed amount correctly', async () => {
      const mockPool = createMockPool({
        totalCapital: new Prisma.Decimal(1000000),
        availableCapital: new Prisma.Decimal(200000),
        maxAdvanceAmount: new Prisma.Decimal(80000),
        minReserveRatio: new Prisma.Decimal(15),
      });

      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);

      const result = await service.checkAdvanceEligibility('pool_test123', 50000, RiskTier.A);

      // Max is min of: effectiveAvailable (200000-150000=50000), maxAdvance (80000), maxSingle (100000)
      expect(result.maxAllowedAmount).toBe(50000);
    });

    it('should return not found error for non-existent pool', async () => {
      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.checkAdvanceEligibility('nonexistent', 50000, RiskTier.A);

      expect(result.isEligible).toBe(false);
      expect(result.reasons).toContain('Pool not found');
      expect(result.maxAllowedAmount).toBe(0);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // FACTORY FUNCTION TESTS
  // ════════════════════════════════════════════════════════════════════════════════

  describe('createLiquidityPoolService', () => {
    it('should create service instance with Redis', () => {
      const service = createLiquidityPoolService(mockPrisma, mockRedis);
      expect(service).toBeInstanceOf(LiquidityPoolService);
    });

    it('should create service instance without Redis', () => {
      const service = createLiquidityPoolService(mockPrisma);
      expect(service).toBeInstanceOf(LiquidityPoolService);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTION TESTS
// ════════════════════════════════════════════════════════════════════════════════

describe('Pool Type Utility Functions', () => {
  describe('getAdvancePercentageForTier', () => {
    it('should return correct percentage for each tier', () => {
      expect(getAdvancePercentageForTier(RiskTier.A)).toBe(85);
      expect(getAdvancePercentageForTier(RiskTier.B)).toBe(75);
      expect(getAdvancePercentageForTier(RiskTier.C)).toBe(70);
    });
  });

  describe('getFeesForTier', () => {
    it('should return correct fees for Tier A', () => {
      const fees = getFeesForTier(RiskTier.A);
      expect(fees.farmerFee).toBe(2.0);
      expect(fees.buyerFee).toBe(1.0);
    });

    it('should return correct fees for Tier B', () => {
      const fees = getFeesForTier(RiskTier.B);
      expect(fees.farmerFee).toBe(2.5);
      expect(fees.buyerFee).toBe(1.25);
    });

    it('should return correct fees for Tier C', () => {
      const fees = getFeesForTier(RiskTier.C);
      expect(fees.farmerFee).toBe(3.5);
      expect(fees.buyerFee).toBe(1.75);
    });
  });

  describe('calculateEffectiveAvailable', () => {
    it('should calculate effective available correctly', () => {
      // Pool with 100k total, 50k available, 15% reserve required
      const result = calculateEffectiveAvailable(50000, 100000, 15);
      // Required reserve: 100000 * 0.15 = 15000
      // Effective: 50000 - 15000 = 35000
      expect(result).toBe(35000);
    });

    it('should return 0 when available is less than reserve', () => {
      const result = calculateEffectiveAvailable(10000, 100000, 15);
      // Required reserve: 15000, available: 10000
      // Effective: max(0, 10000 - 15000) = 0
      expect(result).toBe(0);
    });

    it('should handle edge case of zero total capital', () => {
      const result = calculateEffectiveAvailable(0, 0, 15);
      expect(result).toBe(0);
    });
  });

  describe('calculateUtilizationRate', () => {
    it('should calculate utilization rate correctly', () => {
      const result = calculateUtilizationRate(60000, 100000);
      expect(result).toBe(60);
    });

    it('should return 0 when total capital is 0', () => {
      const result = calculateUtilizationRate(0, 0);
      expect(result).toBe(0);
    });

    it('should handle 100% utilization', () => {
      const result = calculateUtilizationRate(100000, 100000);
      expect(result).toBe(100);
    });
  });

  describe('calculateReserveRatio', () => {
    it('should calculate reserve ratio correctly', () => {
      const result = calculateReserveRatio(30000, 100000);
      expect(result).toBe(30);
    });

    it('should return 100 when total capital is 0', () => {
      const result = calculateReserveRatio(0, 0);
      expect(result).toBe(100);
    });
  });

  describe('assessPoolHealth', () => {
    // Note: defaultRate uses decimal format (0.01 = 1%), thresholds are:
    // WARNING_DEFAULT_RATE: 0.05 (5%), CRITICAL_DEFAULT_RATE: 0.10 (10%)
    // MAX_UTILIZATION: 0.85 (85% as decimal, compared with utilizationRate/100)

    it('should return HEALTHY for good metrics', () => {
      // 1% default rate, 70% utilization, 25% reserve
      const result = assessPoolHealth(0.01, 70, 25);
      expect(result).toBe('HEALTHY');
    });

    it('should return WARNING for elevated default rate', () => {
      // 6% default rate (>5% warning threshold), 70% utilization, 25% reserve
      const result = assessPoolHealth(0.06, 70, 25);
      expect(result).toBe('WARNING');
    });

    it('should return CRITICAL for high default rate', () => {
      // 11% default rate (>10% critical threshold)
      const result = assessPoolHealth(0.11, 70, 25);
      expect(result).toBe('CRITICAL');
    });

    it('should return CRITICAL for very low reserve', () => {
      // 1% default rate, 95% utilization, 4% reserve (<5% critical)
      const result = assessPoolHealth(0.01, 95, 4);
      expect(result).toBe('CRITICAL');
    });

    it('should return WARNING for low reserve', () => {
      // 1% default rate, 80% utilization, 8% reserve (<10% warning)
      const result = assessPoolHealth(0.01, 80, 8);
      expect(result).toBe('WARNING');
    });

    it('should return WARNING for high utilization', () => {
      // 1% default rate, 90% utilization (>85% warning threshold), 25% reserve
      const result = assessPoolHealth(0.01, 90, 25);
      expect(result).toBe('WARNING');
    });
  });

  describe('validateAllocationAmount', () => {
    const defaultConstraints = {
      minAdvance: 5000,
      maxAdvance: 500000,
      maxSingleAdvanceRatio: 10,
      minReserveRatio: 15,
    };

    it('should return valid for acceptable amount', () => {
      const result = validateAllocationAmount(50000, 300000, 1000000, defaultConstraints);
      expect(result.valid).toBe(true);
    });

    it('should return error for amount below minimum', () => {
      const result = validateAllocationAmount(3000, 300000, 1000000, defaultConstraints);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe(AllocationErrorCode.AMOUNT_BELOW_MINIMUM);
    });

    it('should return error for amount above maximum', () => {
      const result = validateAllocationAmount(600000, 700000, 1000000, defaultConstraints);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe(AllocationErrorCode.AMOUNT_ABOVE_MAXIMUM);
    });

    it('should return error for exceeding single advance limit', () => {
      // Max single: 1000000 * 0.10 = 100000
      const result = validateAllocationAmount(150000, 500000, 1000000, defaultConstraints);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe(AllocationErrorCode.EXPOSURE_LIMIT_EXCEEDED);
    });

    it('should return error for reserve ratio violation', () => {
      // Required reserve: 1000000 * 0.15 = 150000
      // Available: 200000, Effective: 50000
      // Requesting 80000 would violate
      const result = validateAllocationAmount(80000, 200000, 1000000, defaultConstraints);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe(AllocationErrorCode.RESERVE_RATIO_VIOLATION);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// CONSTANTS TESTS
// ════════════════════════════════════════════════════════════════════════════════

describe('Pool Constants', () => {
  describe('POOL_CONSTRAINTS', () => {
    it('should have correct default values', () => {
      expect(POOL_CONSTRAINTS.MIN_RESERVE_RATIO).toBe(15);
      expect(POOL_CONSTRAINTS.MAX_SINGLE_ADVANCE_RATIO).toBe(10);
      expect(POOL_CONSTRAINTS.MIN_ADVANCE_AMOUNT).toBe(5000);
      expect(POOL_CONSTRAINTS.MAX_ADVANCE_AMOUNT).toBe(500000);
      expect(POOL_CONSTRAINTS.DEFAULT_CURRENCY).toBe('MXN');
    });
  });

  describe('RISK_TIER_ADVANCE_PERCENTAGES', () => {
    it('should have correct advance percentages', () => {
      expect(RISK_TIER_ADVANCE_PERCENTAGES[RiskTier.A]).toBe(85);
      expect(RISK_TIER_ADVANCE_PERCENTAGES[RiskTier.B]).toBe(75);
      expect(RISK_TIER_ADVANCE_PERCENTAGES[RiskTier.C]).toBe(70);
    });

    it('should have higher percentage for lower risk', () => {
      expect(RISK_TIER_ADVANCE_PERCENTAGES[RiskTier.A]).toBeGreaterThan(
        RISK_TIER_ADVANCE_PERCENTAGES[RiskTier.B],
      );
      expect(RISK_TIER_ADVANCE_PERCENTAGES[RiskTier.B]).toBeGreaterThan(
        RISK_TIER_ADVANCE_PERCENTAGES[RiskTier.C],
      );
    });
  });

  describe('RISK_TIER_FEES', () => {
    it('should have lower fees for lower risk', () => {
      expect(RISK_TIER_FEES[RiskTier.A].farmerFee).toBeLessThan(
        RISK_TIER_FEES[RiskTier.B].farmerFee,
      );
      expect(RISK_TIER_FEES[RiskTier.B].farmerFee).toBeLessThan(
        RISK_TIER_FEES[RiskTier.C].farmerFee,
      );
    });

    it('should have buyer fee proportional to farmer fee', () => {
      expect(RISK_TIER_FEES[RiskTier.A].buyerFee).toBe(RISK_TIER_FEES[RiskTier.A].farmerFee / 2);
      expect(RISK_TIER_FEES[RiskTier.B].buyerFee).toBe(RISK_TIER_FEES[RiskTier.B].farmerFee / 2);
      expect(RISK_TIER_FEES[RiskTier.C].buyerFee).toBe(RISK_TIER_FEES[RiskTier.C].farmerFee / 2);
    });
  });

  describe('PERFORMANCE_THRESHOLDS', () => {
    it('should have correct threshold values', () => {
      expect(PERFORMANCE_THRESHOLDS.HEALTHY_DEFAULT_RATE).toBe(0.02);
      expect(PERFORMANCE_THRESHOLDS.WARNING_DEFAULT_RATE).toBe(0.05);
      expect(PERFORMANCE_THRESHOLDS.CRITICAL_DEFAULT_RATE).toBe(0.10);
      expect(PERFORMANCE_THRESHOLDS.MIN_UTILIZATION).toBe(0.50);
      expect(PERFORMANCE_THRESHOLDS.TARGET_UTILIZATION).toBe(0.75);
      expect(PERFORMANCE_THRESHOLDS.MAX_UTILIZATION).toBe(0.85);
    });

    it('should have thresholds in correct order', () => {
      expect(PERFORMANCE_THRESHOLDS.HEALTHY_DEFAULT_RATE).toBeLessThan(
        PERFORMANCE_THRESHOLDS.WARNING_DEFAULT_RATE,
      );
      expect(PERFORMANCE_THRESHOLDS.WARNING_DEFAULT_RATE).toBeLessThan(
        PERFORMANCE_THRESHOLDS.CRITICAL_DEFAULT_RATE,
      );
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// EDGE CASES AND ERROR HANDLING
// ════════════════════════════════════════════════════════════════════════════════

describe('Edge Cases', () => {
  let service: LiquidityPoolService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LiquidityPoolService(mockPrisma, mockRedis);
  });

  describe('Boundary Conditions', () => {
    it('should handle exact minimum advance amount', async () => {
      const mockPool = createMockPool({
        minAdvanceAmount: new Prisma.Decimal(5000),
        totalCapital: new Prisma.Decimal(1000000),
        availableCapital: new Prisma.Decimal(500000),
      });

      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);

      const result = await service.checkAdvanceEligibility('pool_test123', 5000, RiskTier.A);

      expect(result.isEligible).toBe(true);
    });

    it('should handle exact maximum advance amount', async () => {
      const mockPool = createMockPool({
        maxAdvanceAmount: new Prisma.Decimal(100000),
        totalCapital: new Prisma.Decimal(2000000),
        availableCapital: new Prisma.Decimal(500000),
      });

      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);

      // Max single advance = 2000000 * 0.10 = 200000, so 100000 is within limits
      const result = await service.checkAdvanceEligibility('pool_test123', 100000, RiskTier.A);

      expect(result.isEligible).toBe(true);
    });

    it('should handle exact reserve ratio boundary', async () => {
      // Pool with exactly 15% available (at the reserve limit)
      const mockPool = createMockPool({
        totalCapital: new Prisma.Decimal(100000),
        availableCapital: new Prisma.Decimal(15000), // Exactly 15%
        minReserveRatio: new Prisma.Decimal(15),
      });

      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);

      // Effective available = 15000 - 15000 = 0
      const result = await service.checkAdvanceEligibility('pool_test123', 5000, RiskTier.A);

      expect(result.isEligible).toBe(false);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle balance change during allocation', async () => {
      const mockPool = createMockPool();
      const request = createMockAllocationRequest({ preferredPoolId: mockPool.id });

      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);

      // Simulate balance changed between check and lock
      (mockPrisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => {
        const tx = {
          liquidityPool: {
            findUnique: vi.fn().mockResolvedValue({
              ...mockPool,
              availableCapital: new Prisma.Decimal(10000), // Much less than before
            }),
          },
        };
        return fn(tx);
      });

      const result = await service.allocateCapital(request);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(AllocationErrorCode.CONCURRENT_ALLOCATION);
    });
  });

  describe('Decimal Precision', () => {
    it('should handle precise fee calculations', () => {
      const fees = getFeesForTier(RiskTier.A);
      const amount = 33333.33;

      const farmerFee = amount * (fees.farmerFee / 100);
      const buyerFee = amount * (fees.buyerFee / 100);

      // Should be precise to at least 2 decimal places
      expect(farmerFee).toBeCloseTo(666.67, 2);
      expect(buyerFee).toBeCloseTo(333.33, 2);
    });

    it('should handle very small amounts', () => {
      const result = calculateEffectiveAvailable(5001, 100000, 15);
      // Required: 15000, Available: 5001, Effective: 0 (not negative)
      expect(result).toBe(0);
    });

    it('should handle very large amounts', () => {
      const largeAmount = 999999999;
      const result = calculateUtilizationRate(largeAmount, largeAmount);
      expect(result).toBe(100);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// INTEGRATION PATTERN TESTS (Service Behavior)
// ════════════════════════════════════════════════════════════════════════════════

describe('Service Integration Patterns', () => {
  let service: LiquidityPoolService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LiquidityPoolService(mockPrisma, mockRedis);
  });

  describe('Full Advance Lifecycle', () => {
    it('should complete allocation -> release cycle', async () => {
      const mockPool = createMockPool();

      // Step 1: Allocate
      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);
      (mockPrisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => {
        const tx = {
          liquidityPool: {
            findUnique: vi.fn().mockResolvedValue(mockPool),
            update: vi.fn().mockResolvedValue({
              ...mockPool,
              availableCapital: new Prisma.Decimal(550000),
              deployedCapital: new Prisma.Decimal(450000),
            }),
          },
          poolTransaction: {
            create: vi.fn().mockResolvedValue(createMockTransaction()),
          },
        };
        return fn(tx);
      });

      const allocationRequest = createMockAllocationRequest({ preferredPoolId: mockPool.id });
      const allocationResult = await service.allocateCapital(allocationRequest);
      expect(allocationResult.success).toBe(true);

      // Step 2: Release
      (mockPrisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => {
        const tx = {
          liquidityPool: {
            findUnique: vi.fn().mockResolvedValue({
              ...mockPool,
              availableCapital: new Prisma.Decimal(550000),
              deployedCapital: new Prisma.Decimal(450000),
            }),
            update: vi.fn().mockResolvedValue({
              ...mockPool,
              availableCapital: new Prisma.Decimal(601500), // +50000 + 1500 fees
              deployedCapital: new Prisma.Decimal(400000),
            }),
          },
          poolTransaction: {
            create: vi.fn().mockResolvedValue(createMockTransaction()),
          },
        };
        return fn(tx);
      });

      const releaseRequest = createMockReleaseRequest();
      const releaseResult = await service.releaseCapital(releaseRequest);
      expect(releaseResult.success).toBe(true);
    });

    it('should handle allocation -> default cycle', async () => {
      const mockPool = createMockPool();

      // Step 1: Allocate
      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);
      (mockPrisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => {
        const tx = {
          liquidityPool: {
            findUnique: vi.fn().mockResolvedValue(mockPool),
            update: vi.fn().mockResolvedValue(mockPool),
          },
          poolTransaction: {
            create: vi.fn().mockResolvedValue(createMockTransaction()),
          },
        };
        return fn(tx);
      });

      const allocationRequest = createMockAllocationRequest({ preferredPoolId: mockPool.id });
      const allocationResult = await service.allocateCapital(allocationRequest);
      expect(allocationResult.success).toBe(true);

      // Step 2: Default
      const defaultResult = await service.handleDefault('adv_test123', mockPool.id, 50000, 10000);
      expect(defaultResult.success).toBe(true);
      expect(defaultResult.data!.lossRecorded).toBe(40000); // 50000 - 10000 recovery
    });
  });

  describe('Cache Behavior', () => {
    it('should invalidate cache after pool operations', async () => {
      const mockPool = createMockPool();

      (mockPrisma.liquidityPool.update as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);
      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockPool,
        _count: { investors: 0 },
      });

      await service.updatePool({
        poolId: 'pool_test123',
        name: 'Updated',
        updatedBy: 'admin',
      });

      // Cache should be invalidated
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  describe('Service without Redis', () => {
    it('should function correctly without Redis', async () => {
      const serviceNoRedis = new LiquidityPoolService(mockPrisma); // No Redis
      const mockPool = createMockPool();

      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);

      const result = await serviceNoRedis.getPoolBalance('pool_test123');

      expect(result).toBeDefined();
      expect(result!.fromCache).toBe(false);
      // Should not throw errors without Redis
    });
  });
});
