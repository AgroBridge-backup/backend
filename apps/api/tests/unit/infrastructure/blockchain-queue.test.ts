/**
 * @file BlockchainQueue Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BlockchainQueue,
  BlockchainJob,
  getBlockchainQueue,
  resetBlockchainQueue,
} from '../../../src/infrastructure/queue/BlockchainQueue.js';

// Mock Sentry
vi.mock('../../../src/infrastructure/monitoring/sentry.js', () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

describe('BlockchainQueue', () => {
  let queue: BlockchainQueue;

  beforeEach(() => {
    resetBlockchainQueue();
    queue = new BlockchainQueue({
      maxAttempts: 3,
      initialDelayMs: 100,
      maxDelayMs: 1000,
      backoffMultiplier: 2,
      processingTimeoutMs: 5000,
    });
  });

  describe('enqueue', () => {
    it('should add a job to the queue', async () => {
      const jobId = await queue.enqueue('REGISTER_EVENT', { batchId: 'batch-1' });

      expect(jobId).toBeDefined();
      expect(jobId).toMatch(/^job_/);

      const job = queue.getJob(jobId);
      expect(job).toBeDefined();
      expect(job!.type).toBe('REGISTER_EVENT');
      expect(job!.status).toBe('PENDING');
      expect(job!.attempts).toBe(0);
    });

    it('should reject duplicate jobs with same idempotency key', async () => {
      const key = 'unique-key-123';
      const jobId1 = await queue.enqueue('MINT_NFT', { tokenId: '1' }, key);
      const jobId2 = await queue.enqueue('MINT_NFT', { tokenId: '1' }, key);

      expect(jobId1).toBe(jobId2);
    });

    it('should generate idempotency key from payload if not provided', async () => {
      const jobId = await queue.enqueue('WHITELIST_PRODUCER', { producerId: 'p-1' });
      const job = queue.getJob(jobId);

      expect(job!.idempotencyKey).toBeDefined();
      expect(job!.idempotencyKey).toMatch(/^idem_/);
    });

    it('should emit jobEnqueued event', async () => {
      const eventHandler = vi.fn();
      queue.on('jobEnqueued', eventHandler);

      await queue.enqueue('UPDATE_BATCH', { batchId: 'b-1' });

      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler.mock.calls[0][0].type).toBe('UPDATE_BATCH');
    });
  });

  describe('processJobs', () => {
    it('should process pending jobs', async () => {
      const processor = vi.fn().mockResolvedValue({ success: true, transactionHash: '0x123' });

      await queue.enqueue('REGISTER_EVENT', { batchId: 'b-1' });
      await queue.processJobs(processor);

      expect(processor).toHaveBeenCalledTimes(1);

      const jobs = queue.getJobsByStatus('COMPLETED');
      expect(jobs).toHaveLength(1);
      expect(jobs[0].transactionHash).toBe('0x123');
    });

    it('should retry failed jobs with backoff', async () => {
      let attempt = 0;
      const processor = vi.fn().mockImplementation(async () => {
        attempt++;
        if (attempt < 3) {
          return { success: false, error: 'Network error' };
        }
        return { success: true, transactionHash: '0x456' };
      });

      const jobId = await queue.enqueue('MINT_NFT', { tokenId: '1' });

      // First attempt - fails
      await queue.processJobs(processor);
      let job = queue.getJob(jobId);
      expect(job!.status).toBe('PENDING');
      expect(job!.attempts).toBe(1);

      // Wait for retry delay
      await new Promise(resolve => setTimeout(resolve, 150));

      // Second attempt - fails
      await queue.processJobs(processor);
      job = queue.getJob(jobId);
      expect(job!.status).toBe('PENDING');
      expect(job!.attempts).toBe(2);

      // Wait for retry delay (longer due to backoff)
      await new Promise(resolve => setTimeout(resolve, 250));

      // Third attempt - succeeds
      await queue.processJobs(processor);
      job = queue.getJob(jobId);
      expect(job!.status).toBe('COMPLETED');
      expect(job!.attempts).toBe(3);
    });

    it('should move job to DLQ after max attempts', async () => {
      const processor = vi.fn().mockResolvedValue({ success: false, error: 'Persistent error' });

      await queue.enqueue('REGISTER_EVENT', { batchId: 'b-1' });

      // Process all 3 attempts
      for (let i = 0; i < 3; i++) {
        await queue.processJobs(processor);
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      const dlq = queue.getDeadLetterQueue();
      expect(dlq).toHaveLength(1);
      expect(dlq[0].status).toBe('DEAD');
      expect(dlq[0].attempts).toBe(3);
    });

    it('should emit events for job lifecycle', async () => {
      const completedHandler = vi.fn();
      const retryHandler = vi.fn();
      const deadHandler = vi.fn();

      queue.on('jobCompleted', completedHandler);
      queue.on('jobRetry', retryHandler);
      queue.on('jobDead', deadHandler);

      const failingProcessor = vi.fn().mockResolvedValue({ success: false, error: 'Error' });
      await queue.enqueue('MINT_NFT', { tokenId: '1' });

      // Process until dead
      for (let i = 0; i < 3; i++) {
        await queue.processJobs(failingProcessor);
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      expect(retryHandler).toHaveBeenCalledTimes(2); // 2 retries before dead
      expect(deadHandler).toHaveBeenCalledTimes(1);

      // Now test successful completion
      const successProcessor = vi.fn().mockResolvedValue({ success: true, transactionHash: '0x789' });
      await queue.enqueue('WHITELIST_PRODUCER', { producerId: 'p-1' });
      await queue.processJobs(successProcessor);

      expect(completedHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('retryDeadLetter', () => {
    it('should requeue dead letter job', async () => {
      const processor = vi.fn().mockResolvedValue({ success: false, error: 'Error' });

      const jobId = await queue.enqueue('REGISTER_EVENT', { batchId: 'b-1' });

      // Process until dead
      for (let i = 0; i < 3; i++) {
        await queue.processJobs(processor);
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      expect(queue.getDeadLetterQueue()).toHaveLength(1);
      expect(queue.getJob(jobId)).toBeUndefined();

      // Retry dead letter
      const result = queue.retryDeadLetter(jobId);
      expect(result).toBe(true);

      expect(queue.getDeadLetterQueue()).toHaveLength(0);
      const requeuedJob = queue.getJob(jobId);
      expect(requeuedJob).toBeDefined();
      expect(requeuedJob!.status).toBe('PENDING');
      expect(requeuedJob!.attempts).toBe(0);
    });

    it('should return false for non-existent job', () => {
      const result = queue.retryDeadLetter('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return accurate queue statistics', async () => {
      const processor = vi.fn().mockResolvedValue({ success: true, transactionHash: '0x123' });

      await queue.enqueue('REGISTER_EVENT', { batchId: 'b-1' });
      await queue.enqueue('MINT_NFT', { tokenId: '1' });
      await queue.enqueue('WHITELIST_PRODUCER', { producerId: 'p-1' });

      let stats = queue.getStats();
      expect(stats.pending).toBe(3);
      expect(stats.total).toBe(3);

      await queue.processJobs(processor);

      stats = queue.getStats();
      expect(stats.completed).toBe(3);
      expect(stats.pending).toBe(0);
    });
  });

  describe('pruneCompleted', () => {
    it('should remove old completed jobs', async () => {
      const processor = vi.fn().mockResolvedValue({ success: true, transactionHash: '0x123' });

      await queue.enqueue('REGISTER_EVENT', { batchId: 'b-1' });
      await queue.processJobs(processor);

      let stats = queue.getStats();
      expect(stats.completed).toBe(1);

      // Wait a bit so the job becomes "old"
      await new Promise(resolve => setTimeout(resolve, 10));

      // Prune with 5ms threshold (jobs older than 5ms)
      const pruned = queue.pruneCompleted(5);
      expect(pruned).toBe(1);

      stats = queue.getStats();
      expect(stats.completed).toBe(0);
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      resetBlockchainQueue();
      const queue1 = getBlockchainQueue();
      const queue2 = getBlockchainQueue();

      expect(queue1).toBe(queue2);
    });
  });
});
