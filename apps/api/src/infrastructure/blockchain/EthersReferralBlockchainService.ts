/**
 * Ethers.js Referral Blockchain Service Implementation
 * Handles referral registration and verification on blockchain
 */

import { ethers } from 'ethers';
import {
  IReferralBlockchainService,
  ReferralBlockchainData,
  ReferralRegistrationResult,
  ReferralRewardData,
  ReferralRewardResult,
  ReferralVerificationResult,
} from '../../domain/services/IReferralBlockchainService.js';
import { logger } from '../logging/logger.js';
import { BLOCKCHAIN_STATUS } from './EthersInvoiceBlockchainService.js';

interface ReferralBlockchainConfig {
  rpcUrl: string;
  chainId: number;
  privateKey: string;
  contractAddress: string;
  networkName: string;
}

// ReferralProgram Contract ABI (simplified)
const REFERRAL_PROGRAM_ABI = [
  'function registerReferral(bytes32 referralId, address referrer, address referred, string referralCode, uint256 appliedAt) returns (bytes32 eventId)',
  'function recordReward(bytes32 referralId, string rewardType, uint256 amount, string currency, uint256 rewardedAt) returns (bytes32 eventId)',
  'function getReferral(bytes32 referralId) view returns (tuple(bytes32 referralId, address referrer, address referred, string referralCode, uint256 appliedAt, bool rewarded, uint256 rewardAmount, uint256 registeredAt, bool exists))',
  'function isReferralRegistered(bytes32 referralId) view returns (bool)',
  'event ReferralRegistered(bytes32 indexed referralId, address indexed referrer, address indexed referred, string referralCode, uint256 timestamp)',
  'event RewardRecorded(bytes32 indexed referralId, string rewardType, uint256 amount, uint256 timestamp)',
];

export class EthersReferralBlockchainService implements IReferralBlockchainService {
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

  constructor(config: ReferralBlockchainConfig) {
    this.networkName = config.networkName;

    this.provider = new ethers.providers.JsonRpcProvider(
      config.rpcUrl,
      config.chainId
    );

    this.wallet = new ethers.Wallet(config.privateKey, this.provider);

    this.contract = new ethers.Contract(
      config.contractAddress,
      REFERRAL_PROGRAM_ABI,
      this.wallet
    );

    logger.info('EthersReferralBlockchainService initialized', {
      network: this.networkName,
      contractAddress: config.contractAddress,
    });
  }

  /**
   * Generates a keccak256 hash of the referral ID for blockchain storage.
   * @param referralId - The referral ID to hash
   * @returns Hex-encoded hash string
   */
  private hashReferralId(referralId: string): string {
    return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(referralId));
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
   * Registers a referral on the blockchain with retry logic.
   * P1-7 FIX: Returns fallback result instead of throwing when blockchain unavailable
   * @param data - Referral data including referral code and timestamps
   * @returns Registration result with transaction hash and event ID
   * @throws Error if max retries exceeded or transaction fails
   */
  async registerReferral(
    data: ReferralBlockchainData
  ): Promise<ReferralRegistrationResult> {
    const referralIdHash = this.hashReferralId(data.referralId);

    try {
      // P1-7 FIX: Wrap in timeout to prevent hanging
      return await this.withTimeout(this.executeWithRetry(async () => {
        logger.info('Registering referral on blockchain', {
          referralId: data.referralId,
          referralCode: data.referralCode,
        });

        // Estimate gas
        const estimatedGas = await this.contract.registerReferral.estimateGas(
          referralIdHash,
          this.wallet.address, // Use wallet as referrer address placeholder
          this.wallet.address, // Use wallet as referred address placeholder
          data.referralCode,
          Math.floor(data.appliedAt.getTime() / 1000)
        );
        const gasLimit = Math.ceil(Number(estimatedGas) * this.GAS_LIMIT_BUFFER);

        // Get fee data
        const feeData = await this.provider.getFeeData();

        // Send transaction
        const tx = await this.contract.registerReferral(
          referralIdHash,
          this.wallet.address,
          this.wallet.address,
          data.referralCode,
          Math.floor(data.appliedAt.getTime() / 1000),
          {
            gasLimit,
            maxFeePerGas: feeData.maxFeePerGas,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
          }
        );

        logger.info('Referral registration transaction sent', {
          txHash: tx.hash,
          referralId: data.referralId,
        });

        // Wait for confirmation
        const receipt = await tx.wait(this.REQUIRED_CONFIRMATIONS);

        if (!receipt || receipt.status !== 1) {
          throw new Error('Transaction failed');
        }

        // Parse event to get eventId
        const eventLog = receipt.logs.find((log: any) => {
          try {
            const parsedLog = this.contract.interface.parseLog(log);
            return parsedLog?.name === 'ReferralRegistered';
          } catch {
            return false;
          }
        });

        let eventId = '';
        if (eventLog) {
          const parsed = this.contract.interface.parseLog(eventLog);
          eventId = parsed?.args[0]; // First argument is referralId (eventId)
        }

        logger.info('Referral registered successfully', {
          txHash: receipt.hash,
          eventId,
          gasUsed: receipt.gasUsed.toString(),
        });

        return {
          success: true,
          txHash: receipt.hash,
          eventId: eventId || referralIdHash,
          network: this.networkName,
          timestamp: new Date(),
          gasUsed: receipt.gasUsed.toString(),
        };
      }));
    } catch (error: any) {
      // P1-7 FIX: Return fallback result instead of throwing
      await this.notifyBlockchainFailure('referral', data.referralId, error);

      logger.warn('Blockchain referral registration failed, returning fallback', {
        referralId: data.referralId,
        error: error.message,
      });

      // Return fallback - referral is still created, blockchain pending
      return {
        success: false,
        txHash: null,
        eventId: referralIdHash,
        network: this.networkName,
        timestamp: new Date(),
        gasUsed: null,
        status: BLOCKCHAIN_STATUS.UNAVAILABLE,
        error: 'Blockchain temporarily unavailable. Referral created, verification pending.',
      };
    }
  }

  /**
   * Records a referral reward on the blockchain.
   * P1-7 FIX: Returns fallback result instead of throwing when blockchain unavailable
   * @param data - Reward data including type, amount, and currency
   * @returns Result with transaction hash and event ID
   */
  async recordReferralReward(
    data: ReferralRewardData
  ): Promise<ReferralRewardResult> {
    const referralIdHash = this.hashReferralId(data.referralId);

    try {
      // P1-7 FIX: Wrap in timeout to prevent hanging
      return await this.withTimeout(this.executeWithRetry(async () => {
        logger.info('Recording referral reward on blockchain', {
          referralId: data.referralId,
          rewardType: data.rewardType,
          amount: data.rewardAmount,
        });

        // Estimate gas
        const estimatedGas = await this.contract.recordReward.estimateGas(
          referralIdHash,
          data.rewardType,
          Math.round(data.rewardAmount * 100), // Convert to cents
          data.currency,
          Math.floor(data.rewardedAt.getTime() / 1000)
        );
        const gasLimit = Math.ceil(Number(estimatedGas) * this.GAS_LIMIT_BUFFER);

        // Get fee data
        const feeData = await this.provider.getFeeData();

        // Send transaction
        const tx = await this.contract.recordReward(
          referralIdHash,
          data.rewardType,
          Math.round(data.rewardAmount * 100),
          data.currency,
          Math.floor(data.rewardedAt.getTime() / 1000),
          {
            gasLimit,
            maxFeePerGas: feeData.maxFeePerGas,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
          }
        );

        logger.info('Reward recording transaction sent', {
          txHash: tx.hash,
          referralId: data.referralId,
        });

        // Wait for confirmation
        const receipt = await tx.wait(this.REQUIRED_CONFIRMATIONS);

        if (!receipt || receipt.status !== 1) {
          throw new Error('Transaction failed');
        }

        // Parse event to get eventId
        const eventLog = receipt.logs.find((log: any) => {
          try {
            const parsedLog = this.contract.interface.parseLog(log);
            return parsedLog?.name === 'RewardRecorded';
          } catch {
            return false;
          }
        });

        let eventId = '';
        if (eventLog) {
          const parsed = this.contract.interface.parseLog(eventLog);
          eventId = parsed?.args[0];
        }

        logger.info('Referral reward recorded successfully', {
          txHash: receipt.hash,
          eventId,
          gasUsed: receipt.gasUsed.toString(),
        });

        return {
          success: true,
          txHash: receipt.hash,
          eventId: eventId || referralIdHash,
          network: this.networkName,
          timestamp: new Date(),
        };
      }));
    } catch (error: any) {
      // P1-7 FIX: Return fallback result instead of throwing
      await this.notifyBlockchainFailure('reward', data.referralId, error);

      logger.warn('Blockchain reward recording failed, returning fallback', {
        referralId: data.referralId,
        error: error.message,
      });

      // Return fallback - reward is still recorded, blockchain pending
      return {
        success: false,
        txHash: null,
        eventId: referralIdHash,
        network: this.networkName,
        timestamp: new Date(),
        status: BLOCKCHAIN_STATUS.UNAVAILABLE,
        error: 'Blockchain temporarily unavailable. Reward recorded, verification pending.',
      };
    }
  }

  /**
   * Verifies a referral exists on the blockchain.
   * @param referralId - The referral ID to verify
   * @returns Verification result with registration details
   */
  async verifyReferral(referralId: string): Promise<ReferralVerificationResult> {
    try {
      const referralIdHash = this.hashReferralId(referralId);
      const isRegistered = await this.contract.isReferralRegistered(referralIdHash);

      if (!isRegistered) {
        return {
          isVerified: false,
          txHash: null,
          eventId: null,
          registeredAt: null,
          network: null,
        };
      }

      const referralData = await this.contract.getReferral(referralIdHash);

      return {
        isVerified: referralData.exists,
        txHash: null, // Would need event logs to get original txHash
        eventId: referralIdHash,
        registeredAt: new Date(Number(referralData.registeredAt) * 1000),
        network: this.networkName,
      };
    } catch (error: any) {
      logger.error('Failed to verify referral on blockchain', {
        error: error.message,
        referralId,
      });

      return {
        isVerified: false,
        txHash: null,
        eventId: null,
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
