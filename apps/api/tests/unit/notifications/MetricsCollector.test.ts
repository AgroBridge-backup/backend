/**
 * @file MetricsCollector Unit Tests
 * @description Tests for notification metrics collection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Prisma
const mockPrisma = {
  notification: {
    count: vi.fn(),
    findMany: vi.fn(),
    groupBy: vi.fn(),
  },
  notificationDeliveryLog: {
    count: vi.fn(),
    findMany: vi.fn(),
    aggregate: vi.fn(),
  },
};

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrisma),
}));

// Mock NotificationQueue
vi.mock('../../../src/infrastructure/notifications/queue/NotificationQueue.js', () => ({
  notificationQueue: {
    getStats: vi.fn().mockResolvedValue({
      waiting: 5,
      active: 2,
      completed: 100,
      failed: 3,
      delayed: 1,
    }),
  },
}));

// Mock logger
vi.mock('../../../src/shared/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('MetricsCollector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations
    mockPrisma.notification.count.mockResolvedValue(0);
    mockPrisma.notification.findMany.mockResolvedValue([]);
    mockPrisma.notification.groupBy.mockResolvedValue([]);
    mockPrisma.notificationDeliveryLog.count.mockResolvedValue(0);
    mockPrisma.notificationDeliveryLog.findMany.mockResolvedValue([]);
    mockPrisma.notificationDeliveryLog.aggregate.mockResolvedValue({ _avg: { latencyMs: null } });
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('collectMetrics', () => {
    it('should collect metrics for the specified period', async () => {
      mockPrisma.notification.count
        .mockResolvedValueOnce(100) // SENT
        .mockResolvedValueOnce(95) // DELIVERED
        .mockResolvedValueOnce(5); // FAILED

      mockPrisma.notification.findMany.mockResolvedValue([
        { createdAt: new Date('2024-01-01T10:00:00Z'), deliveredAt: new Date('2024-01-01T10:00:01Z') },
        { createdAt: new Date('2024-01-01T10:00:00Z'), deliveredAt: new Date('2024-01-01T10:00:02Z') },
      ]);

      const { MetricsCollector } = await import(
        '../../../src/infrastructure/notifications/monitoring/MetricsCollector.js'
      );
      const collector = MetricsCollector.getInstance();

      const metrics = await collector.collectMetrics(1);

      expect(metrics.totalSent).toBe(100);
      expect(metrics.totalDelivered).toBe(95);
      expect(metrics.totalFailed).toBe(5);
      expect(metrics.deliveryRate).toBe(95);
      expect(metrics.period).toBe('1h');
    });

    it('should return empty metrics on error', async () => {
      mockPrisma.notification.count.mockRejectedValue(new Error('Database error'));

      const { MetricsCollector } = await import(
        '../../../src/infrastructure/notifications/monitoring/MetricsCollector.js'
      );
      const collector = MetricsCollector.getInstance();

      const metrics = await collector.collectMetrics(1);

      expect(metrics.totalSent).toBe(0);
      expect(metrics.totalDelivered).toBe(0);
      expect(metrics.deliveryRate).toBe(0);
    });

    it('should calculate 100% delivery rate when no notifications processed', async () => {
      mockPrisma.notification.count.mockResolvedValue(0);

      const { MetricsCollector } = await import(
        '../../../src/infrastructure/notifications/monitoring/MetricsCollector.js'
      );
      const collector = MetricsCollector.getInstance();

      const metrics = await collector.collectMetrics(1);

      expect(metrics.deliveryRate).toBe(100);
    });
  });

  describe('getDeliveryRate24h', () => {
    it('should calculate 24h delivery rate', async () => {
      mockPrisma.notification.count
        .mockResolvedValueOnce(90) // DELIVERED
        .mockResolvedValueOnce(10); // FAILED

      const { MetricsCollector } = await import(
        '../../../src/infrastructure/notifications/monitoring/MetricsCollector.js'
      );
      const collector = MetricsCollector.getInstance();

      const rate = await collector.getDeliveryRate24h();

      expect(rate).toBe(90);
    });

    it('should return 100% when no notifications', async () => {
      mockPrisma.notification.count.mockResolvedValue(0);

      const { MetricsCollector } = await import(
        '../../../src/infrastructure/notifications/monitoring/MetricsCollector.js'
      );
      const collector = MetricsCollector.getInstance();

      const rate = await collector.getDeliveryRate24h();

      expect(rate).toBe(100);
    });
  });

  describe('checkHealth', () => {
    it('should return healthy status when metrics are good', async () => {
      mockPrisma.notification.count
        .mockResolvedValueOnce(98) // DELIVERED
        .mockResolvedValueOnce(2); // FAILED

      const { MetricsCollector } = await import(
        '../../../src/infrastructure/notifications/monitoring/MetricsCollector.js'
      );
      const collector = MetricsCollector.getInstance();

      const health = await collector.checkHealth();

      expect(health.healthy).toBe(true);
      expect(health.deliveryRate).toBeGreaterThan(95);
    });

    it('should return unhealthy when delivery rate is low', async () => {
      mockPrisma.notification.count
        .mockResolvedValueOnce(80) // DELIVERED
        .mockResolvedValueOnce(20); // FAILED

      const { MetricsCollector } = await import(
        '../../../src/infrastructure/notifications/monitoring/MetricsCollector.js'
      );
      const collector = MetricsCollector.getInstance();

      const health = await collector.checkHealth();

      expect(health.healthy).toBe(false);
    });

    it('should return unhealthy on error', async () => {
      mockPrisma.notification.count.mockRejectedValue(new Error('Database error'));

      const { MetricsCollector } = await import(
        '../../../src/infrastructure/notifications/monitoring/MetricsCollector.js'
      );
      const collector = MetricsCollector.getInstance();

      const health = await collector.checkHealth();

      expect(health.healthy).toBe(false);
    });
  });

  describe('getTopNotificationTypes', () => {
    it('should return top notification types by volume', async () => {
      mockPrisma.notification.groupBy.mockResolvedValue([
        { type: 'BATCH_CREATED', _count: { type: 50 } },
        { type: 'SENSOR_ALERT', _count: { type: 30 } },
        { type: 'ORDER_STATUS', _count: { type: 20 } },
      ]);

      const { MetricsCollector } = await import(
        '../../../src/infrastructure/notifications/monitoring/MetricsCollector.js'
      );
      const collector = MetricsCollector.getInstance();

      const types = await collector.getTopNotificationTypes(new Date(), 10);

      expect(types).toHaveLength(3);
      expect(types[0].type).toBe('BATCH_CREATED');
      expect(types[0].count).toBe(50);
    });
  });
});
