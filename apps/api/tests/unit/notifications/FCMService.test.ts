/**
 * @file FCMService Unit Tests
 * @description Tests for Firebase Cloud Messaging service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock firebase-admin before importing FCMService
vi.mock('firebase-admin', () => ({
  default: {
    initializeApp: vi.fn(),
    credential: {
      cert: vi.fn(),
    },
    messaging: vi.fn(() => ({
      send: vi.fn(),
      sendEach: vi.fn(),
      subscribeToTopic: vi.fn(),
    })),
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

describe('FCMService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_PRIVATE_KEY;
    delete process.env.FIREBASE_CLIENT_EMAIL;
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('isAvailable', () => {
    it('should return false when credentials are not configured', async () => {
      const { FCMService } = await import(
        '../../../src/infrastructure/notifications/services/FCMService.js'
      );
      const service = FCMService.getInstance();
      expect(service.isAvailable()).toBe(false);
    });
  });

  describe('sendToDevice', () => {
    it('should return error when service is not initialized', async () => {
      const { FCMService } = await import(
        '../../../src/infrastructure/notifications/services/FCMService.js'
      );
      const service = FCMService.getInstance();

      const result = await service.sendToDevice('test-token', {
        title: 'Test',
        body: 'Test body',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('FCM service not initialized');
    });

    it('should validate token format', async () => {
      const { FCMService } = await import(
        '../../../src/infrastructure/notifications/services/FCMService.js'
      );
      const service = FCMService.getInstance();

      const result = await service.sendToDevice('', {
        title: 'Test',
        body: 'Test body',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('sendToDevices', () => {
    it('should return empty results for empty token array', async () => {
      const { FCMService } = await import(
        '../../../src/infrastructure/notifications/services/FCMService.js'
      );
      const service = FCMService.getInstance();

      const result = await service.sendToDevices([], {
        title: 'Test',
        body: 'Test body',
      });

      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
      expect(result.results).toEqual([]);
    });
  });

  describe('sendToTopic', () => {
    it('should return error when service is not initialized', async () => {
      const { FCMService } = await import(
        '../../../src/infrastructure/notifications/services/FCMService.js'
      );
      const service = FCMService.getInstance();

      const result = await service.sendToTopic('test-topic', {
        title: 'Test',
        body: 'Test body',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('FCM service not initialized');
    });
  });
});
