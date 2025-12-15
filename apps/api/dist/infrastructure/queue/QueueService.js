import Bull from 'bull';
import logger from '../../shared/utils/logger.js';
export class QueueService {
    static instance = null;
    _qrQueue = null;
    _blockchainQueue = null;
    _emailQueue = null;
    _reportQueue = null;
    initialized = false;
    redisConfig;
    constructor() {
        this.redisConfig = {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
            password: process.env.REDIS_PASSWORD || undefined,
            db: parseInt(process.env.REDIS_QUEUE_DB || '1', 10),
        };
    }
    static getInstance() {
        if (!QueueService.instance) {
            QueueService.instance = new QueueService();
        }
        return QueueService.instance;
    }
    async initialize() {
        if (this.initialized) {
            logger.debug('[QueueService] Already initialized');
            return;
        }
        try {
            logger.info('[QueueService] Initializing queues...', {
                redis: `${this.redisConfig.host}:${this.redisConfig.port}`,
                db: this.redisConfig.db,
            });
            const defaultJobOptions = {
                attempts: parseInt(process.env.QUEUE_MAX_RETRIES || '3', 10),
                backoff: {
                    type: 'exponential',
                    delay: parseInt(process.env.QUEUE_RETRY_DELAY || '2000', 10),
                },
                removeOnComplete: 100,
                removeOnFail: 200,
            };
            this._qrQueue = new Bull('qr-generation', {
                redis: this.redisConfig,
                defaultJobOptions,
                settings: {
                    stalledInterval: 30000,
                    maxStalledCount: 2,
                },
            });
            this._blockchainQueue = new Bull('blockchain-tx', {
                redis: this.redisConfig,
                defaultJobOptions: {
                    ...defaultJobOptions,
                    attempts: 5,
                    timeout: 120000,
                },
                limiter: {
                    max: 10,
                    duration: 60000,
                },
                settings: {
                    stalledInterval: 60000,
                    maxStalledCount: 1,
                },
            });
            this._emailQueue = new Bull('email', {
                redis: this.redisConfig,
                defaultJobOptions,
                limiter: {
                    max: parseInt(process.env.EMAIL_RATE_LIMIT || '100', 10),
                    duration: 60000,
                },
            });
            this._reportQueue = new Bull('reports', {
                redis: this.redisConfig,
                defaultJobOptions: {
                    ...defaultJobOptions,
                    timeout: 300000,
                },
                settings: {
                    stalledInterval: 60000,
                    maxStalledCount: 1,
                },
            });
            this.setupEventHandlers();
            this.initialized = true;
            logger.info('[QueueService] All queues initialized successfully', {
                queues: ['qr-generation', 'blockchain-tx', 'email', 'reports'],
            });
        }
        catch (error) {
            const err = error;
            logger.error('[QueueService] Failed to initialize queues', {
                error: err.message,
                stack: err.stack,
            });
            throw error;
        }
    }
    setupEventHandlers() {
        const queues = [
            { name: 'qr-generation', queue: this._qrQueue },
            { name: 'blockchain-tx', queue: this._blockchainQueue },
            { name: 'email', queue: this._emailQueue },
            { name: 'reports', queue: this._reportQueue },
        ];
        for (const { name, queue } of queues) {
            if (!queue)
                continue;
            queue.on('completed', (job, result) => {
                const duration = job.finishedOn && job.processedOn
                    ? job.finishedOn - job.processedOn
                    : 0;
                logger.info(`[QueueService:${name}] Job completed`, {
                    jobId: job.id,
                    duration: `${duration}ms`,
                });
            });
            queue.on('failed', (job, error) => {
                logger.error(`[QueueService:${name}] Job failed`, {
                    jobId: job.id,
                    error: error.message,
                    attempts: job.attemptsMade,
                    maxAttempts: job.opts.attempts,
                });
            });
            queue.on('stalled', (job) => {
                logger.warn(`[QueueService:${name}] Job stalled`, {
                    jobId: job.id,
                });
            });
            queue.on('error', (error) => {
                logger.error(`[QueueService:${name}] Queue error`, {
                    error: error.message,
                });
            });
            queue.on('waiting', (jobId) => {
                logger.debug(`[QueueService:${name}] Job waiting`, { jobId });
            });
            queue.on('active', (job) => {
                logger.debug(`[QueueService:${name}] Job active`, {
                    jobId: job.id,
                });
            });
        }
    }
    async addQRGenerationJob(data, options) {
        this.ensureInitialized();
        const job = await this._qrQueue.add(data, {
            jobId: `qr-${data.batchId}-${Date.now()}`,
            ...options,
        });
        logger.info('[QueueService] QR generation job added', {
            jobId: job.id,
            batchId: data.batchId,
        });
        return job;
    }
    async addBlockchainJob(data, options) {
        this.ensureInitialized();
        const priorityMap = { high: 1, normal: 5, low: 10 };
        const priority = priorityMap[data.priority || 'normal'];
        const job = await this._blockchainQueue.add(data, {
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
    async addEmailJob(data, options) {
        this.ensureInitialized();
        const priorityMap = { high: 1, normal: 5, low: 10 };
        const priority = priorityMap[data.priority || 'normal'];
        const job = await this._emailQueue.add(data, {
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
    async addReportJob(data, options) {
        this.ensureInitialized();
        const job = await this._reportQueue.add(data, {
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
    async healthCheck() {
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
                this.getQueueStats(this._qrQueue, 'qr-generation'),
                this.getQueueStats(this._blockchainQueue, 'blockchain-tx'),
                this.getQueueStats(this._emailQueue, 'email'),
                this.getQueueStats(this._reportQueue, 'reports'),
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
        }
        catch (error) {
            const err = error;
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
    async getQueueStats(queue, name) {
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
    emptyStats(name) {
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
    get qrQueue() {
        return this._qrQueue;
    }
    get blockchainQueue() {
        return this._blockchainQueue;
    }
    get emailQueue() {
        return this._emailQueue;
    }
    get reportQueue() {
        return this._reportQueue;
    }
    getAllQueues() {
        const queues = [];
        if (this._qrQueue)
            queues.push(this._qrQueue);
        if (this._blockchainQueue)
            queues.push(this._blockchainQueue);
        if (this._emailQueue)
            queues.push(this._emailQueue);
        if (this._reportQueue)
            queues.push(this._reportQueue);
        return queues;
    }
    async pauseAll() {
        const queues = this.getAllQueues();
        await Promise.all(queues.map(q => q.pause()));
        logger.info('[QueueService] All queues paused');
    }
    async resumeAll() {
        const queues = this.getAllQueues();
        await Promise.all(queues.map(q => q.resume()));
        logger.info('[QueueService] All queues resumed');
    }
    async cleanAll(ageInHours = 24) {
        const queues = this.getAllQueues();
        const timestamp = ageInHours * 60 * 60 * 1000;
        await Promise.all(queues.flatMap(q => [
            q.clean(timestamp, 'completed'),
            q.clean(timestamp, 'failed'),
        ]));
        logger.info('[QueueService] All queues cleaned', { ageInHours });
    }
    async shutdown() {
        if (!this.initialized)
            return;
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
    ensureInitialized() {
        if (!this.initialized) {
            throw new Error('QueueService not initialized. Call initialize() first.');
        }
    }
    isInitialized() {
        return this.initialized;
    }
}
export const queueService = QueueService.getInstance();
export default queueService;
