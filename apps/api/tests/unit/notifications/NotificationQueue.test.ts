/**
 * @file NotificationQueue Unit Tests
 * @description Tests for Bull notification queue
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock bull
const mockQueue = {
  add: vi.fn().mockResolvedValue({ id: 'job-123' }),
  process: vi.fn(),
  getJobCounts: vi.fn().mockResolvedValue({
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
  }),
  // Individual count methods used by Bull 4.x
  getWaitingCount: vi.fn().mockResolvedValue(5),
  getActiveCount: vi.fn().mockResolvedValue(2),
  getCompletedCount: vi.fn().mockResolvedValue(100),
  getFailedCount: vi.fn().mockResolvedValue(3),
  getDelayedCount: vi.fn().mockResolvedValue(1),
  pause: vi.fn().mockResolvedValue(undefined),
  resume: vi.fn().mockResolvedValue(undefined),
  clean: vi.fn().mockResolvedValue([]),
  close: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
};

vi.mock('bull', () => ({
  default: vi.fn(() => mockQueue),
}));

// Mock Prisma
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    deviceToken: {
      updateMany: vi.fn(),
    },
    notification: {
      update: vi.fn(),
    },
    notificationDeliveryLog: {
      create: vi.fn(),
    },
  })),
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

// Mock services
vi.mock('../../../src/infrastructure/notifications/services/FCMService.js', () => ({
  fcmService: {
    sendToDevice: vi.fn().mockResolvedValue({ success: true }),
    isAvailable: vi.fn().mockReturnValue(true),
  },
}));

vi.mock('../../../src/infrastructure/notifications/services/APNsService.js', () => ({
  apnsService: {
    sendToDevice: vi.fn().mockResolvedValue({ success: true }),
    isAvailable: vi.fn().mockReturnValue(true),
  },
}));

vi.mock('../../../src/infrastructure/notifications/services/EmailService.js', () => ({
  emailService: {
    sendEmail: vi.fn().mockResolvedValue({ success: true }),
    isAvailable: vi.fn().mockReturnValue(true),
  },
}));

vi.mock('../../../src/infrastructure/notifications/services/SMSService.js', () => ({
  smsService: {
    sendSMS: vi.fn().mockResolvedValue({ success: true }),
    sendWhatsApp: vi.fn().mockResolvedValue({ success: true }),
    isAvailable: vi.fn().mockReturnValue(true),
  },
}));

describe('NotificationQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('enqueue', () => {
    it('should add job to queue with default priority', async () => {
      const { NotificationQueue } = await import(
        '../../../src/infrastructure/notifications/queue/NotificationQueue.js'
      );
      const queue = NotificationQueue.getInstance();

      await queue.enqueue({
        notificationId: 'notif-123',
        userId: 'user-123',
        channel: 'PUSH',
        title: 'Test',
        body: 'Test body',
        deviceToken: 'token-123',
        platform: 'ANDROID',
      });

      expect(mockQueue.add).toHaveBeenCalled();
    });

    it('should set high priority for CRITICAL notifications', async () => {
      const { NotificationQueue } = await import(
        '../../../src/infrastructure/notifications/queue/NotificationQueue.js'
      );
      const queue = NotificationQueue.getInstance();

      await queue.enqueue({
        notificationId: 'notif-123',
        userId: 'user-123',
        channel: 'PUSH',
        title: 'Test',
        body: 'Test body',
        deviceToken: 'token-123',
        platform: 'ANDROID',
        priority: 'CRITICAL',
      });

      expect(mockQueue.add).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          priority: 1,
        })
      );
    });
  });

  describe('getStats', () => {
    it('should return queue statistics', async () => {
      // Mock individual count methods
      mockQueue.getWaitingCount.mockResolvedValue(10);
      mockQueue.getActiveCount.mockResolvedValue(5);
      mockQueue.getCompletedCount.mockResolvedValue(100);
      mockQueue.getFailedCount.mockResolvedValue(2);
      mockQueue.getDelayedCount.mockResolvedValue(3);

      const { NotificationQueue } = await import(
        '../../../src/infrastructure/notifications/queue/NotificationQueue.js'
      );
      const queue = NotificationQueue.getInstance();

      const stats = await queue.getStats();

      expect(stats.waiting).toBe(10);
      expect(stats.active).toBe(5);
      expect(stats.completed).toBe(100);
      expect(stats.failed).toBe(2);
      expect(stats.delayed).toBe(3);
    });
  });

  describe('pause and resume', () => {
    it('should pause the queue', async () => {
      const { NotificationQueue } = await import(
        '../../../src/infrastructure/notifications/queue/NotificationQueue.js'
      );
      const queue = NotificationQueue.getInstance();
      queue.initialize(); // Ensure queue is initialized

      await queue.pause();

      expect(mockQueue.pause).toHaveBeenCalled();
    });

    it('should resume the queue', async () => {
      const { NotificationQueue } = await import(
        '../../../src/infrastructure/notifications/queue/NotificationQueue.js'
      );
      const queue = NotificationQueue.getInstance();
      queue.initialize(); // Ensure queue is initialized

      await queue.resume();

      expect(mockQueue.resume).toHaveBeenCalled();
    });
  });

  describe('clean', () => {
    it('should clean old jobs', async () => {
      const { NotificationQueue } = await import(
        '../../../src/infrastructure/notifications/queue/NotificationQueue.js'
      );
      const queue = NotificationQueue.getInstance();
      queue.initialize(); // Ensure queue is initialized

      await queue.clean(24);

      expect(mockQueue.clean).toHaveBeenCalled();
    });
  });

  describe('shutdown', () => {
    it('should close the queue gracefully', async () => {
      const { NotificationQueue } = await import(
        '../../../src/infrastructure/notifications/queue/NotificationQueue.js'
      );
      const queue = NotificationQueue.getInstance();
      queue.initialize(); // Ensure queue is initialized

      await queue.shutdown();

      expect(mockQueue.close).toHaveBeenCalled();
    });
  });
});
