/**
 * @file Queue Service
 * @description Centralized background job processing with Bull queues
 *
 * Provides 4 specialized queues:
 * 1. qr-generation - Async QR code generation for batches
 * 2. blockchain-tx - Blockchain transaction processing with retry
 * 3. email - Queue-based email sending via ResilientEmailService
 * 4. reports - Report generation (PDF/CSV/XLSX)
 *
 * Features:
 * - Redis-backed persistence (survives crashes)
 * - Exponential backoff retry logic
 * - Priority queuing
 * - Rate limiting
 * - Health monitoring
 * - Graceful shutdown
 *
 * @author AgroBridge Engineering Team
 */

import Bull, { Queue, Job, JobOptions } from 'bull';
import logger from '../../shared/utils/logger.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * QR Code Generation Job Data
 */
export interface QRJobData {
  /** Batch ID to generate QR for */
  batchId: string;
  /** Data to encode in QR (usually traceability URL) */
  data: string;
  /** User who triggered the generation */
  userId: string;
  /** Optional callback URL for completion notification */
  callbackUrl?: string;
}

/**
 * QR Code Generation Result
 */
export interface QRJobResult {
  success: boolean;
  batchId: string;
  qrCodeUrl?: string;
  cdnUrl?: string;
  error?: string;
}

/**
 * Blockchain Transaction Job Data
 */
export interface BlockchainJobData {
  /** Type of blockchain operation */
  type: 'batch-creation' | 'event-creation' | 'certification' | 'transfer';
  /** Batch ID (for batch-related transactions) */
  batchId?: string;
  /** Event ID (for event-related transactions) */
  eventId?: string;
  /** Producer ID (for producer-related transactions) */
  producerId?: string;
  /** User who triggered the transaction */
  userId: string;
  /** Transaction payload */
  payload?: Record<string, unknown>;
  /** Priority (affects gas price) */
  priority?: 'low' | 'normal' | 'high';
}

/**
 * Blockchain Transaction Result
 */
export interface BlockchainJobResult {
  success: boolean;
  transactionHash?: string;
  blockNumber?: number;
  gasUsed?: number;
  error?: string;
  errorCode?: string;
}

/**
 * Email Job Data
 */
export interface EmailJobData {
  /** Recipient email address */
  to: string;
  /** Email subject */
  subject: string;
  /** Email template name or 'custom' */
  template: 'welcome' | 'password-reset' | 'verification' | '2fa-code' | 'batch-created' | 'custom';
  /** Template data */
  data: Record<string, unknown>;
  /** Email priority */
  priority?: 'high' | 'normal' | 'low';
  /** Custom HTML (when template is 'custom') */
  html?: string;
  /** Attachments */
  attachments?: Array<{
    filename: string;
    content: string;
    encoding: 'base64' | 'utf-8';
  }>;
}

/**
 * Email Job Result
 */
export interface EmailJobResult {
  success: boolean;
  messageId?: string;
  provider?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Report Generation Job Data
 */
export interface ReportJobData {
  /** Report type */
  type: 'batch-traceability' | 'producer-summary' | 'audit-log' | 'export';
  /** Output format */
  format: 'pdf' | 'csv' | 'xlsx';
  /** Report filters */
  filters: Record<string, unknown>;
  /** User who requested the report */
  userId: string;
  /** Email to send report when done */
  emailTo?: string;
  /** Optional filename override */
  filename?: string;
}

/**
 * Report Generation Result
 */
export interface ReportJobResult {
  success: boolean;
  reportUrl?: string;
  cdnUrl?: string;
  filename?: string;
  size?: number;
  emailSent?: boolean;
  error?: string;
}

/**
 * Queue Health Status
 */
export interface QueueHealthStatus {
  connected: boolean;
  queues: {
    qrGeneration: QueueStats;
    blockchain: QueueStats;
    email: QueueStats;
    reports: QueueStats;
  };
  redis: {
    host: string;
    port: number;
    status: 'connected' | 'disconnected' | 'error';
  };
}

/**
 * Individual Queue Statistics
 */
export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUEUE SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Queue Service
 *
 * Manages all background job queues for the application.
 * Implements singleton pattern for centralized queue management.
 */
export class QueueService {
  private static instance: QueueService | null = null;

  /** QR Code Generation Queue */
  private _qrQueue: Queue<QRJobData> | null = null;

  /** Blockchain Transaction Queue */
  private _blockchainQueue: Queue<BlockchainJobData> | null = null;

  /** Email Queue */
  private _emailQueue: Queue<EmailJobData> | null = null;

  /** Report Generation Queue */
  private _reportQueue: Queue<ReportJobData> | null = null;

  /** Initialization flag */
  private initialized: boolean = false;

  /** Redis configuration */
  private redisConfig: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };

  private constructor() {
    this.redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_QUEUE_DB || '1', 10), // Use different DB for queues
    };
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
    }
    return QueueService.instance;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Initialize all queues
   *
   * @throws Error if Redis connection fails
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug('[QueueService] Already initialized');
      return;
    }

    try {
      logger.info('[QueueService] Initializing queues...', {
        redis: `${this.redisConfig.host}:${this.redisConfig.port}`,
        db: this.redisConfig.db,
      });

      // Default job options
      const defaultJobOptions: Bull.JobOptions = {
        attempts: parseInt(process.env.QUEUE_MAX_RETRIES || '3', 10),
        backoff: {
          type: 'exponential',
          delay: parseInt(process.env.QUEUE_RETRY_DELAY || '2000', 10),
        },
        removeOnComplete: 100,
        removeOnFail: 200,
      };

      // Initialize QR Generation Queue
      this._qrQueue = new Bull<QRJobData>('qr-generation', {
        redis: this.redisConfig,
        defaultJobOptions,
        settings: {
          stalledInterval: 30000,
          maxStalledCount: 2,
        },
      });

      // Initialize Blockchain Transaction Queue (lower concurrency, higher timeout)
      this._blockchainQueue = new Bull<BlockchainJobData>('blockchain-tx', {
        redis: this.redisConfig,
        defaultJobOptions: {
          ...defaultJobOptions,
          attempts: 5, // More retries for blockchain
          timeout: 120000, // 2 minute timeout
        },
        limiter: {
          max: 10, // Max 10 blockchain txs per minute
          duration: 60000,
        },
        settings: {
          stalledInterval: 60000,
          maxStalledCount: 1,
        },
      });

      // Initialize Email Queue
      this._emailQueue = new Bull<EmailJobData>('email', {
        redis: this.redisConfig,
        defaultJobOptions,
        limiter: {
          max: parseInt(process.env.EMAIL_RATE_LIMIT || '100', 10),
          duration: 60000, // 100 emails per minute
        },
      });

      // Initialize Report Generation Queue
      this._reportQueue = new Bull<ReportJobData>('reports', {
        redis: this.redisConfig,
        defaultJobOptions: {
          ...defaultJobOptions,
          timeout: 300000, // 5 minute timeout for reports
        },
        settings: {
          stalledInterval: 60000,
          maxStalledCount: 1,
        },
      });

      // Setup event handlers for all queues
      this.setupEventHandlers();

      this.initialized = true;

      logger.info('[QueueService] All queues initialized successfully', {
        queues: ['qr-generation', 'blockchain-tx', 'email', 'reports'],
      });
    } catch (error) {
      const err = error as Error;
      logger.error('[QueueService] Failed to initialize queues', {
        error: err.message,
        stack: err.stack,
      });
      throw error;
    }
  }

  /**
   * Setup event handlers for all queues
   */
  private setupEventHandlers(): void {
    const queues = [
      { name: 'qr-generation', queue: this._qrQueue },
      { name: 'blockchain-tx', queue: this._blockchainQueue },
      { name: 'email', queue: this._emailQueue },
      { name: 'reports', queue: this._reportQueue },
    ];

    for (const { name, queue } of queues) {
      if (!queue) continue;

      queue.on('completed', (job: Job, result: unknown) => {
        const duration = job.finishedOn && job.processedOn
          ? job.finishedOn - job.processedOn
          : 0;

        logger.info(`[QueueService:${name}] Job completed`, {
          jobId: job.id,
          duration: `${duration}ms`,
        });
      });

      queue.on('failed', (job: Job, error: Error) => {
        logger.error(`[QueueService:${name}] Job failed`, {
          jobId: job.id,
          error: error.message,
          attempts: job.attemptsMade,
          maxAttempts: job.opts.attempts,
        });
      });

      queue.on('stalled', (job: Job) => {
        logger.warn(`[QueueService:${name}] Job stalled`, {
          jobId: job.id,
        });
      });

      queue.on('error', (error: Error) => {
        logger.error(`[QueueService:${name}] Queue error`, {
          error: error.message,
        });
      });

      queue.on('waiting', (jobId: string) => {
        logger.debug(`[QueueService:${name}] Job waiting`, { jobId });
      });

      queue.on('active', (job: Job) => {
        logger.debug(`[QueueService:${name}] Job active`, {
          jobId: job.id,
        });
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // JOB ADDITION METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Add QR code generation job
   *
   * @param data - QR job data
   * @param options - Optional job options
   * @returns Job instance
   */
  async addQRGenerationJob(
    data: QRJobData,
    options?: Partial<JobOptions>
  ): Promise<Job<QRJobData>> {
    this.ensureInitialized();

    const job = await this._qrQueue!.add(data, {
      jobId: `qr-${data.batchId}-${Date.now()}`,
      ...options,
    });

    logger.info('[QueueService] QR generation job added', {
      jobId: job.id,
      batchId: data.batchId,
    });

    return job;
  }

  /**
   * Add blockchain transaction job
   *
   * @param data - Blockchain job data
   * @param options - Optional job options
   * @returns Job instance
   */
  async addBlockchainJob(
    data: BlockchainJobData,
    options?: Partial<JobOptions>
  ): Promise<Job<BlockchainJobData>> {
    this.ensureInitialized();

    // Map priority to Bull priority (lower = higher priority)
    const priorityMap = { high: 1, normal: 5, low: 10 };
    const priority = priorityMap[data.priority || 'normal'];

    const job = await this._blockchainQueue!.add(data, {
      jobId: `bc-${data.type}-${data.batchId || data.eventId || data.producerId}-${Date.now()}`,
      priority,
      ...options,
    });

    logger.info('[QueueService] Blockchain job added', {
      jobId: job.id,
      type: data.type,
      priority: data.priority,
    });

    return job;
  }

  /**
   * Add email job
   *
   * @param data - Email job data
   * @param options - Optional job options
   * @returns Job instance
   */
  async addEmailJob(
    data: EmailJobData,
    options?: Partial<JobOptions>
  ): Promise<Job<EmailJobData>> {
    this.ensureInitialized();

    // Map priority
    const priorityMap = { high: 1, normal: 5, low: 10 };
    const priority = priorityMap[data.priority || 'normal'];

    const job = await this._emailQueue!.add(data, {
      priority,
      ...options,
    });

    logger.info('[QueueService] Email job added', {
      jobId: job.id,
      to: data.to,
      template: data.template,
      priority: data.priority,
    });

    return job;
  }

  /**
   * Add report generation job
   *
   * @param data - Report job data
   * @param options - Optional job options
   * @returns Job instance
   */
  async addReportJob(
    data: ReportJobData,
    options?: Partial<JobOptions>
  ): Promise<Job<ReportJobData>> {
    this.ensureInitialized();

    const job = await this._reportQueue!.add(data, {
      jobId: `report-${data.type}-${data.userId}-${Date.now()}`,
      ...options,
    });

    logger.info('[QueueService] Report job added', {
      jobId: job.id,
      type: data.type,
      format: data.format,
      userId: data.userId,
    });

    return job;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // HEALTH & MONITORING
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Get health status of all queues
   */
  async healthCheck(): Promise<QueueHealthStatus> {
    if (!this.initialized) {
      return {
        connected: false,
        queues: {
          qrGeneration: this.emptyStats('qr-generation'),
          blockchain: this.emptyStats('blockchain-tx'),
          email: this.emptyStats('email'),
          reports: this.emptyStats('reports'),
        },
        redis: {
          host: this.redisConfig.host,
          port: this.redisConfig.port,
          status: 'disconnected',
        },
      };
    }

    try {
      const [qrStats, bcStats, emailStats, reportStats] = await Promise.all([
        this.getQueueStats(this._qrQueue!, 'qr-generation'),
        this.getQueueStats(this._blockchainQueue!, 'blockchain-tx'),
        this.getQueueStats(this._emailQueue!, 'email'),
        this.getQueueStats(this._reportQueue!, 'reports'),
      ]);

      return {
        connected: true,
        queues: {
          qrGeneration: qrStats,
          blockchain: bcStats,
          email: emailStats,
          reports: reportStats,
        },
        redis: {
          host: this.redisConfig.host,
          port: this.redisConfig.port,
          status: 'connected',
        },
      };
    } catch (error) {
      const err = error as Error;
      logger.error('[QueueService] Health check failed', {
        error: err.message,
      });

      return {
        connected: false,
        queues: {
          qrGeneration: this.emptyStats('qr-generation'),
          blockchain: this.emptyStats('blockchain-tx'),
          email: this.emptyStats('email'),
          reports: this.emptyStats('reports'),
        },
        redis: {
          host: this.redisConfig.host,
          port: this.redisConfig.port,
          status: 'error',
        },
      };
    }
  }

  /**
   * Get statistics for a specific queue
   */
  private async getQueueStats(queue: Queue, name: string): Promise<QueueStats> {
    const [waiting, active, completed, failed, delayed, isPaused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused(),
    ]);

    return {
      name,
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused: isPaused,
    };
  }

  /**
   * Return empty stats for disconnected queues
   */
  private emptyStats(name: string): QueueStats {
    return {
      name,
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: true,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // QUEUE ACCESSORS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Get QR Generation Queue (for Bull Board and worker setup)
   */
  get qrQueue(): Queue<QRJobData> | null {
    return this._qrQueue;
  }

  /**
   * Get Blockchain Queue
   */
  get blockchainQueue(): Queue<BlockchainJobData> | null {
    return this._blockchainQueue;
  }

  /**
   * Get Email Queue
   */
  get emailQueue(): Queue<EmailJobData> | null {
    return this._emailQueue;
  }

  /**
   * Get Reports Queue
   */
  get reportQueue(): Queue<ReportJobData> | null {
    return this._reportQueue;
  }

  /**
   * Get all queues as array (for Bull Board)
   */
  getAllQueues(): Queue[] {
    const queues: Queue[] = [];
    if (this._qrQueue) queues.push(this._qrQueue);
    if (this._blockchainQueue) queues.push(this._blockchainQueue);
    if (this._emailQueue) queues.push(this._emailQueue);
    if (this._reportQueue) queues.push(this._reportQueue);
    return queues;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // LIFECYCLE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Pause all queues
   */
  async pauseAll(): Promise<void> {
    const queues = this.getAllQueues();
    await Promise.all(queues.map(q => q.pause()));
    logger.info('[QueueService] All queues paused');
  }

  /**
   * Resume all queues
   */
  async resumeAll(): Promise<void> {
    const queues = this.getAllQueues();
    await Promise.all(queues.map(q => q.resume()));
    logger.info('[QueueService] All queues resumed');
  }

  /**
   * Clean old jobs from all queues
   *
   * @param ageInHours - Remove jobs older than this (default: 24 hours)
   */
  async cleanAll(ageInHours: number = 24): Promise<void> {
    const queues = this.getAllQueues();
    const timestamp = ageInHours * 60 * 60 * 1000;

    await Promise.all(
      queues.flatMap(q => [
        q.clean(timestamp, 'completed'),
        q.clean(timestamp, 'failed'),
      ])
    );

    logger.info('[QueueService] All queues cleaned', { ageInHours });
  }

  /**
   * Graceful shutdown - close all queue connections
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) return;

    logger.info('[QueueService] Shutting down queues...');

    const queues = this.getAllQueues();
    await Promise.all(queues.map(q => q.close()));

    this._qrQueue = null;
    this._blockchainQueue = null;
    this._emailQueue = null;
    this._reportQueue = null;
    this.initialized = false;

    logger.info('[QueueService] Queue shutdown complete');
  }

  /**
   * Ensure service is initialized before use
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('QueueService not initialized. Call initialize() first.');
    }
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Export singleton instance
export const queueService = QueueService.getInstance();

export default queueService;
