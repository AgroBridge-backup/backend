/**
 * @file Queue Module Index
 * @description Central export point for the background job queue system
 *
 * This module provides:
 * - QueueService: Main service for managing all queues
 * - Job Processors: Handlers for each job type
 * - Type definitions: Job data and result interfaces
 *
 * Usage:
 * ```typescript
 * import { queueService, QRJobData } from './infrastructure/queue';
 *
 * // Add a job
 * await queueService.addQRGenerationJob({
 *   batchId: 'batch-123',
 *   data: 'https://trace.agrobridge.io/batch-123',
 *   userId: 'user-456',
 * });
 *
 * // Check health
 * const health = await queueService.healthCheck();
 * ```
 *
 * @author AgroBridge Engineering Team
 */

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

import {
  QueueService,
  queueService as queueServiceInstance,
  type QRJobData,
  type QRJobResult,
  type BlockchainJobData,
  type BlockchainJobResult,
  type EmailJobData,
  type EmailJobResult,
  type ReportJobData,
  type ReportJobResult,
  type QueueHealthStatus,
  type QueueStats,
} from './QueueService.js';

// Re-export with explicit names
export {
  QueueService,
  type QRJobData,
  type QRJobResult,
  type BlockchainJobData,
  type BlockchainJobResult,
  type EmailJobData,
  type EmailJobResult,
  type ReportJobData,
  type ReportJobResult,
  type QueueHealthStatus,
  type QueueStats,
};

// Export singleton instance
export const queueService = queueServiceInstance;

// ═══════════════════════════════════════════════════════════════════════════════
// JOB PROCESSORS
// ═══════════════════════════════════════════════════════════════════════════════

export {
  QRCodeGenerationJob,
  qrCodeGenerationJob,
} from './jobs/QRCodeGenerationJob.js';

export {
  BlockchainTransactionJob,
  blockchainTransactionJob,
} from './jobs/BlockchainTransactionJob.js';

export {
  EmailJob,
  emailJob,
} from './jobs/EmailJob.js';

export {
  ReportGenerationJob,
  reportGenerationJob,
} from './jobs/ReportGenerationJob.js';

// ═══════════════════════════════════════════════════════════════════════════════
// BASE PROCESSOR
// ═══════════════════════════════════════════════════════════════════════════════

export {
  BaseJobProcessor,
  createProcessorFunction,
  type JobProcessor,
  type JobContext,
} from './processors/JobProcessor.js';

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export default queueService;
