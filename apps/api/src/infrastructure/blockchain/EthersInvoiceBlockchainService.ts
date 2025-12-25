/**
 * Ethers.js Invoice Blockchain Service Implementation
 * Handles invoice registration and verification on blockchain
 */

import { ethers } from 'ethers';
import {
  IInvoiceBlockchainService,
  InvoiceBlockchainData,
  InvoiceRegistrationResult,
  InvoiceVerificationResult,
} from '../../domain/services/IInvoiceBlockchainService.js';
import { logger } from '../logging/logger.js';

interface InvoiceBlockchainConfig {
  rpcUrl: string;
  chainId: number;
  privateKey: string;
  contractAddress: string;
  networkName: string;
}

// InvoiceRegistry Contract ABI (simplified)
const INVOICE_REGISTRY_ABI = [
  'function registerInvoice(bytes32 invoiceHash, string uuid, string folio, address producer, uint256 total, string currency, uint256 issuedAt) returns (bool)',
  'function getInvoice(bytes32 invoiceHash) view returns (tuple(bytes32 invoiceHash, string uuid, string folio, address producer, uint256 total, string currency, uint256 issuedAt, uint256 registeredAt, bool exists))',
  'function isInvoiceRegistered(bytes32 invoiceHash) view returns (bool)',
  'event InvoiceRegistered(bytes32 indexed invoiceHash, string uuid, string folio, address indexed producer, uint256 total, uint256 timestamp)',
];

// P1-7 FIX: Fallback status when blockchain is unavailable
export const BLOCKCHAIN_STATUS = {
  CONFIRMED: 'CONFIRMED',
  PENDING: 'PENDING',
  UNAVAILABLE: 'BLOCKCHAIN_UNAVAILABLE',
  FAILED: 'FAILED',
} as const;

export class EthersInvoiceBlockchainService implements IInvoiceBlockchainService {
  private provider: ethers.providers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contract: ethers.Contract;
  private readonly networkName: string;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 2000;
  private readonly GAS_LIMIT_BUFFER = 1.2;
  private readonly REQUIRED_CONFIRMATIONS = 1;
  // P1-7 FIX: Add timeout to prevent hanging
  private readonly RPC_TIMEOUT_MS = 30000; // 30 seconds

  constructor(config: InvoiceBlockchainConfig) {
    this.networkName = config.networkName;

    this.provider = new ethers.providers.JsonRpcProvider(
      config.rpcUrl,
      config.chainId
    );

    this.wallet = new ethers.Wallet(config.privateKey, this.provider);

    this.contract = new ethers.Contract(
      config.contractAddress,
      INVOICE_REGISTRY_ABI,
      this.wallet
    );

    logger.info('EthersInvoiceBlockchainService initialized', {
      network: this.networkName,
      contractAddress: config.contractAddress,
    });
  }

  /**
   * Generates a keccak256 hash of invoice data for blockchain registration.
   * @param data - Invoice data to hash
   * @returns Hex-encoded hash string
   */
  hashInvoice(data: InvoiceBlockchainData): string {
    const encoded = ethers.utils.defaultAbiCoder.encode(
      ['string', 'string', 'string', 'string', 'uint256', 'string', 'uint256'],
      [
        data.uuid,
        data.folio,
        data.producerId,
        data.recipientRfc,
        Math.round(data.total * 100), // Convert to cents
        data.currency,
        Math.floor(data.issuedAt.getTime() / 1000),
      ]
    );
    return ethers.utils.keccak256(encoded);
  }

  /**
   * P1-7 FIX: Timeout wrapper for RPC calls
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number = this.RPC_TIMEOUT_MS): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`RPC timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId!);
      return result;
    } catch (error) {
      clearTimeout(timeoutId!);
      throw error;
    }
  }

  /**
   * P1-7 FIX: Notify admin of blockchain failure
   */
  private async notifyBlockchainFailure(type: string, id: string, error: any): Promise<void> {
    // Log critical error for monitoring systems (Sentry, CloudWatch, etc.)
    logger.error('🚨 BLOCKCHAIN FAILURE ALERT', {
      type,
      id,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      network: this.networkName,
      action: 'REQUIRES_RETRY',
    });

    // TODO: In production, send to Slack/PagerDuty/Email
    // await slackClient.sendAlert({ ... });
  }

  /**
   * Registers an invoice on the blockchain with retry logic.
   * P1-7 FIX: Returns fallback result instead of throwing when blockchain unavailable
   * @param data - Invoice data to register
   * @returns Registration result with transaction hash and blockchain hash
   */
  async registerInvoice(
    data: InvoiceBlockchainData
  ): Promise<InvoiceRegistrationResult> {
    const invoiceHash = this.hashInvoice(data);

    try {
      // P1-7 FIX: Wrap in timeout to prevent hanging
      return await this.withTimeout(this.executeWithRetry(async () => {
        logger.info('Registering invoice on blockchain', {
          uuid: data.uuid,
          folio: data.folio,
          invoiceHash,
        });

        // Estimate gas
        const estimatedGas = await this.contract.registerInvoice.estimateGas(
          invoiceHash,
          data.uuid,
          data.folio,
          this.wallet.address, // Use wallet as producer address
          Math.round(data.total * 100),
          data.currency,
          Math.floor(data.issuedAt.getTime() / 1000)
        );
        const gasLimit = Math.ceil(Number(estimatedGas) * this.GAS_LIMIT_BUFFER);

        // Get fee data
        const feeData = await this.provider.getFeeData();

        // Send transaction
        const tx = await this.contract.registerInvoice(
          invoiceHash,
          data.uuid,
          data.folio,
          this.wallet.address,
          Math.round(data.total * 100),
          data.currency,
          Math.floor(data.issuedAt.getTime() / 1000),
          {
            gasLimit,
            maxFeePerGas: feeData.maxFeePerGas,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
          }
        );

        logger.info('Invoice registration transaction sent', {
          txHash: tx.hash,
          uuid: data.uuid,
        });

        // Wait for confirmation
        const receipt = await tx.wait(this.REQUIRED_CONFIRMATIONS);

        if (!receipt || receipt.status !== 1) {
          throw new Error('Transaction failed');
        }

        logger.info('Invoice registered successfully', {
          txHash: receipt.hash,
          gasUsed: receipt.gasUsed.toString(),
          uuid: data.uuid,
        });

        return {
          success: true,
          txHash: receipt.hash,
          blockchainHash: invoiceHash,
          network: this.networkName,
          timestamp: new Date(),
          gasUsed: receipt.gasUsed.toString(),
        };
      }));
    } catch (error: any) {
      // P1-7 FIX: Return fallback result instead of throwing
      await this.notifyBlockchainFailure('invoice', data.uuid, error);

      logger.warn('Blockchain registration failed, returning fallback', {
        uuid: data.uuid,
        error: error.message,
      });

      // Return fallback - invoice is still created, blockchain pending
      return {
        success: false,
        txHash: null,
        blockchainHash: invoiceHash,
        network: this.networkName,
        timestamp: new Date(),
        gasUsed: null,
        status: BLOCKCHAIN_STATUS.UNAVAILABLE,
        error: 'Blockchain temporarily unavailable. Invoice created, verification pending.',
      };
    }
  }

  /**
   * Verifies an invoice exists on the blockchain and matches expected data.
   * @param uuid - Invoice UUID to verify
   * @param expectedHash - Expected blockchain hash of the invoice
   * @returns Verification result with registration details
   */
  async verifyInvoice(
    uuid: string,
    expectedHash: string
  ): Promise<InvoiceVerificationResult> {
    try {
      const isRegistered = await this.contract.isInvoiceRegistered(expectedHash);

      if (!isRegistered) {
        return {
          isVerified: false,
          blockchainHash: null,
          txHash: null,
          registeredAt: null,
          network: null,
        };
      }

      const invoiceData = await this.contract.getInvoice(expectedHash);

      return {
        isVerified: invoiceData.exists && invoiceData.uuid === uuid,
        blockchainHash: expectedHash,
        txHash: null, // Would need event logs to get original txHash
        registeredAt: new Date(Number(invoiceData.registeredAt) * 1000),
        network: this.networkName,
      };
    } catch (error: any) {
      logger.error('Failed to verify invoice on blockchain', {
        error: error.message,
        uuid,
      });

      return {
        isVerified: false,
        blockchainHash: null,
        txHash: null,
        registeredAt: null,
        network: null,
      };
    }
  }

  /**
   * Checks if the blockchain connection is healthy.
   * @returns True if connected and able to fetch block number
   */
  async isHealthy(): Promise<boolean> {
    try {
      const blockNumber = await this.provider.getBlockNumber();
      return blockNumber > 0;
    } catch {
      return false;
    }
  }

  /**
   * Executes a function with exponential backoff retry logic.
   * @param fn - Async function to execute
   * @param attempt - Current attempt number (default: 1)
   * @returns Result of the function execution
   * @throws Error if max retries exceeded
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    attempt = 1
  ): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      if (attempt >= this.MAX_RETRIES) {
        logger.error('Max retries reached for blockchain operation', {
          attempt,
          error: error.message,
        });
        throw error;
      }

      const delay = this.RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      logger.warn('Retrying blockchain operation', {
        attempt,
        delay,
        error: error.message,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.executeWithRetry(fn, attempt + 1);
    }
  }
}
