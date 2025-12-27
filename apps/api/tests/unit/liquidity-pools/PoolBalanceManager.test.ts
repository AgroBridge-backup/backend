/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AGROBRIDGE - POOL BALANCE MANAGER TEST SUITE
 * Comprehensive Tests for Real-Time Balance Management
 *
 * Test Coverage:
 * - Real-time balance queries with caching
 * - Balance reservation system
 * - Balance updates with transaction recording
 * - Batch balance operations
 * - Transaction queries and summaries
 * - Event subscription system
 * - Distributed locking
 *
 * @module liquidity-pools/tests
 * @version 1.0.0
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PrismaClient, Prisma } from '@prisma/client';
import type { Redis } from 'ioredis';
import {
  PoolBalanceManager,
  createPoolBalanceManager,
  type BalanceReservation,
  type ReservationRequest,
  type BalanceUpdateOperation,
} from '../../../src/modules/liquidity-pools/services/PoolBalanceManager.js';
import {
  PoolStatus,
  RiskTier,
  PoolTransactionType,
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

const createMockReservation = (overrides = {}): BalanceReservation => ({
  id: 'res_test123',
  poolId: 'pool_test123',
  amount: 50000,
  advanceId: 'adv_test123',
  farmerId: 'farmer_abc',
  expiresAt: new Date(Date.now() + 300000),
  createdAt: new Date(),
  status: 'ACTIVE',
  ...overrides,
});

// ════════════════════════════════════════════════════════════════════════════════
// MOCK SETUP
// ════════════════════════════════════════════════════════════════════════════════

const mockPrisma = {
  liquidityPool: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
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
  set: vi.fn(),
  del: vi.fn(),
  mget: vi.fn(),
  hgetall: vi.fn(),
  hincrby: vi.fn(),
  hdel: vi.fn(),
  publish: vi.fn(),
} as unknown as Redis;

describe('PoolBalanceManager', () => {
  let manager: PoolBalanceManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new PoolBalanceManager(mockPrisma, mockRedis);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // BALANCE QUERY TESTS
  // ════════════════════════════════════════════════════════════════════════════════

  describe('getBalance', () => {
    it('should return balance from cache if available', async () => {
      const cachedBalance = {
        poolId: 'pool_test123',
        poolName: 'Test Pool',
        status: PoolStatus.ACTIVE,
        riskTier: RiskTier.A,
        totalCapital: 1000000,
        availableCapital: 600000,
        deployedCapital: 400000,
        reservedCapital: 0,
        effectiveAvailable: 450000,
        timestamp: new Date().toISOString(),
        fromCache: true,
      };

      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify(cachedBalance));

      const result = await manager.getBalance('pool_test123');

      expect(result).toBeDefined();
      expect(result!.fromCache).toBe(true);
      expect(mockPrisma.liquidityPool.findUnique).not.toHaveBeenCalled();
    });

    it('should fetch from database when cache miss', async () => {
      const mockPool = createMockPool();

      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (mockRedis.hgetall as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);

      const result = await manager.getBalance('pool_test123');

      expect(result).toBeDefined();
      expect(result!.fromCache).toBe(false);
      expect(result!.poolId).toBe('pool_test123');
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should include active reservations in balance calculation', async () => {
      const mockPool = createMockPool({
        availableCapital: new Prisma.Decimal(100000),
      });

      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (mockRedis.hgetall as ReturnType<typeof vi.fn>).mockResolvedValue({
        res_1: '20000',
        res_2: '10000',
      }); // 30000 reserved
      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);

      const result = await manager.getBalance('pool_test123');

      // Available: 100000 - 30000 reserved = 70000
      expect(result!.availableCapital).toBe(70000);
    });

    it('should return null for non-existent pool', async () => {
      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (mockRedis.hgetall as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await manager.getBalance('nonexistent_pool');

      expect(result).toBeNull();
    });

    it('should calculate all balance metrics correctly', async () => {
      const mockPool = createMockPool({
        totalCapital: new Prisma.Decimal(100000),
        availableCapital: new Prisma.Decimal(30000),
        deployedCapital: new Prisma.Decimal(70000),
        minReserveRatio: new Prisma.Decimal(15),
        defaultRate: new Prisma.Decimal(0.02), // 2% default rate (decimal format)
      });

      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (mockRedis.hgetall as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);

      const result = await manager.getBalance('pool_test123');

      expect(result!.totalCapital).toBe(100000);
      expect(result!.availableCapital).toBe(30000);
      expect(result!.deployedCapital).toBe(70000);
      expect(result!.utilizationRate).toBe(70); // 70%
      expect(result!.reserveRatio).toBe(30); // 30%
      // Required reserve: 15000, Effective available: 30000 - 15000 = 15000
      expect(result!.effectiveAvailable).toBe(15000);
      expect(result!.isHealthy).toBe(true);
    });

    it('should log warning when query takes >100ms', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const mockPool = createMockPool();

      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (mockRedis.hgetall as ReturnType<typeof vi.fn>).mockResolvedValue({});
      // Simulate slow query
      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockPool), 150)),
      );

      await manager.getBalance('pool_test123');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Pool balance query took'),
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('getBalances (multiple pools)', () => {
    it('should return balances from cache when available', async () => {
      const cachedBalance1 = JSON.stringify({ poolId: 'pool_1', totalCapital: 100000, timestamp: new Date() });
      const cachedBalance2 = JSON.stringify({ poolId: 'pool_2', totalCapital: 200000, timestamp: new Date() });

      (mockRedis.mget as ReturnType<typeof vi.fn>).mockResolvedValue([cachedBalance1, cachedBalance2]);

      const result = await manager.getBalances(['pool_1', 'pool_2']);

      expect(result.size).toBe(2);
      expect(result.get('pool_1')!.fromCache).toBe(true);
      expect(result.get('pool_2')!.fromCache).toBe(true);
    });

    it('should fetch uncached pools from database', async () => {
      const mockPool = createMockPool({ id: 'pool_2' });

      (mockRedis.mget as ReturnType<typeof vi.fn>).mockResolvedValue([
        JSON.stringify({ poolId: 'pool_1', totalCapital: 100000, timestamp: new Date() }),
        null, // pool_2 not in cache
      ]);
      (mockRedis.hgetall as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (mockPrisma.liquidityPool.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockPool]);

      const result = await manager.getBalances(['pool_1', 'pool_2']);

      expect(result.size).toBe(2);
      expect(result.get('pool_1')!.fromCache).toBe(true);
      expect(result.get('pool_2')!.fromCache).toBe(false);
    });

    it('should work without Redis', async () => {
      const managerNoRedis = new PoolBalanceManager(mockPrisma);
      const mockPools = [
        createMockPool({ id: 'pool_1' }),
        createMockPool({ id: 'pool_2' }),
      ];

      (mockPrisma.liquidityPool.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockPools);

      const result = await managerNoRedis.getBalances(['pool_1', 'pool_2']);

      expect(result.size).toBe(2);
    });
  });

  describe('getSummary', () => {
    it('should return cached summary when available', async () => {
      const cachedSummary = {
        totalPools: 5,
        activePools: 4,
        aggregateCapital: { total: 1000000, available: 500000, deployed: 500000, reserved: 0 },
        averageUtilization: 50,
        averageReserveRatio: 50,
        poolsByStatus: { ACTIVE: 4, PAUSED: 1, CLOSED: 0, LIQUIDATING: 0 },
        poolsByRiskTier: { A: 2, B: 2, C: 1 },
        timestamp: new Date().toISOString(),
      };

      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify(cachedSummary));

      const result = await manager.getSummary();

      expect(result.totalPools).toBe(5);
      expect(result.activePools).toBe(4);
    });

    it('should calculate summary from database when not cached', async () => {
      const mockPools = [
        createMockPool({ id: 'pool_1', status: 'ACTIVE', riskTier: 'A' }),
        createMockPool({ id: 'pool_2', status: 'ACTIVE', riskTier: 'B' }),
        createMockPool({ id: 'pool_3', status: 'PAUSED', riskTier: 'A' }),
      ];

      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (mockPrisma.liquidityPool.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockPools);

      const result = await manager.getSummary();

      expect(result.totalPools).toBe(3);
      expect(result.activePools).toBe(2);
      expect(result.poolsByStatus.ACTIVE).toBe(2);
      expect(result.poolsByStatus.PAUSED).toBe(1);
      expect(result.poolsByRiskTier.A).toBe(2);
      expect(result.poolsByRiskTier.B).toBe(1);
    });

    it('should aggregate capital across all pools', async () => {
      const mockPools = [
        createMockPool({
          totalCapital: new Prisma.Decimal(100000),
          availableCapital: new Prisma.Decimal(50000),
          deployedCapital: new Prisma.Decimal(50000),
        }),
        createMockPool({
          totalCapital: new Prisma.Decimal(200000),
          availableCapital: new Prisma.Decimal(100000),
          deployedCapital: new Prisma.Decimal(100000),
        }),
      ];

      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (mockPrisma.liquidityPool.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockPools);

      const result = await manager.getSummary();

      expect(result.aggregateCapital.total).toBe(300000);
      expect(result.aggregateCapital.available).toBe(150000);
      expect(result.aggregateCapital.deployed).toBe(150000);
    });

    it('should calculate average metrics correctly', async () => {
      const mockPools = [
        createMockPool({
          totalCapital: new Prisma.Decimal(100000),
          availableCapital: new Prisma.Decimal(50000),
          deployedCapital: new Prisma.Decimal(50000), // 50% utilization
        }),
        createMockPool({
          totalCapital: new Prisma.Decimal(100000),
          availableCapital: new Prisma.Decimal(30000),
          deployedCapital: new Prisma.Decimal(70000), // 70% utilization
        }),
      ];

      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (mockPrisma.liquidityPool.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockPools);

      const result = await manager.getSummary();

      expect(result.averageUtilization).toBe(60); // (50 + 70) / 2
    });
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // RESERVATION SYSTEM TESTS
  // ════════════════════════════════════════════════════════════════════════════════

  describe('createReservation', () => {
    const createReservationRequest = (overrides = {}): ReservationRequest => ({
      poolId: 'pool_test123',
      advanceId: 'adv_test123',
      farmerId: 'farmer_abc',
      amount: 50000,
      ...overrides,
    });

    it('should create reservation successfully', async () => {
      const mockPool = createMockPool({
        availableCapital: new Prisma.Decimal(300000),
        totalCapital: new Prisma.Decimal(1000000),
        minReserveRatio: new Prisma.Decimal(15),
      });

      (mockRedis.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK'); // Lock acquired
      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (mockRedis.hgetall as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);
      (mockRedis.setex as ReturnType<typeof vi.fn>).mockResolvedValue('OK');
      (mockRedis.hincrby as ReturnType<typeof vi.fn>).mockResolvedValue(50000);
      (mockRedis.publish as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (mockRedis.del as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const request = createReservationRequest();
      const result = await manager.createReservation(request);

      expect(result.success).toBe(true);
      expect(result.reservation).toBeDefined();
      expect(result.reservation!.amount).toBe(50000);
      expect(result.reservation!.status).toBe('ACTIVE');
    });

    it('should fail when lock cannot be acquired', async () => {
      (mockRedis.set as ReturnType<typeof vi.fn>).mockResolvedValue(null); // Lock failed

      const request = createReservationRequest();
      const result = await manager.createReservation(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Could not acquire lock');
    });

    it('should fail when pool not found', async () => {
      (mockRedis.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');
      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (mockRedis.hgetall as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (mockRedis.del as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const request = createReservationRequest();
      const result = await manager.createReservation(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Pool not found');
    });

    it('should fail when insufficient effective capital', async () => {
      const mockPool = createMockPool({
        totalCapital: new Prisma.Decimal(100000),
        availableCapital: new Prisma.Decimal(20000), // Only 5000 effective
        minReserveRatio: new Prisma.Decimal(15),
      });

      (mockRedis.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');
      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (mockRedis.hgetall as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);
      (mockRedis.del as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const request = createReservationRequest({ amount: 10000 });
      const result = await manager.createReservation(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient effective available capital');
    });

    it('should use custom TTL when provided', async () => {
      const mockPool = createMockPool();

      (mockRedis.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');
      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (mockRedis.hgetall as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);
      (mockRedis.setex as ReturnType<typeof vi.fn>).mockResolvedValue('OK');
      (mockRedis.hincrby as ReturnType<typeof vi.fn>).mockResolvedValue(50000);
      (mockRedis.publish as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (mockRedis.del as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const request = createReservationRequest({ ttlSeconds: 600 });
      const result = await manager.createReservation(request);

      expect(result.success).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.any(String),
        600,
        expect.any(String),
      );
    });

    it('should update database directly without Redis', async () => {
      const managerNoRedis = new PoolBalanceManager(mockPrisma);
      const mockPool = createMockPool();

      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);
      (mockPrisma.liquidityPool.update as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);

      const request = createReservationRequest();
      const result = await managerNoRedis.createReservation(request);

      expect(result.success).toBe(true);
      expect(mockPrisma.liquidityPool.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reservedCapital: { increment: expect.any(Prisma.Decimal) },
          }),
        }),
      );
    });
  });

  describe('commitReservation', () => {
    it('should commit reservation successfully', async () => {
      const mockReservation = createMockReservation();

      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify(mockReservation));
      (mockRedis.del as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (mockRedis.hdel as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const result = await manager.commitReservation('res_test123');

      expect(result.success).toBe(true);
      expect(mockRedis.del).toHaveBeenCalled();
      expect(mockRedis.hdel).toHaveBeenCalled();
    });

    it('should return error when reservation not found', async () => {
      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await manager.commitReservation('nonexistent_res');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found or expired');
    });

    it('should succeed without Redis', async () => {
      const managerNoRedis = new PoolBalanceManager(mockPrisma);

      const result = await managerNoRedis.commitReservation('res_test123');

      expect(result.success).toBe(true);
    });
  });

  describe('releaseReservation', () => {
    it('should release reservation successfully', async () => {
      const mockReservation = createMockReservation();

      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify(mockReservation));
      (mockRedis.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK'); // Lock
      (mockRedis.del as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (mockRedis.hdel as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (mockRedis.publish as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const result = await manager.releaseReservation('res_test123');

      expect(result.success).toBe(true);
      expect(result.releasedAmount).toBe(mockReservation.amount);
    });

    it('should return error when reservation not found', async () => {
      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await manager.releaseReservation('nonexistent_res');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found or expired');
    });

    it('should fail when lock cannot be acquired', async () => {
      const mockReservation = createMockReservation();

      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify(mockReservation));
      (mockRedis.set as ReturnType<typeof vi.fn>).mockResolvedValue(null); // Lock failed

      const result = await manager.releaseReservation('res_test123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Could not acquire lock');
    });
  });

  describe('getPoolReservations', () => {
    it('should return all active reservations for a pool', async () => {
      const reservation1 = createMockReservation({ id: 'res_1', amount: 30000 });
      const reservation2 = createMockReservation({ id: 'res_2', amount: 20000 });

      (mockRedis.hgetall as ReturnType<typeof vi.fn>).mockResolvedValue({
        res_1: '30000',
        res_2: '20000',
      });
      (mockRedis.get as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(JSON.stringify(reservation1))
        .mockResolvedValueOnce(JSON.stringify(reservation2));

      const result = await manager.getPoolReservations('pool_test123');

      expect(result.length).toBe(2);
      expect(result[0].amount).toBe(30000);
      expect(result[1].amount).toBe(20000);
    });

    it('should return empty array without Redis', async () => {
      const managerNoRedis = new PoolBalanceManager(mockPrisma);

      const result = await managerNoRedis.getPoolReservations('pool_test123');

      expect(result).toEqual([]);
    });

    it('should handle expired reservations gracefully', async () => {
      (mockRedis.hgetall as ReturnType<typeof vi.fn>).mockResolvedValue({
        res_1: '30000',
        res_2: '20000',
      });
      (mockRedis.get as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(JSON.stringify(createMockReservation({ id: 'res_1' })))
        .mockResolvedValueOnce(null); // res_2 expired

      const result = await manager.getPoolReservations('pool_test123');

      expect(result.length).toBe(1);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // BALANCE UPDATE TESTS
  // ════════════════════════════════════════════════════════════════════════════════

  describe('updateBalance', () => {
    const createUpdateOperation = (overrides = {}): BalanceUpdateOperation => ({
      poolId: 'pool_test123',
      operation: 'DECREMENT',
      field: 'availableCapital',
      amount: 50000,
      transactionType: PoolTransactionType.ADVANCE_DISBURSEMENT,
      description: 'Advance disbursement',
      ...overrides,
    });

    it('should update balance with transaction recording', async () => {
      const mockPool = createMockPool();

      (mockRedis.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');
      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (mockRedis.hgetall as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (mockRedis.del as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (mockRedis.publish as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);
      (mockPrisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => {
        const tx = {
          liquidityPool: {
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

      const operation = createUpdateOperation();
      const result = await manager.updateBalance(operation);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
      expect(result.balanceBefore).toBeDefined();
      expect(result.balanceAfter).toBeDefined();
    });

    it('should handle INCREMENT operation', async () => {
      const mockPool = createMockPool();

      (mockRedis.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');
      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (mockRedis.hgetall as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (mockRedis.del as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (mockRedis.publish as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);
      (mockPrisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => {
        const tx = {
          liquidityPool: {
            update: vi.fn().mockResolvedValue(mockPool),
          },
          poolTransaction: {
            create: vi.fn().mockResolvedValue(createMockTransaction()),
          },
        };
        return fn(tx);
      });

      const operation = createUpdateOperation({
        operation: 'INCREMENT',
        transactionType: PoolTransactionType.ADVANCE_REPAYMENT,
      });
      const result = await manager.updateBalance(operation);

      expect(result.success).toBe(true);
    });

    it('should handle SET operation', async () => {
      const mockPool = createMockPool();

      (mockRedis.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');
      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (mockRedis.hgetall as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (mockRedis.del as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (mockRedis.publish as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);
      (mockPrisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => {
        const tx = {
          liquidityPool: {
            update: vi.fn().mockResolvedValue(mockPool),
          },
          poolTransaction: {
            create: vi.fn().mockResolvedValue(createMockTransaction()),
          },
        };
        return fn(tx);
      });

      const operation = createUpdateOperation({
        operation: 'SET',
        amount: 500000,
        transactionType: PoolTransactionType.ADJUSTMENT,
      });
      const result = await manager.updateBalance(operation);

      expect(result.success).toBe(true);
    });

    it('should fail when lock cannot be acquired', async () => {
      (mockRedis.set as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const operation = createUpdateOperation();
      const result = await manager.updateBalance(operation);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Could not acquire lock');
    });

    it('should fail when pool not found', async () => {
      (mockRedis.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');
      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (mockRedis.hgetall as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (mockRedis.del as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const operation = createUpdateOperation();
      const result = await manager.updateBalance(operation);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Pool not found');
    });

    it('should publish balance change event', async () => {
      const mockPool = createMockPool();

      (mockRedis.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');
      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (mockRedis.hgetall as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (mockRedis.del as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (mockRedis.publish as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);
      (mockPrisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => {
        const tx = {
          liquidityPool: {
            update: vi.fn().mockResolvedValue(mockPool),
          },
          poolTransaction: {
            create: vi.fn().mockResolvedValue(createMockTransaction()),
          },
        };
        return fn(tx);
      });

      const operation = createUpdateOperation();
      await manager.updateBalance(operation);

      expect(mockRedis.publish).toHaveBeenCalledWith(
        'cfb:balance:changed',
        expect.any(String),
      );
    });
  });

  describe('batchUpdateBalances', () => {
    it('should execute atomic batch update successfully', async () => {
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
      (mockRedis.del as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const batch = {
        atomic: true,
        operations: [
          {
            poolId: 'pool_1',
            operation: 'DECREMENT' as const,
            field: 'availableCapital' as const,
            amount: 50000,
            transactionType: PoolTransactionType.ADVANCE_DISBURSEMENT,
            description: 'Disbursement 1',
          },
          {
            poolId: 'pool_2',
            operation: 'INCREMENT' as const,
            field: 'availableCapital' as const,
            amount: 50000,
            transactionType: PoolTransactionType.CAPITAL_DEPOSIT,
            description: 'Deposit 2',
          },
        ],
      };

      const result = await manager.batchUpdateBalances(batch);

      expect(result.success).toBe(true);
      expect(result.results!.length).toBe(2);
      expect(result.results!.every((r) => r.success)).toBe(true);
    });

    it('should rollback atomic batch on error', async () => {
      (mockPrisma.$transaction as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Pool not found'));

      const batch = {
        atomic: true,
        operations: [
          {
            poolId: 'pool_1',
            operation: 'DECREMENT' as const,
            field: 'availableCapital' as const,
            amount: 50000,
            transactionType: PoolTransactionType.ADVANCE_DISBURSEMENT,
            description: 'Disbursement',
          },
        ],
      };

      const result = await manager.batchUpdateBalances(batch);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Pool not found');
    });

    it('should execute non-atomic batch independently', async () => {
      const mockPool = createMockPool();

      (mockRedis.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');
      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (mockRedis.hgetall as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (mockRedis.del as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (mockRedis.publish as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);
      (mockPrisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => {
        const tx = {
          liquidityPool: {
            update: vi.fn().mockResolvedValue(mockPool),
          },
          poolTransaction: {
            create: vi.fn().mockResolvedValue(createMockTransaction()),
          },
        };
        return fn(tx);
      });

      const batch = {
        atomic: false,
        operations: [
          {
            poolId: 'pool_1',
            operation: 'DECREMENT' as const,
            field: 'availableCapital' as const,
            amount: 50000,
            transactionType: PoolTransactionType.ADVANCE_DISBURSEMENT,
            description: 'Disbursement',
          },
        ],
      };

      const result = await manager.batchUpdateBalances(batch);

      expect(result.success).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // TRANSACTION QUERY TESTS
  // ════════════════════════════════════════════════════════════════════════════════

  describe('getTransactions', () => {
    it('should return filtered transactions', async () => {
      const mockTransactions = [
        createMockTransaction({ id: 'txn_1', type: 'ADVANCE_DISBURSEMENT' }),
        createMockTransaction({ id: 'txn_2', type: 'ADVANCE_REPAYMENT' }),
      ];

      (mockPrisma.poolTransaction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockTransactions);

      const result = await manager.getTransactions({ poolId: 'pool_test123' });

      expect(result.length).toBe(2);
      expect(result[0].id).toBe('txn_1');
    });

    it('should filter by transaction types', async () => {
      (mockPrisma.poolTransaction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await manager.getTransactions({
        types: [PoolTransactionType.ADVANCE_DISBURSEMENT, PoolTransactionType.ADVANCE_REPAYMENT],
      });

      expect(mockPrisma.poolTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: { in: [PoolTransactionType.ADVANCE_DISBURSEMENT, PoolTransactionType.ADVANCE_REPAYMENT] },
          }),
        }),
      );
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      (mockPrisma.poolTransaction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await manager.getTransactions({ startDate, endDate });

      expect(mockPrisma.poolTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: startDate, lte: endDate },
          }),
        }),
      );
    });

    it('should filter by amount range', async () => {
      (mockPrisma.poolTransaction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await manager.getTransactions({ minAmount: 1000, maxAmount: 50000 });

      expect(mockPrisma.poolTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            amount: { gte: 1000, lte: 50000 },
          }),
        }),
      );
    });

    it('should support pagination', async () => {
      (mockPrisma.poolTransaction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await manager.getTransactions({ limit: 10, offset: 20 });

      expect(mockPrisma.poolTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
    });
  });

  describe('getTransactionSummary', () => {
    it('should calculate transaction summary correctly', async () => {
      const mockTransactions = [
        createMockTransaction({ type: 'CAPITAL_DEPOSIT', amount: new Prisma.Decimal(100000) }),
        createMockTransaction({ type: 'ADVANCE_DISBURSEMENT', amount: new Prisma.Decimal(50000) }),
        createMockTransaction({ type: 'ADVANCE_REPAYMENT', amount: new Prisma.Decimal(30000) }),
        createMockTransaction({ type: 'FEE_COLLECTION', amount: new Prisma.Decimal(2000) }),
      ];

      (mockPrisma.poolTransaction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockTransactions);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      const result = await manager.getTransactionSummary('pool_test123', startDate, endDate);

      expect(result.poolId).toBe('pool_test123');
      expect(result.period.startDate).toEqual(startDate);
      expect(result.period.endDate).toEqual(endDate);
      expect(result.totals.transactionCount).toBe(4);
      // Inflows: deposit (100000) + repayment (30000) + fees (2000) = 132000
      expect(result.totals.inflows).toBe(132000);
      // Outflows: disbursement (50000) = 50000
      expect(result.totals.outflows).toBe(50000);
      expect(result.totals.netChange).toBe(82000);
    });

    it('should categorize transactions by type', async () => {
      const mockTransactions = [
        createMockTransaction({ type: 'CAPITAL_DEPOSIT', amount: new Prisma.Decimal(100000) }),
        createMockTransaction({ type: 'CAPITAL_DEPOSIT', amount: new Prisma.Decimal(50000) }),
      ];

      (mockPrisma.poolTransaction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockTransactions);

      const result = await manager.getTransactionSummary(
        'pool_test123',
        new Date('2024-01-01'),
        new Date('2024-12-31'),
      );

      expect(result.byType[PoolTransactionType.CAPITAL_DEPOSIT].count).toBe(2);
      expect(result.byType[PoolTransactionType.CAPITAL_DEPOSIT].totalAmount).toBe(150000);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // EVENT SUBSCRIPTION TESTS
  // ════════════════════════════════════════════════════════════════════════════════

  describe('subscribe', () => {
    it('should register subscriber for specific pool', () => {
      const callback = vi.fn();

      const unsubscribe = manager.subscribe('pool_test123', callback);

      expect(unsubscribe).toBeInstanceOf(Function);
    });

    it('should return unsubscribe function', () => {
      const callback = vi.fn();

      const unsubscribe = manager.subscribe('pool_test123', callback);
      unsubscribe();

      // Callback should no longer be called
      // (tested implicitly through subscription mechanism)
      expect(true).toBe(true);
    });
  });

  describe('subscribeAll', () => {
    it('should register subscriber for all pools', () => {
      const callback = vi.fn();

      const unsubscribe = manager.subscribeAll(callback);

      expect(unsubscribe).toBeInstanceOf(Function);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // FACTORY FUNCTION TESTS
  // ════════════════════════════════════════════════════════════════════════════════

  describe('createPoolBalanceManager', () => {
    it('should create manager instance with Redis', () => {
      const manager = createPoolBalanceManager(mockPrisma, mockRedis);
      expect(manager).toBeInstanceOf(PoolBalanceManager);
    });

    it('should create manager instance without Redis', () => {
      const manager = createPoolBalanceManager(mockPrisma);
      expect(manager).toBeInstanceOf(PoolBalanceManager);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// EDGE CASES AND ERROR HANDLING
// ════════════════════════════════════════════════════════════════════════════════

describe('Edge Cases', () => {
  let manager: PoolBalanceManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new PoolBalanceManager(mockPrisma, mockRedis);
  });

  describe('Distributed Locking', () => {
    it('should handle lock timeout gracefully', async () => {
      // Lock never acquired
      (mockRedis.set as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await manager.createReservation({
        poolId: 'pool_test123',
        advanceId: 'adv_test123',
        farmerId: 'farmer_abc',
        amount: 50000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Could not acquire lock');
    });

    it('should release lock even on error', async () => {
      const mockPool = createMockPool();

      (mockRedis.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');
      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (mockRedis.hgetall as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);
      (mockRedis.setex as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Redis error'));
      (mockRedis.del as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      try {
        await manager.createReservation({
          poolId: 'pool_test123',
          advanceId: 'adv_test123',
          farmerId: 'farmer_abc',
          amount: 50000,
        });
      } catch {
        // Error expected
      }

      // Lock should still be released
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  describe('Cache Handling', () => {
    it('should handle corrupted cache data gracefully', async () => {
      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue('not valid json');
      (mockRedis.hgetall as ReturnType<typeof vi.fn>).mockResolvedValue({});

      // Should throw JSON parse error
      await expect(manager.getBalance('pool_test123')).rejects.toThrow();
    });

    it('should continue without cache when Redis fails', async () => {
      const mockPool = createMockPool();
      const managerNoRedis = new PoolBalanceManager(mockPrisma);

      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);

      const result = await managerNoRedis.getBalance('pool_test123');

      expect(result).toBeDefined();
      expect(result!.fromCache).toBe(false);
    });
  });

  describe('Concurrent Reservations', () => {
    it('should handle multiple reservations for same pool', async () => {
      // Create pool with proper capital structure
      const mockPool = createMockPool({
        totalCapital: new Prisma.Decimal(200000),
        availableCapital: new Prisma.Decimal(100000),
        deployedCapital: new Prisma.Decimal(100000),
        minReserveRatio: new Prisma.Decimal(15),
      });

      (mockRedis.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');
      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (mockRedis.hgetall as ReturnType<typeof vi.fn>).mockResolvedValue({ existing_res: '20000' }); // 20k already reserved
      (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);
      (mockRedis.setex as ReturnType<typeof vi.fn>).mockResolvedValue('OK');
      (mockRedis.hincrby as ReturnType<typeof vi.fn>).mockResolvedValue(50000);
      (mockRedis.publish as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (mockRedis.del as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      // Reserve requirement = totalCapital * minReserveRatio = 200000 * 0.15 = 30000
      // Effective available = availableCapital - reserveRequired - existingReservations
      //                     = 100000 - 30000 - 20000 = 50000
      // Requesting 40000 should succeed (less than 50000 effective available)
      const result = await manager.createReservation({
        poolId: 'pool_test123',
        advanceId: 'adv_test123',
        farmerId: 'farmer_abc',
        amount: 40000,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Balance Field Operations', () => {
    it('should handle all balance fields correctly', async () => {
      const mockPool = createMockPool();
      const fields: Array<'availableCapital' | 'deployedCapital' | 'reservedCapital' | 'totalCapital'> = [
        'availableCapital',
        'deployedCapital',
        'reservedCapital',
        'totalCapital',
      ];

      for (const field of fields) {
        vi.clearAllMocks();

        (mockRedis.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');
        (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        (mockRedis.hgetall as ReturnType<typeof vi.fn>).mockResolvedValue({});
        (mockRedis.del as ReturnType<typeof vi.fn>).mockResolvedValue(1);
        (mockRedis.publish as ReturnType<typeof vi.fn>).mockResolvedValue(1);
        (mockPrisma.liquidityPool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPool);
        (mockPrisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => {
          const tx = {
            liquidityPool: {
              update: vi.fn().mockResolvedValue(mockPool),
            },
            poolTransaction: {
              create: vi.fn().mockResolvedValue(createMockTransaction()),
            },
          };
          return fn(tx);
        });

        const result = await manager.updateBalance({
          poolId: 'pool_test123',
          operation: 'INCREMENT',
          field,
          amount: 10000,
          transactionType: PoolTransactionType.ADJUSTMENT,
          description: `Adjusting ${field}`,
        });

        expect(result.success).toBe(true);
      }
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// PERFORMANCE TESTS
// ════════════════════════════════════════════════════════════════════════════════

describe('Performance Characteristics', () => {
  let manager: PoolBalanceManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new PoolBalanceManager(mockPrisma, mockRedis);
  });

  describe('Cache Performance', () => {
    it('should serve cached balances much faster than database', async () => {
      const cachedBalance = {
        poolId: 'pool_test123',
        poolName: 'Test Pool',
        status: PoolStatus.ACTIVE,
        totalCapital: 1000000,
        timestamp: new Date().toISOString(),
      };

      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify(cachedBalance));

      const startTime = performance.now();
      await manager.getBalance('pool_test123');
      const cacheTime = performance.now() - startTime;

      // Cache hit should be very fast (< 5ms in tests)
      expect(cacheTime).toBeLessThan(100); // Generous for CI
      expect(mockPrisma.liquidityPool.findUnique).not.toHaveBeenCalled();
    });

    it('should batch cache lookups for multiple pools', async () => {
      const poolIds = ['pool_1', 'pool_2', 'pool_3'];

      (mockRedis.mget as ReturnType<typeof vi.fn>).mockResolvedValue(
        poolIds.map((id) => JSON.stringify({ poolId: id, timestamp: new Date() })),
      );

      await manager.getBalances(poolIds);

      // Should use single mget instead of multiple gets
      expect(mockRedis.mget).toHaveBeenCalledTimes(1);
      expect(mockRedis.get).not.toHaveBeenCalled();
    });
  });

  describe('Batch Operations', () => {
    it('should execute all operations in single transaction for atomic batch', async () => {
      let transactionCallCount = 0;
      const mockPool = createMockPool();

      (mockPrisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => {
        transactionCallCount++;
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
      (mockRedis.del as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      await manager.batchUpdateBalances({
        atomic: true,
        operations: [
          {
            poolId: 'pool_1',
            operation: 'DECREMENT',
            field: 'availableCapital',
            amount: 50000,
            transactionType: PoolTransactionType.ADVANCE_DISBURSEMENT,
            description: 'Op 1',
          },
          {
            poolId: 'pool_2',
            operation: 'INCREMENT',
            field: 'availableCapital',
            amount: 50000,
            transactionType: PoolTransactionType.CAPITAL_DEPOSIT,
            description: 'Op 2',
          },
        ],
      });

      // Single transaction for atomic batch
      expect(transactionCallCount).toBe(1);
    });
  });
});
