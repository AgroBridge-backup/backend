/**
 * @file Notification Routes E2E Tests
 * @description End-to-end tests for notification API endpoints
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createNotificationsRouter } from '../../../src/presentation/routes/notifications.routes.js';

// Mock dependencies
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    deviceToken: {
      upsert: vi.fn().mockResolvedValue({ id: 'device-123', token: 'test-token' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    notificationPreference: {
      findUnique: vi.fn().mockResolvedValue({
        userId: 'user-123',
        pushEnabled: true,
        emailEnabled: true,
        smsEnabled: false,
      }),
      create: vi.fn().mockResolvedValue({
        userId: 'user-123',
        pushEnabled: true,
        emailEnabled: true,
        smsEnabled: false,
      }),
      upsert: vi.fn().mockResolvedValue({
        userId: 'user-123',
        pushEnabled: true,
        emailEnabled: true,
        smsEnabled: true,
      }),
    },
  })),
  Platform: { IOS: 'IOS', ANDROID: 'ANDROID', WEB: 'WEB' },
  NotificationChannel: { PUSH: 'PUSH', EMAIL: 'EMAIL', SMS: 'SMS', WHATSAPP: 'WHATSAPP', IN_APP: 'IN_APP' },
  UserRole: { ADMIN: 'ADMIN', PRODUCER: 'PRODUCER', BUYER: 'BUYER' },
}));

vi.mock('../../../src/infrastructure/notifications/NotificationOrchestrator.js', () => ({
  notificationOrchestrator: {
    getUserNotifications: vi.fn().mockResolvedValue([
      { id: 'notif-1', title: 'Test', body: 'Test body', read: false },
    ]),
    getUnreadCount: vi.fn().mockResolvedValue(5),
    getNotification: vi.fn().mockResolvedValue({
      id: 'notif-1',
      userId: 'user-123',
      title: 'Test',
      body: 'Test body',
    }),
    markAsRead: vi.fn().mockResolvedValue(undefined),
    markAsClicked: vi.fn().mockResolvedValue(undefined),
    markAllAsRead: vi.fn().mockResolvedValue(undefined),
    deleteNotification: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn().mockResolvedValue({
      total: 100,
      read: 80,
      unread: 20,
    }),
    sendNotification: vi.fn().mockResolvedValue({ success: true }),
    sendSystemAnnouncement: vi.fn().mockResolvedValue({ success: true, count: 100 }),
  },
}));

vi.mock('../../../src/infrastructure/notifications/queue/NotificationQueue.js', () => ({
  notificationQueue: {
    getStats: vi.fn().mockResolvedValue({
      waiting: 5,
      active: 2,
      completed: 100,
      failed: 3,
      delayed: 1,
    }),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    clean: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../src/shared/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock auth middleware
vi.mock('../../../src/presentation/middlewares/auth.middleware.js', () => ({
  authenticate: (roles?: string[]) => (req: any, res: any, next: any) => {
    req.user = { id: 'user-123', userId: 'user-123', role: roles?.[0] || 'PRODUCER' };
    next();
  },
  AuthenticatedRequest: {},
}));

// Mock validator middleware
vi.mock('../../../src/presentation/middlewares/validator.middleware.js', () => ({
  validateRequest: () => (req: any, res: any, next: any) => next(),
}));

describe('Notification Routes', () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/notifications', createNotificationsRouter());
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /notifications/devices', () => {
    it('should register a device token', async () => {
      const response = await request(app)
        .post('/notifications/devices')
        .send({
          token: 'fcm-token-123',
          platform: 'ANDROID',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.deviceId).toBeDefined();
    });
  });

  describe('DELETE /notifications/devices/:token', () => {
    it('should unregister a device token', async () => {
      const response = await request(app)
        .delete('/notifications/devices/fcm-token-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /notifications', () => {
    it('should return user notifications', async () => {
      const response = await request(app)
        .get('/notifications')
        .query({ limit: 10, offset: 0 });

      expect(response.status).toBe(200);
      expect(response.body.notifications).toBeDefined();
      expect(response.body.unreadCount).toBe(5);
      expect(response.body.pagination).toBeDefined();
    });

    it('should filter unread notifications', async () => {
      const response = await request(app)
        .get('/notifications')
        .query({ unreadOnly: 'true' });

      expect(response.status).toBe(200);
    });
  });

  describe('GET /notifications/unread-count', () => {
    it('should return unread count', async () => {
      const response = await request(app)
        .get('/notifications/unread-count');

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(5);
    });
  });

  describe('GET /notifications/stats', () => {
    it('should return notification statistics', async () => {
      const response = await request(app)
        .get('/notifications/stats');

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(100);
    });
  });

  describe('GET /notifications/preferences', () => {
    it('should return user preferences', async () => {
      const response = await request(app)
        .get('/notifications/preferences');

      expect(response.status).toBe(200);
      expect(response.body.pushEnabled).toBeDefined();
    });
  });

  describe('PUT /notifications/preferences', () => {
    it('should update user preferences', async () => {
      const response = await request(app)
        .put('/notifications/preferences')
        .send({
          pushEnabled: true,
          emailEnabled: true,
          smsEnabled: true,
        });

      expect(response.status).toBe(200);
    });
  });

  describe('GET /notifications/:id', () => {
    it('should return notification by ID', async () => {
      const response = await request(app)
        .get('/notifications/notif-1');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('notif-1');
    });
  });

  describe('PUT /notifications/:id/read', () => {
    it('should mark notification as read', async () => {
      const response = await request(app)
        .put('/notifications/notif-1/read');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('PUT /notifications/:id/clicked', () => {
    it('should mark notification as clicked', async () => {
      const response = await request(app)
        .put('/notifications/notif-1/clicked');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('PUT /notifications/read-all', () => {
    it('should mark all notifications as read', async () => {
      const response = await request(app)
        .put('/notifications/read-all');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /notifications/:id', () => {
    it('should delete notification', async () => {
      const response = await request(app)
        .delete('/notifications/notif-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
