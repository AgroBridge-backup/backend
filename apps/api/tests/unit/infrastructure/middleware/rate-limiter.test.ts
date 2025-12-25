/**
 * Rate Limiter Middleware Tests
 *
 * Tests for Redis + in-memory fallback rate limiting
 * Note: These tests focus on the utility functions and configuration,
 * not the actual rate limiting behavior (which is tested by express-rate-limit)
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { Request } from 'express';

// Mock Redis client BEFORE any imports that use it
vi.mock('../../../../src/infrastructure/cache/RedisClient.js', () => {
  const mockClient = {
    call: vi.fn().mockResolvedValue('OK'),
    ping: vi.fn().mockResolvedValue('PONG'),
  };

  return {
    redisClient: {
      client: mockClient,
      isAvailable: vi.fn(() => false), // Default to unavailable for safe testing
    },
  };
});

// Mock logger to prevent console output during tests
vi.mock('../../../../src/shared/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Rate Limiter Middleware', () => {
  describe('authenticatedKeyGenerator', () => {
    it('should use userId from req.user when available', async () => {
      const { __testing__ } = await import('../../../../src/infrastructure/http/middleware/rate-limiter.middleware.js');

      const req = {
        user: { userId: 'user-123', id: 'user-456' },
        ip: '192.168.1.1',
      } as unknown as Request;

      const key = __testing__.authenticatedKeyGenerator(req);
      expect(key).toBe('user-123');
    });

    it('should use id from req.user when userId is unavailable', async () => {
      const { __testing__ } = await import('../../../../src/infrastructure/http/middleware/rate-limiter.middleware.js');

      const req = {
        user: { id: 'user-456' },
        ip: '192.168.1.1',
      } as unknown as Request;

      const key = __testing__.authenticatedKeyGenerator(req);
      expect(key).toBe('user-456');
    });

    it('should fallback to IP when user is not authenticated', async () => {
      const { __testing__ } = await import('../../../../src/infrastructure/http/middleware/rate-limiter.middleware.js');

      const req = {
        ip: '192.168.1.1',
      } as unknown as Request;

      const key = __testing__.authenticatedKeyGenerator(req);
      expect(key).toBe('192.168.1.1');
    });

    it('should return "unknown" when both user and IP are unavailable', async () => {
      const { __testing__ } = await import('../../../../src/infrastructure/http/middleware/rate-limiter.middleware.js');

      const req = {} as unknown as Request;

      const key = __testing__.authenticatedKeyGenerator(req);
      expect(key).toBe('unknown');
    });
  });

  describe('createRedisStore (mocked as unavailable)', () => {
    it('should return undefined when Redis is unavailable', async () => {
      const { __testing__ } = await import('../../../../src/infrastructure/http/middleware/rate-limiter.middleware.js');

      // With isAvailable returning false, should return undefined
      const store = __testing__.createRedisStore('test-unavailable');
      expect(store).toBeUndefined();
    });

    it('should set store type to in-memory when Redis unavailable', async () => {
      const { __testing__ } = await import('../../../../src/infrastructure/http/middleware/rate-limiter.middleware.js');

      __testing__.createRedisStore('test-inmemory');
      expect(__testing__.storeTypes.get('test-inmemory')).toBe('in-memory');
    });
  });

  describe('getStoreType', () => {
    it('should return the correct store type for a prefix', async () => {
      const { __testing__, getStoreType } = await import('../../../../src/infrastructure/http/middleware/rate-limiter.middleware.js');

      __testing__.storeTypes.set('custom-test', 'redis');
      expect(getStoreType('custom-test')).toBe('redis');

      __testing__.storeTypes.set('custom-test2', 'in-memory');
      expect(getStoreType('custom-test2')).toBe('in-memory');
    });

    it('should return undefined for unknown prefix', async () => {
      const { getStoreType } = await import('../../../../src/infrastructure/http/middleware/rate-limiter.middleware.js');

      expect(getStoreType('completely-unknown-prefix-xyz')).toBeUndefined();
    });
  });

  describe('Health Monitor', () => {
    it('should not create duplicate monitors for the same store', async () => {
      const { __testing__ } = await import('../../../../src/infrastructure/http/middleware/rate-limiter.middleware.js');

      // Get initial size after module loaded
      const prefix = 'unique-monitor-test-' + Date.now();
      const initialHas = __testing__.activeHealthMonitors.has(prefix);
      expect(initialHas).toBe(false);

      __testing__.startHealthMonitor(prefix);
      expect(__testing__.activeHealthMonitors.has(prefix)).toBe(true);

      const sizeAfterFirst = __testing__.activeHealthMonitors.size;

      // Call again - should not add duplicate
      __testing__.startHealthMonitor(prefix);
      __testing__.startHealthMonitor(prefix);

      expect(__testing__.activeHealthMonitors.size).toBe(sizeAfterFirst);
    });
  });

  describe('RateLimiterConfig exports', () => {
    it('should have all rate limiter factory methods', async () => {
      const { RateLimiterConfig } = await import('../../../../src/infrastructure/http/middleware/rate-limiter.middleware.js');

      // Just verify the methods exist (don't call them to avoid side effects)
      expect(typeof RateLimiterConfig.auth).toBe('function');
      expect(typeof RateLimiterConfig.api).toBe('function');
      expect(typeof RateLimiterConfig.creation).toBe('function');
      expect(typeof RateLimiterConfig.passwordReset).toBe('function');
      expect(typeof RateLimiterConfig.registration).toBe('function');
      expect(typeof RateLimiterConfig.tokenRefresh).toBe('function');
      expect(typeof RateLimiterConfig.sensitive).toBe('function');
      expect(typeof RateLimiterConfig.twoFactor).toBe('function');
      expect(typeof RateLimiterConfig.oauth).toBe('function');
      expect(typeof RateLimiterConfig.publicApi).toBe('function');
      expect(typeof RateLimiterConfig.authenticated).toBe('function');
      expect(typeof RateLimiterConfig.certGen).toBe('function');
      expect(typeof RateLimiterConfig.admin).toBe('function');
    });
  });

  describe('Convenience exports', () => {
    it('should export pre-configured rate limiters as functions', async () => {
      const {
        publicApiLimiter,
        authenticatedApiLimiter,
        adminApiLimiter,
        certGenLimiter
      } = await import('../../../../src/infrastructure/http/middleware/rate-limiter.middleware.js');

      // These are middleware functions
      expect(typeof publicApiLimiter).toBe('function');
      expect(typeof authenticatedApiLimiter).toBe('function');
      expect(typeof adminApiLimiter).toBe('function');
      expect(typeof certGenLimiter).toBe('function');
    });
  });
});
