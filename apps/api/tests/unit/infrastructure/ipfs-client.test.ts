/**
 * @file IPFSClient Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  IPFSClient,
  getIPFSClient,
  resetIPFSClient,
} from '../../../src/infrastructure/storage/IPFSClient.js';

// Mock Sentry
vi.mock('../../../src/infrastructure/monitoring/sentry.js', () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
  instrumentDatabase: vi.fn((name, fn) => fn()),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('IPFSClient', () => {
  let client: IPFSClient;

  beforeEach(() => {
    resetIPFSClient();
    vi.clearAllMocks();

    // Set up environment variables for testing
    process.env.PINATA_API_KEY = 'test-api-key';
    process.env.PINATA_SECRET_KEY = 'test-secret-key';

    client = new IPFSClient({
      maxRetries: 2,
      retryDelayMs: 10,
      timeoutMs: 5000,
      circuitBreakerThreshold: 2,
      circuitBreakerResetMs: 100,
    });
  });

  afterEach(() => {
    delete process.env.PINATA_API_KEY;
    delete process.env.PINATA_SECRET_KEY;
  });

  describe('upload', () => {
    it('should upload content successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          IpfsHash: 'QmTest123',
          PinSize: 1024,
        }),
      });

      const result = await client.upload(
        Buffer.from('test content'),
        'test.txt',
        { key: 'value' }
      );

      expect(result.cid).toBe('QmTest123');
      expect(result.provider).toBe('pinata');
      expect(result.size).toBe(1024);
      expect(result.url).toContain('QmTest123');
    });

    it('should retry on failure', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            IpfsHash: 'QmTest456',
            PinSize: 2048,
          }),
        });

      const result = await client.upload(Buffer.from('test'), 'test.txt');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.cid).toBe('QmTest456');
    });

    it('should handle upload failure after retries', async () => {
      mockFetch.mockRejectedValue(new Error('Persistent failure'));

      await expect(
        client.upload(Buffer.from('test'), 'test.txt')
      ).rejects.toThrow('All IPFS providers failed');
    });

    it('should handle HTTP error responses', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      await expect(
        client.upload(Buffer.from('test'), 'test.txt')
      ).rejects.toThrow();
    });

    it('should handle string content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          IpfsHash: 'QmString123',
          PinSize: 100,
        }),
      });

      const result = await client.upload('string content', 'text.txt');
      expect(result.cid).toBe('QmString123');
    });
  });

  describe('retrieve', () => {
    it('should retrieve content from IPFS', async () => {
      const testContent = Buffer.from('retrieved content');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => testContent.buffer,
      });

      const result = await client.retrieve('QmTest123');

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should try multiple gateways on failure', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Gateway 1 failed'))
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => Buffer.from('content').buffer,
        });

      const result = await client.retrieve('QmTest123');
      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe('verify', () => {
    it('should verify CID exists', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await client.verify('QmTest123');
      expect(result).toBe(true);
    });

    it('should return false for non-existent CID', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      const result = await client.verify('QmNonExistent');
      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.verify('QmTest123');
      expect(result).toBe(false);
    });
  });

  describe('circuit breaker', () => {
    it('should trip circuit breaker after threshold failures', async () => {
      // Fail enough times to trip circuit breaker
      mockFetch.mockRejectedValue(new Error('Failure'));

      // First attempt (will fail and increment failure count)
      await expect(client.upload(Buffer.from('test'), 'test.txt')).rejects.toThrow();

      // Second attempt (will fail and trip circuit breaker)
      await expect(client.upload(Buffer.from('test'), 'test.txt')).rejects.toThrow();

      // Check provider status
      const status = client.getProviderStatus();
      const pinataStatus = status.find(p => p.name === 'pinata');

      // After multiple failures, provider should be marked unhealthy
      expect(pinataStatus?.failureCount).toBeGreaterThan(0);
    });

    it('should reset circuit breaker', () => {
      client.resetCircuitBreakers();

      const status = client.getProviderStatus();
      status.forEach(provider => {
        expect(provider.isHealthy).toBe(true);
        expect(provider.failureCount).toBe(0);
      });
    });
  });

  describe('getProviderStatus', () => {
    it('should return status of all providers', () => {
      const status = client.getProviderStatus();

      expect(status).toBeInstanceOf(Array);
      expect(status.length).toBeGreaterThan(0);

      status.forEach(provider => {
        expect(provider).toHaveProperty('name');
        expect(provider).toHaveProperty('isHealthy');
        expect(provider).toHaveProperty('failureCount');
      });
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      resetIPFSClient();
      const client1 = getIPFSClient();
      const client2 = getIPFSClient();

      expect(client1).toBe(client2);
    });
  });
});
