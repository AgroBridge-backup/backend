/**
 * API Key Service - Unit Tests
 *
 * Tests for API key generation, validation, and lifecycle management.
 * Maintains 97.6%+ coverage target.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient, ApiKeyStatus, ApiKeyScope } from '@prisma/client';
import { ApiKeyService } from '../../../../src/infrastructure/auth/ApiKeyService.js';
import crypto from 'crypto';

// Mock PrismaClient
const mockPrisma = {
  apiKey: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
} as unknown as PrismaClient;

describe('ApiKeyService', () => {
  let service: ApiKeyService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ApiKeyService(mockPrisma);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createKey()', () => {
    it('should generate a secure API key with correct format (ab_test_xxxx)', async () => {
      const mockApiKey = {
        id: 'key-123',
        userId: 'user-1',
        keyPrefix: 'ab_test_xxxx',
        keyHash: 'hashed-value',
        label: 'Test Key',
        description: 'A test key',
        scopes: [ApiKeyScope.READ],
        status: ApiKeyStatus.ACTIVE,
        expiresAt: null,
        lastUsedAt: null,
        usageCount: 0,
        rateLimitRpm: 100,
        allowedIps: [],
        allowedOrigins: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockPrisma.apiKey.create).mockResolvedValue(mockApiKey);

      const result = await service.createKey({
        userId: 'user-1',
        label: 'Test Key',
        description: 'A test key',
      });

      // Key should start with ab_test_ (or ab_live_ in production)
      expect(result.key).toMatch(/^ab_test_[a-zA-Z0-9_-]{32}$/);
      expect(result.id).toBe('key-123');
      expect(result.label).toBe('Test Key');
      expect(mockPrisma.apiKey.create).toHaveBeenCalled();
    });

    it('should never store the original key, only the hash', async () => {
      const mockApiKey = {
        id: 'key-456',
        userId: 'user-1',
        keyPrefix: 'ab_test_xxxx',
        keyHash: expect.any(String),
        label: 'My API Key',
        description: null,
        scopes: [ApiKeyScope.READ],
        status: ApiKeyStatus.ACTIVE,
        expiresAt: null,
        lastUsedAt: null,
        usageCount: 0,
        rateLimitRpm: 100,
        allowedIps: [],
        allowedOrigins: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockPrisma.apiKey.create).mockResolvedValue(mockApiKey);

      const result = await service.createKey({
        userId: 'user-1',
        label: 'My API Key',
      });

      // Verify the create call contains keyHash, not the full key
      const createCall = vi.mocked(mockPrisma.apiKey.create).mock.calls[0][0];
      expect(createCall.data.keyHash).toBeDefined();
      expect(createCall.data.keyHash).toHaveLength(64); // SHA-256 hex = 64 chars
      expect(createCall.data).not.toHaveProperty('key');

      // Result includes the full key for one-time display
      expect(result.key).toMatch(/^ab_test_/);
    });

    it('should apply SHA-256 hashing to the key', async () => {
      const mockApiKey = {
        id: 'key-789',
        userId: 'user-1',
        keyPrefix: 'ab_test_xxxx',
        keyHash: 'test-hash',
        label: 'Hash Test',
        description: null,
        scopes: [ApiKeyScope.READ],
        status: ApiKeyStatus.ACTIVE,
        expiresAt: null,
        lastUsedAt: null,
        usageCount: 0,
        rateLimitRpm: 100,
        allowedIps: [],
        allowedOrigins: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockPrisma.apiKey.create).mockResolvedValue(mockApiKey);

      await service.createKey({
        userId: 'user-1',
        label: 'Hash Test',
      });

      const createCall = vi.mocked(mockPrisma.apiKey.create).mock.calls[0][0];
      const storedHash = createCall.data.keyHash as string;

      // SHA-256 produces 64 hex characters
      expect(storedHash).toHaveLength(64);
      expect(storedHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should set default scopes to READ when not provided', async () => {
      const mockApiKey = {
        id: 'key-default',
        userId: 'user-1',
        keyPrefix: 'ab_test_xxxx',
        keyHash: 'hash',
        label: 'Default Scope Key',
        description: null,
        scopes: [ApiKeyScope.READ],
        status: ApiKeyStatus.ACTIVE,
        expiresAt: null,
        lastUsedAt: null,
        usageCount: 0,
        rateLimitRpm: 100,
        allowedIps: [],
        allowedOrigins: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockPrisma.apiKey.create).mockResolvedValue(mockApiKey);

      await service.createKey({
        userId: 'user-1',
        label: 'Default Scope Key',
      });

      const createCall = vi.mocked(mockPrisma.apiKey.create).mock.calls[0][0];
      expect(createCall.data.scopes).toEqual([ApiKeyScope.READ]);
    });

    it('should respect custom rate limit when provided', async () => {
      const mockApiKey = {
        id: 'key-rate',
        userId: 'user-1',
        keyPrefix: 'ab_test_xxxx',
        keyHash: 'hash',
        label: 'Custom Rate',
        description: null,
        scopes: [ApiKeyScope.READ],
        status: ApiKeyStatus.ACTIVE,
        expiresAt: null,
        lastUsedAt: null,
        usageCount: 0,
        rateLimitRpm: 500,
        allowedIps: [],
        allowedOrigins: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockPrisma.apiKey.create).mockResolvedValue(mockApiKey);

      await service.createKey({
        userId: 'user-1',
        label: 'Custom Rate',
        rateLimitRpm: 500,
      });

      const createCall = vi.mocked(mockPrisma.apiKey.create).mock.calls[0][0];
      expect(createCall.data.rateLimitRpm).toBe(500);
    });
  });

  describe('validateKey()', () => {
    it('should accept valid active keys', async () => {
      const testKey = 'ab_test_abcdefghijklmnopqrstuvwxyz12';
      const keyHash = crypto.createHash('sha256').update(testKey).digest('hex');

      const mockApiKey = {
        id: 'key-valid',
        userId: 'user-1',
        keyPrefix: 'ab_test_xxxx',
        keyHash,
        label: 'Valid Key',
        scopes: [ApiKeyScope.READ, ApiKeyScope.WRITE],
        status: ApiKeyStatus.ACTIVE,
        expiresAt: null,
        lastUsedAt: null,
        usageCount: 0,
        rateLimitRpm: 100,
        allowedIps: [],
        allowedOrigins: [],
      };

      vi.mocked(mockPrisma.apiKey.findUnique).mockResolvedValue(mockApiKey as any);
      vi.mocked(mockPrisma.apiKey.update).mockResolvedValue(mockApiKey as any);

      const result = await service.validateKey(testKey);

      expect(result.valid).toBe(true);
      expect(result.userId).toBe('user-1');
      expect(result.scopes).toEqual([ApiKeyScope.READ, ApiKeyScope.WRITE]);
      expect(result.keyId).toBe('key-valid');
    });

    it('should reject keys with invalid format', async () => {
      const result = await service.validateKey('invalid-key-format');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid key format');
    });

    it('should reject empty or null keys', async () => {
      const result1 = await service.validateKey('');
      expect(result1.valid).toBe(false);

      const result2 = await service.validateKey(null as any);
      expect(result2.valid).toBe(false);
    });

    it('should reject expired keys', async () => {
      const testKey = 'ab_test_expiredkey123456789012345';
      const keyHash = crypto.createHash('sha256').update(testKey).digest('hex');

      const mockApiKey = {
        id: 'key-expired',
        userId: 'user-1',
        keyHash,
        status: ApiKeyStatus.ACTIVE,
        expiresAt: new Date(Date.now() - 86400000), // Expired 1 day ago
        allowedIps: [],
      };

      vi.mocked(mockPrisma.apiKey.findUnique).mockResolvedValue(mockApiKey as any);
      vi.mocked(mockPrisma.apiKey.update).mockResolvedValue(mockApiKey as any);

      const result = await service.validateKey(testKey);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('should reject revoked keys', async () => {
      const testKey = 'ab_test_revokedkey12345678901234';
      const keyHash = crypto.createHash('sha256').update(testKey).digest('hex');

      const mockApiKey = {
        id: 'key-revoked',
        userId: 'user-1',
        keyHash,
        status: ApiKeyStatus.REVOKED,
        expiresAt: null,
        allowedIps: [],
      };

      vi.mocked(mockPrisma.apiKey.findUnique).mockResolvedValue(mockApiKey as any);

      const result = await service.validateKey(testKey);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('revoked');
    });

    it('should block requests from non-whitelisted IPs', async () => {
      const testKey = 'ab_test_ipwhitelist123456789012';
      const keyHash = crypto.createHash('sha256').update(testKey).digest('hex');

      const mockApiKey = {
        id: 'key-ip-restricted',
        userId: 'user-1',
        keyHash,
        status: ApiKeyStatus.ACTIVE,
        expiresAt: null,
        allowedIps: ['10.0.0.1', '10.0.0.2'],
      };

      vi.mocked(mockPrisma.apiKey.findUnique).mockResolvedValue(mockApiKey as any);

      const result = await service.validateKey(testKey, '192.168.1.100');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('IP address not authorized');
    });

    it('should allow requests from whitelisted IPs', async () => {
      const testKey = 'ab_test_ipallowed1234567890123';
      const keyHash = crypto.createHash('sha256').update(testKey).digest('hex');

      const mockApiKey = {
        id: 'key-ip-allowed',
        userId: 'user-1',
        keyHash,
        scopes: [ApiKeyScope.READ],
        status: ApiKeyStatus.ACTIVE,
        expiresAt: null,
        allowedIps: ['10.0.0.1', '192.168.1.100'],
      };

      vi.mocked(mockPrisma.apiKey.findUnique).mockResolvedValue(mockApiKey as any);
      vi.mocked(mockPrisma.apiKey.update).mockResolvedValue(mockApiKey as any);

      const result = await service.validateKey(testKey, '192.168.1.100');

      expect(result.valid).toBe(true);
    });

    it('should update usage count and lastUsedAt on validation', async () => {
      const testKey = 'ab_test_usagetracking123456789';
      const keyHash = crypto.createHash('sha256').update(testKey).digest('hex');

      const mockApiKey = {
        id: 'key-usage',
        userId: 'user-1',
        keyHash,
        scopes: [ApiKeyScope.READ],
        status: ApiKeyStatus.ACTIVE,
        expiresAt: null,
        allowedIps: [],
      };

      vi.mocked(mockPrisma.apiKey.findUnique).mockResolvedValue(mockApiKey as any);
      vi.mocked(mockPrisma.apiKey.update).mockResolvedValue(mockApiKey as any);

      await service.validateKey(testKey, '10.0.0.1');

      // Check that update was called with increment
      expect(mockPrisma.apiKey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'key-usage' },
          data: expect.objectContaining({
            lastUsedAt: expect.any(Date),
            lastUsedIp: '10.0.0.1',
            usageCount: { increment: 1 },
          }),
        })
      );
    });
  });

  describe('revokeKey()', () => {
    it('should set status to REVOKED with timestamp and reason', async () => {
      const mockApiKey = {
        id: 'key-to-revoke',
        userId: 'user-1',
        status: ApiKeyStatus.ACTIVE,
      };

      vi.mocked(mockPrisma.apiKey.findFirst).mockResolvedValue(mockApiKey as any);
      vi.mocked(mockPrisma.apiKey.update).mockResolvedValue({
        ...mockApiKey,
        status: ApiKeyStatus.REVOKED,
      } as any);

      await service.revokeKey('key-to-revoke', 'user-1', 'admin-1', 'Security concern');

      expect(mockPrisma.apiKey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'key-to-revoke' },
          data: expect.objectContaining({
            status: ApiKeyStatus.REVOKED,
            revokedAt: expect.any(Date),
            revokedBy: 'admin-1',
            revokedReason: 'Security concern',
          }),
        })
      );
    });

    it('should throw error if key not found', async () => {
      vi.mocked(mockPrisma.apiKey.findFirst).mockResolvedValue(null);

      await expect(
        service.revokeKey('non-existent', 'user-1', 'admin-1')
      ).rejects.toThrow('API key not found or unauthorized');
    });

    it('should throw error if key already revoked', async () => {
      const mockApiKey = {
        id: 'key-already-revoked',
        userId: 'user-1',
        status: ApiKeyStatus.REVOKED,
      };

      vi.mocked(mockPrisma.apiKey.findFirst).mockResolvedValue(mockApiKey as any);

      await expect(
        service.revokeKey('key-already-revoked', 'user-1', 'admin-1')
      ).rejects.toThrow('API key is already revoked');
    });
  });

  describe('listKeys()', () => {
    it('should return masked keys for owner', async () => {
      const mockKeys = [
        {
          id: 'key-1',
          userId: 'user-1',
          keyPrefix: 'ab_test_xxxx',
          label: 'Key 1',
          description: 'First key',
          scopes: [ApiKeyScope.READ],
          status: ApiKeyStatus.ACTIVE,
          expiresAt: null,
          lastUsedAt: new Date(),
          usageCount: 10,
          rateLimitRpm: 100,
          allowedIps: [],
          allowedOrigins: [],
          createdAt: new Date(),
        },
        {
          id: 'key-2',
          userId: 'user-1',
          keyPrefix: 'ab_test_yyyy',
          label: 'Key 2',
          description: null,
          scopes: [ApiKeyScope.READ, ApiKeyScope.WRITE],
          status: ApiKeyStatus.REVOKED,
          expiresAt: null,
          lastUsedAt: null,
          usageCount: 0,
          rateLimitRpm: 200,
          allowedIps: [],
          allowedOrigins: [],
          createdAt: new Date(),
        },
      ];

      vi.mocked(mockPrisma.apiKey.findMany).mockResolvedValue(mockKeys as any);

      const result = await service.listKeys('user-1');

      expect(result).toHaveLength(2);
      expect(result[0].keyPrefix).toBe('ab_test_xxxx');
      expect(result[1].keyPrefix).toBe('ab_test_yyyy');
      // Verify full key is NOT included
      expect((result[0] as any).key).toBeUndefined();
      expect((result[0] as any).keyHash).toBeUndefined();
    });
  });

  describe('updateKey()', () => {
    it('should update label and description', async () => {
      const mockApiKey = {
        id: 'key-update',
        userId: 'user-1',
        keyPrefix: 'ab_test_xxxx',
        label: 'Original',
        description: 'Original desc',
        scopes: [ApiKeyScope.READ],
        status: ApiKeyStatus.ACTIVE,
        expiresAt: null,
        lastUsedAt: null,
        usageCount: 0,
        rateLimitRpm: 100,
        allowedIps: [],
        allowedOrigins: [],
        createdAt: new Date(),
      };

      vi.mocked(mockPrisma.apiKey.findFirst).mockResolvedValue(mockApiKey as any);
      vi.mocked(mockPrisma.apiKey.update).mockResolvedValue({
        ...mockApiKey,
        label: 'Updated',
        description: 'Updated desc',
      } as any);

      const result = await service.updateKey('key-update', 'user-1', {
        label: 'Updated',
        description: 'Updated desc',
      });

      expect(result.label).toBe('Updated');
      expect(result.description).toBe('Updated desc');
    });

    it('should update rate limit and allowed IPs', async () => {
      const mockApiKey = {
        id: 'key-update-rate',
        userId: 'user-1',
        keyPrefix: 'ab_test_xxxx',
        label: 'Rate Key',
        scopes: [ApiKeyScope.READ],
        status: ApiKeyStatus.ACTIVE,
        rateLimitRpm: 100,
        allowedIps: [],
        allowedOrigins: [],
        createdAt: new Date(),
      };

      vi.mocked(mockPrisma.apiKey.findFirst).mockResolvedValue(mockApiKey as any);
      vi.mocked(mockPrisma.apiKey.update).mockResolvedValue({
        ...mockApiKey,
        rateLimitRpm: 500,
        allowedIps: ['10.0.0.1'],
      } as any);

      const result = await service.updateKey('key-update-rate', 'user-1', {
        rateLimitRpm: 500,
        allowedIps: ['10.0.0.1'],
      });

      expect(result.rateLimitRpm).toBe(500);
      expect(result.allowedIps).toEqual(['10.0.0.1']);
    });

    it('should throw error if key not found or unauthorized', async () => {
      vi.mocked(mockPrisma.apiKey.findFirst).mockResolvedValue(null);

      await expect(
        service.updateKey('non-existent', 'user-1', { label: 'New' })
      ).rejects.toThrow('API key not found or unauthorized');
    });
  });

  describe('getKey()', () => {
    it('should return key details for authorized user', async () => {
      const mockApiKey = {
        id: 'key-get',
        userId: 'user-1',
        keyPrefix: 'ab_test_xxxx',
        label: 'My Key',
        description: 'A description',
        scopes: [ApiKeyScope.READ],
        status: ApiKeyStatus.ACTIVE,
        expiresAt: null,
        lastUsedAt: new Date(),
        usageCount: 5,
        rateLimitRpm: 100,
        allowedIps: [],
        allowedOrigins: [],
        createdAt: new Date(),
      };

      vi.mocked(mockPrisma.apiKey.findFirst).mockResolvedValue(mockApiKey as any);

      const result = await service.getKey('key-get', 'user-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('key-get');
      expect(result!.label).toBe('My Key');
      expect((result as any).keyHash).toBeUndefined();
    });

    it('should return null for non-existent key', async () => {
      vi.mocked(mockPrisma.apiKey.findFirst).mockResolvedValue(null);

      const result = await service.getKey('non-existent', 'user-1');

      expect(result).toBeNull();
    });
  });
});
