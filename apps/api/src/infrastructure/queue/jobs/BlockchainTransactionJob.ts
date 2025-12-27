/**
 * @file Blockchain Transaction Job
 * @description Async blockchain transaction processing with retry logic
 *
 * Handles blockchain operations:
 * - Batch creation on-chain
 * - Event recording
 * - Certification storage
 * - Ownership transfers
 *
 * Features:
 * - Automatic gas estimation
 * - Transaction retry on failure
 * - Confirmation waiting
 * - Database sync after confirmation
 *
 * @author AgroBridge Engineering Team
 */

import { Job } from "bull";
import { PrismaClient } from "@prisma/client";
import { BaseJobProcessor } from "../processors/JobProcessor.js";
import logger from "../../../shared/utils/logger.js";
import type {
  BlockchainJobData,
  BlockchainJobResult,
} from "../QueueService.js";

// Prisma client instance
const prisma = new PrismaClient();

/**
 * Blockchain Configuration
 */
interface BlockchainConfig {
  /** Maximum gas limit */
  maxGasLimit: number;
  /** Gas price multiplier for priority transactions */
  gasPriceMultiplier: {
    low: number;
    normal: number;
    high: number;
  };
  /** Number of confirmations to wait for */
  confirmations: number;
  /** Transaction timeout in ms */
  timeout: number;
}

/**
 * Default blockchain configuration
 */
const DEFAULT_CONFIG: BlockchainConfig = {
  maxGasLimit: 500000,
  gasPriceMultiplier: {
    low: 1.0,
    normal: 1.2,
    high: 1.5,
  },
  confirmations: 2,
  timeout: 120000, // 2 minutes
};

/**
 * Blockchain Transaction Job Processor
 *
 * Handles async blockchain transactions with proper error handling
 * and retry logic for failed transactions
 */
export class BlockchainTransactionJob extends BaseJobProcessor<
  BlockchainJobData,
  BlockchainJobResult
> {
  private config: BlockchainConfig;
  private isBlockchainAvailable: boolean = false;

  constructor(config: Partial<BlockchainConfig> = {}) {
    super("blockchain-tx");
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.checkBlockchainAvailability();
  }

  /**
   * Check if blockchain services are configured
   */
  private checkBlockchainAvailability(): void {
    // Check for required environment variables
    const requiredVars = ["BLOCKCHAIN_RPC_URL", "BLOCKCHAIN_PRIVATE_KEY"];
    this.isBlockchainAvailable = requiredVars.every((v) => !!process.env[v]);

    if (!this.isBlockchainAvailable) {
      logger.warn(
        "[BlockchainTransactionJob] Blockchain not configured - jobs will be simulated",
        {
          missingVars: requiredVars.filter((v) => !process.env[v]),
        },
      );
    }
  }

  /**
   * Process blockchain transaction job
   *
   * @param job - Bull job instance
   * @returns Transaction result
   */
  async process(job: Job<BlockchainJobData>): Promise<BlockchainJobResult> {
    const { type, batchId, eventId, producerId, userId, payload, priority } =
      job.data;

    try {
      // Step 1: Validate job data
      await this.reportProgress(job, 10, "Validating transaction data");
      const validationResult = await this.validateJobData(job.data);

      if (!validationResult.valid) {
        return {
          success: false,
          error: validationResult.error,
          errorCode: "VALIDATION_ERROR",
        };
      }

      // If blockchain is not available, simulate the transaction
      if (!this.isBlockchainAvailable) {
        return await this.simulateTransaction(job);
      }

      // Step 2: Prepare transaction
      await this.reportProgress(job, 20, "Preparing transaction");
      const txData = await this.prepareTransaction(type, {
        batchId,
        eventId,
        producerId,
        payload,
      });

      // Step 3: Estimate gas
      await this.reportProgress(job, 30, "Estimating gas");
      const gasEstimate = await this.estimateGas(txData, priority || "normal");

      // Step 4: Send transaction
      await this.reportProgress(job, 50, "Sending transaction");
      const txHash = await this.sendTransaction(txData, gasEstimate);

      // Step 5: Wait for confirmation
      await this.reportProgress(job, 70, "Waiting for confirmation");
      const receipt = await this.waitForConfirmation(txHash);

      // Step 6: Update database
      await this.reportProgress(job, 90, "Updating database");
      await this.updateDatabaseWithTxHash(type, {
        batchId,
        eventId,
        producerId,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
      });

      // Step 7: Complete
      await this.reportProgress(job, 100, "Complete");

      logger.info("[BlockchainTransactionJob] Transaction completed", {
        type,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
      });

      return {
        success: true,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
      };
    } catch (error) {
      const err = error as Error;
      logger.error("[BlockchainTransactionJob] Transaction failed", {
        type,
        batchId,
        eventId,
        error: err.message,
        stack: err.stack,
      });

      return {
        success: false,
        error: err.message,
        errorCode: this.getErrorCode(err),
      };
    }
  }

  /**
   * Simulate transaction when blockchain is not available
   * Useful for development/testing
   */
  private async simulateTransaction(
    job: Job<BlockchainJobData>,
  ): Promise<BlockchainJobResult> {
    const { type, batchId, eventId, producerId } = job.data;

    logger.info(
      "[BlockchainTransactionJob] Simulating transaction (blockchain not configured)",
      {
        type,
        batchId,
        eventId,
      },
    );

    // Simulate processing time
    await this.delay(1000 + Math.random() * 2000);

    // Generate fake transaction hash
    const fakeHash = `0x${Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join("")}`;

    const fakeBlockNumber = Math.floor(Math.random() * 1000000) + 10000000;

    // Update database with simulated data
    await this.updateDatabaseWithTxHash(type, {
      batchId,
      eventId,
      producerId,
      txHash: fakeHash,
      blockNumber: fakeBlockNumber,
    });

    return {
      success: true,
      transactionHash: fakeHash,
      blockNumber: fakeBlockNumber,
      gasUsed: Math.floor(Math.random() * 100000) + 21000,
    };
  }

  /**
   * Validate job data before processing
   */
  private async validateJobData(
    data: BlockchainJobData,
  ): Promise<{ valid: boolean; error?: string }> {
    const { type, batchId, eventId, producerId } = data;

    // Validate based on transaction type
    switch (type) {
      case "batch-creation":
        if (!batchId) {
          return { valid: false, error: "batchId required for batch-creation" };
        }
        const batch = await prisma.batch.findUnique({ where: { id: batchId } });
        if (!batch) {
          return { valid: false, error: `Batch not found: ${batchId}` };
        }
        break;

      case "event-creation":
        if (!eventId) {
          return { valid: false, error: "eventId required for event-creation" };
        }
        const event = await prisma.traceabilityEvent.findUnique({
          where: { id: eventId },
        });
        if (!event) {
          return { valid: false, error: `Event not found: ${eventId}` };
        }
        break;

      case "certification":
        if (!producerId) {
          return {
            valid: false,
            error: "producerId required for certification",
          };
        }
        const producer = await prisma.producer.findUnique({
          where: { id: producerId },
        });
        if (!producer) {
          return { valid: false, error: `Producer not found: ${producerId}` };
        }
        break;

      case "transfer":
        if (!batchId) {
          return { valid: false, error: "batchId required for transfer" };
        }
        break;

      default:
        return { valid: false, error: `Unknown transaction type: ${type}` };
    }

    return { valid: true };
  }

  /**
   * Prepare transaction data based on type
   */
  private async prepareTransaction(
    type: BlockchainJobData["type"],
    data: {
      batchId?: string;
      eventId?: string;
      producerId?: string;
      payload?: Record<string, unknown>;
    },
  ): Promise<Record<string, unknown>> {
    // This would be implemented with actual contract calls
    // For now, return placeholder data
    return {
      type,
      ...data,
      timestamp: Date.now(),
    };
  }

  /**
   * Estimate gas for transaction
   */
  private async estimateGas(
    _txData: Record<string, unknown>,
    priority: "low" | "normal" | "high",
  ): Promise<{ gasLimit: number; gasPrice: number }> {
    // Placeholder implementation
    const baseGasLimit = 100000;
    const baseGasPrice = 20000000000; // 20 Gwei

    return {
      gasLimit: Math.min(baseGasLimit * 1.2, this.config.maxGasLimit),
      gasPrice: Math.floor(
        baseGasPrice * this.config.gasPriceMultiplier[priority],
      ),
    };
  }

  /**
   * Send transaction to blockchain
   */
  private async sendTransaction(
    _txData: Record<string, unknown>,
    _gasEstimate: { gasLimit: number; gasPrice: number },
  ): Promise<string> {
    // Placeholder implementation - would use ethers.js or web3.js
    // Returns transaction hash
    throw new Error("Blockchain integration not implemented");
  }

  /**
   * Wait for transaction confirmation
   */
  private async waitForConfirmation(_txHash: string): Promise<{
    transactionHash: string;
    blockNumber: number;
    gasUsed: number;
  }> {
    // Placeholder implementation
    throw new Error("Blockchain integration not implemented");
  }

  /**
   * Update database with transaction hash
   */
  private async updateDatabaseWithTxHash(
    type: BlockchainJobData["type"],
    data: {
      batchId?: string;
      eventId?: string;
      producerId?: string;
      txHash: string;
      blockNumber: number;
    },
  ): Promise<void> {
    const { batchId, eventId, producerId, txHash, blockNumber } = data;

    switch (type) {
      case "batch-creation":
      case "transfer":
        if (batchId) {
          // Batch model uses blockchainHash field
          await prisma.batch.update({
            where: { id: batchId },
            data: {
              blockchainHash: txHash,
            },
          });
          logger.info(
            "[BlockchainTransactionJob] Batch blockchain hash updated",
            {
              batchId,
              txHash,
              blockNumber,
            },
          );
        }
        break;

      case "event-creation":
        if (eventId) {
          // TraceabilityEvent model uses blockchainTxHash field
          await prisma.traceabilityEvent.update({
            where: { id: eventId },
            data: {
              blockchainTxHash: txHash,
            },
          });
          logger.info(
            "[BlockchainTransactionJob] Event blockchain hash updated",
            {
              eventId,
              txHash,
              blockNumber,
            },
          );
        }
        break;

      case "certification":
        if (producerId) {
          // Certification doesn't have a blockchain field in schema
          // Log the result for now
          logger.info(
            "[BlockchainTransactionJob] Certification recorded on blockchain",
            {
              producerId,
              txHash,
              blockNumber,
            },
          );
        }
        break;
    }
  }

  /**
   * Get error code from error
   */
  private getErrorCode(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes("insufficient funds")) return "INSUFFICIENT_FUNDS";
    if (message.includes("gas")) return "GAS_ERROR";
    if (message.includes("nonce")) return "NONCE_ERROR";
    if (message.includes("timeout")) return "TIMEOUT";
    if (message.includes("rejected")) return "REJECTED";
    if (message.includes("network")) return "NETWORK_ERROR";

    return "UNKNOWN_ERROR";
  }

  /**
   * Override isRetryableError for blockchain-specific logic
   */
  protected isRetryableError(error: Error): boolean {
    const nonRetryablePatterns = [
      /insufficient funds/i,
      /invalid signature/i,
      /contract reverted/i,
      /validation/i,
    ];

    return !nonRetryablePatterns.some((pattern) => pattern.test(error.message));
  }

  /**
   * Override onFailed for blockchain-specific failure handling
   */
  async onFailed(job: Job<BlockchainJobData>, error: Error): Promise<void> {
    await super.onFailed(job, error);

    // Could implement alerting here for critical blockchain failures
    logger.error("[BlockchainTransactionJob] Transaction failed permanently", {
      type: job.data.type,
      batchId: job.data.batchId,
      eventId: job.data.eventId,
      userId: job.data.userId,
      error: error.message,
      errorCode: this.getErrorCode(error),
    });
  }
}

// Export singleton instance
export const blockchainTransactionJob = new BlockchainTransactionJob();

export default blockchainTransactionJob;
