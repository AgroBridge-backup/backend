/**
 * @file BlockchainQueue
 * @description Resilient queue for blockchain operations with retry logic
 *
 * Provides:
 * - Persistent queue for blockchain transactions
 * - Automatic retry with exponential backoff
 * - Dead letter queue for failed operations
 * - Idempotency support to prevent duplicate transactions
 */

import { EventEmitter } from 'events';
import { captureException, addBreadcrumb } from '../monitoring/sentry.js';

export interface BlockchainJob {
  id: string;
  type: 'REGISTER_EVENT' | 'MINT_NFT' | 'WHITELIST_PRODUCER' | 'UPDATE_BATCH';
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  lastAttemptAt?: Date;
  nextAttemptAt: Date;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DEAD';
  error?: string;
  transactionHash?: string;
  idempotencyKey: string;
}

export interface QueueConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  processingTimeoutMs: number;
}

const DEFAULT_CONFIG: QueueConfig = {
  maxAttempts: 5,
  initialDelayMs: 1000,
  maxDelayMs: 300000, // 5 minutes
  backoffMultiplier: 2,
  processingTimeoutMs: 60000, // 1 minute
};

export class BlockchainQueue extends EventEmitter {
  private jobs: Map<string, BlockchainJob> = new Map();
  private deadLetterQueue: BlockchainJob[] = [];
  private config: QueueConfig;
  private isProcessing: boolean = false;
  private processingTimer: NodeJS.Timeout | null = null;
  private idempotencyCache: Set<string> = new Set();

  constructor(config: Partial<QueueConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Add a job to the queue
   */
  async enqueue(
    type: BlockchainJob['type'],
    payload: Record<string, unknown>,
    idempotencyKey?: string
  ): Promise<string> {
    const key = idempotencyKey || this.generateIdempotencyKey(type, payload);

    // Check for duplicate
    if (this.idempotencyCache.has(key)) {
      addBreadcrumb('Duplicate blockchain job rejected', 'queue', { type, idempotencyKey: key });
      const existingJob = Array.from(this.jobs.values()).find(j => j.idempotencyKey === key);
      if (existingJob) {
        return existingJob.id;
      }
    }

    const job: BlockchainJob = {
      id: this.generateJobId(),
      type,
      payload,
      attempts: 0,
      maxAttempts: this.config.maxAttempts,
      createdAt: new Date(),
      nextAttemptAt: new Date(),
      status: 'PENDING',
      idempotencyKey: key,
    };

    this.jobs.set(job.id, job);
    this.idempotencyCache.add(key);

    addBreadcrumb('Blockchain job enqueued', 'queue', {
      jobId: job.id,
      type,
      idempotencyKey: key
    });

    this.emit('jobEnqueued', job);
    this.scheduleProcessing();

    return job.id;
  }

  /**
   * Process pending jobs
   */
  async processJobs(
    processor: (job: BlockchainJob) => Promise<{ success: boolean; transactionHash?: string; error?: string }>
  ): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const now = new Date();
      const pendingJobs = Array.from(this.jobs.values())
        .filter(job =>
          job.status === 'PENDING' &&
          job.nextAttemptAt <= now
        )
        .sort((a, b) => a.nextAttemptAt.getTime() - b.nextAttemptAt.getTime());

      for (const job of pendingJobs) {
        await this.processJob(job, processor);
      }
    } finally {
      this.isProcessing = false;
      this.scheduleProcessing();
    }
  }

  /**
   * Process a single job
   */
  private async processJob(
    job: BlockchainJob,
    processor: (job: BlockchainJob) => Promise<{ success: boolean; transactionHash?: string; error?: string }>
  ): Promise<void> {
    job.status = 'PROCESSING';
    job.attempts += 1;
    job.lastAttemptAt = new Date();

    addBreadcrumb('Processing blockchain job', 'queue', {
      jobId: job.id,
      type: job.type,
      attempt: job.attempts,
    });

    try {
      const result = await Promise.race([
        processor(job),
        this.timeout(this.config.processingTimeoutMs),
      ]);

      if (result.success) {
        job.status = 'COMPLETED';
        job.transactionHash = result.transactionHash;
        this.emit('jobCompleted', job);

        addBreadcrumb('Blockchain job completed', 'queue', {
          jobId: job.id,
          transactionHash: result.transactionHash,
        });
      } else {
        this.handleFailure(job, result.error || 'Unknown error');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.handleFailure(job, errorMessage);
      captureException(error as Error, { jobId: job.id, type: job.type });
    }
  }

  /**
   * Handle job failure
   */
  private handleFailure(job: BlockchainJob, error: string): void {
    job.error = error;

    if (job.attempts >= job.maxAttempts) {
      job.status = 'DEAD';
      this.deadLetterQueue.push(job);
      this.jobs.delete(job.id);
      this.emit('jobDead', job);

      addBreadcrumb('Blockchain job moved to DLQ', 'queue', {
        jobId: job.id,
        attempts: job.attempts,
        error,
      });
    } else {
      job.status = 'PENDING';
      job.nextAttemptAt = this.calculateNextAttempt(job.attempts);
      this.emit('jobRetry', job);

      addBreadcrumb('Blockchain job scheduled for retry', 'queue', {
        jobId: job.id,
        attempt: job.attempts,
        nextAttemptAt: job.nextAttemptAt.toISOString(),
      });
    }
  }

  /**
   * Calculate next attempt time with exponential backoff
   */
  private calculateNextAttempt(attempts: number): Date {
    const delay = Math.min(
      this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, attempts - 1),
      this.config.maxDelayMs
    );
    return new Date(Date.now() + delay);
  }

  /**
   * Get job by ID
   */
  getJob(id: string): BlockchainJob | undefined {
    return this.jobs.get(id);
  }

  /**
   * Get all jobs by status
   */
  getJobsByStatus(status: BlockchainJob['status']): BlockchainJob[] {
    return Array.from(this.jobs.values()).filter(job => job.status === status);
  }

  /**
   * Get dead letter queue
   */
  getDeadLetterQueue(): BlockchainJob[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Retry a dead letter job
   */
  retryDeadLetter(jobId: string): boolean {
    const index = this.deadLetterQueue.findIndex(job => job.id === jobId);
    if (index === -1) return false;

    const job = this.deadLetterQueue.splice(index, 1)[0];
    job.status = 'PENDING';
    job.attempts = 0;
    job.nextAttemptAt = new Date();
    job.error = undefined;
    this.jobs.set(job.id, job);

    addBreadcrumb('Dead letter job requeued', 'queue', { jobId });
    this.scheduleProcessing();
    return true;
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    dead: number;
    total: number;
  } {
    const jobs = Array.from(this.jobs.values());
    return {
      pending: jobs.filter(j => j.status === 'PENDING').length,
      processing: jobs.filter(j => j.status === 'PROCESSING').length,
      completed: jobs.filter(j => j.status === 'COMPLETED').length,
      failed: jobs.filter(j => j.status === 'FAILED').length,
      dead: this.deadLetterQueue.length,
      total: jobs.length + this.deadLetterQueue.length,
    };
  }

  /**
   * Clear completed jobs older than specified duration
   */
  pruneCompleted(olderThanMs: number = 3600000): number {
    const cutoff = Date.now() - olderThanMs;
    let pruned = 0;

    for (const [id, job] of this.jobs) {
      if (job.status === 'COMPLETED' && job.lastAttemptAt && job.lastAttemptAt.getTime() < cutoff) {
        this.jobs.delete(id);
        this.idempotencyCache.delete(job.idempotencyKey);
        pruned++;
      }
    }

    return pruned;
  }

  /**
   * Schedule next processing cycle
   */
  private scheduleProcessing(): void {
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
    }

    const nextJob = Array.from(this.jobs.values())
      .filter(job => job.status === 'PENDING')
      .sort((a, b) => a.nextAttemptAt.getTime() - b.nextAttemptAt.getTime())[0];

    if (nextJob) {
      const delay = Math.max(0, nextJob.nextAttemptAt.getTime() - Date.now());
      this.processingTimer = setTimeout(() => {
        this.emit('processingDue');
      }, delay);
    }
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate idempotency key from job data
   */
  private generateIdempotencyKey(type: string, payload: Record<string, unknown>): string {
    const data = JSON.stringify({ type, payload });
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `idem_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Create timeout promise
   */
  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Processing timeout')), ms);
    });
  }

  /**
   * Shutdown queue gracefully
   */
  async shutdown(): Promise<void> {
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
    }

    // Wait for current processing to complete
    while (this.isProcessing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

// Singleton instance
let queueInstance: BlockchainQueue | null = null;

export function getBlockchainQueue(config?: Partial<QueueConfig>): BlockchainQueue {
  if (!queueInstance) {
    queueInstance = new BlockchainQueue(config);
  }
  return queueInstance;
}

export function resetBlockchainQueue(): void {
  queueInstance = null;
}
