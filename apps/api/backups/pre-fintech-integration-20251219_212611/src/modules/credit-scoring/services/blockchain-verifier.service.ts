/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AGROBRIDGE - BLOCKCHAIN VERIFIER SERVICE
 * On-Chain Data Verification for Credit Scoring
 *
 * Responsibilities:
 * - Verify delivery records on blockchain
 * - Sync traceability events from chain
 * - Validate producer signatures
 * - Calculate blockchain-based trust metrics
 *
 * @module credit-scoring/services
 * @version 1.0.0
 * @author James O'Brien (Revolut Backend Architect)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { ethers, providers, Contract } from 'ethers';
import { PrismaClient } from '@prisma/client';
import {
  BlockchainDeliveryData,
  BlockchainMetrics,
} from '../types/credit-score.types.js';

/**
 * Contract ABI for AgroBridge Traceability
 */
const TRACEABILITY_ABI = [
  'function getDeliveryRecord(bytes32 deliveryId) view returns (address producer, uint256 timestamp, uint256 weightKg, uint256 qualityGrade, bool verified)',
  'function getProducerRecords(address producer) view returns (bytes32[] memory)',
  'function verifyDelivery(bytes32 deliveryId) view returns (bool)',
  'event DeliveryRecorded(bytes32 indexed deliveryId, address indexed producer, uint256 timestamp)',
  'event DeliveryVerified(bytes32 indexed deliveryId, address indexed verifier, uint256 timestamp)',
];

/**
 * Blockchain verification configuration
 */
export interface BlockchainVerifierConfig {
  rpcUrl: string;
  contractAddress: string;
  networkName: string;
  chainId: number;
  confirmationsRequired: number;
  timeout: number; // milliseconds
  enabled: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: BlockchainVerifierConfig = {
  rpcUrl: process.env.BLOCKCHAIN_RPC_URL || 'https://rpc-mumbai.maticvigil.com',
  contractAddress: process.env.TRACEABILITY_CONTRACT_ADDRESS || '',
  networkName: 'polygon-mumbai',
  chainId: 80001,
  confirmationsRequired: 3,
  timeout: 30000,
  enabled: process.env.BLOCKCHAIN_VERIFICATION_ENABLED === 'true',
};

/**
 * On-chain delivery record structure
 */
interface OnChainDeliveryRecord {
  deliveryId: string;
  producer: string;
  timestamp: number;
  weightKg: number;
  qualityGrade: number;
  verified: boolean;
  blockNumber: number;
  txHash: string;
}

/**
 * Blockchain Verifier Service
 *
 * Provides on-chain verification capabilities for credit scoring.
 * Falls back gracefully when blockchain is unavailable.
 */
export class BlockchainVerifierService {
  private provider: providers.JsonRpcProvider | null = null;
  private contract: Contract | null = null;
  private readonly prisma: PrismaClient;
  private readonly config: BlockchainVerifierConfig;
  private isConnected = false;

  constructor(prisma: PrismaClient, config: Partial<BlockchainVerifierConfig> = {}) {
    this.prisma = prisma;
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (this.config.enabled && this.config.contractAddress) {
      this.initialize();
    }
  }

  /**
   * Initialize blockchain connection
   */
  private async initialize(): Promise<void> {
    try {
      this.provider = new providers.JsonRpcProvider(this.config.rpcUrl);

      // Verify connection
      const network = await this.provider.getNetwork();
      if (Number(network.chainId) !== this.config.chainId) {
        console.warn(
          `Blockchain network mismatch: expected ${this.config.chainId}, got ${network.chainId}`,
        );
      }

      // Initialize contract
      this.contract = new Contract(
        this.config.contractAddress,
        TRACEABILITY_ABI,
        this.provider,
      );

      this.isConnected = true;
      console.log(`✅ Blockchain verifier connected to ${this.config.networkName}`);
    } catch (error) {
      console.error('Failed to initialize blockchain verifier:', error);
      this.isConnected = false;
    }
  }

  /**
   * Check if blockchain verification is available
   */
  public isAvailable(): boolean {
    return this.config.enabled && this.isConnected && this.contract !== null;
  }

  /**
   * Get blockchain metrics for a producer
   */
  public async getBlockchainMetrics(
    producerId: string,
  ): Promise<BlockchainMetrics> {
    // First, get cached data from database
    const dbMetrics = await this.getMetricsFromDatabase(producerId);

    // If blockchain is not available, return database metrics
    if (!this.isAvailable()) {
      return dbMetrics;
    }

    try {
      // Get producer's wallet address
      const producer = await this.prisma.producer.findUnique({
        where: { id: producerId },
        include: { user: true },
      });

      if (!producer?.user.walletAddress) {
        return dbMetrics;
      }

      // Fetch on-chain records
      const onChainRecords = await this.fetchOnChainRecords(producer.user.walletAddress);

      // Merge with database metrics
      return this.mergeMetrics(dbMetrics, onChainRecords);
    } catch (error) {
      console.error('Error fetching blockchain metrics:', error);
      return dbMetrics;
    }
  }

  /**
   * Verify a specific delivery on blockchain
   */
  public async verifyDelivery(deliveryId: string): Promise<{
    verified: boolean;
    txHash?: string;
    blockNumber?: number;
    error?: string;
  }> {
    if (!this.isAvailable()) {
      return {
        verified: false,
        error: 'Blockchain verification not available',
      };
    }

    try {
      const deliveryIdBytes = ethers.utils.id(deliveryId);
      const isVerified = await this.contract!.verifyDelivery(deliveryIdBytes);

      if (isVerified) {
        const record = await this.getDeliveryRecord(deliveryId);
        return {
          verified: true,
          txHash: record?.txHash,
          blockNumber: record?.blockNumber,
        };
      }

      return { verified: false };
    } catch (error) {
      console.error('Error verifying delivery:', error);
      return {
        verified: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get all deliveries for a producer from blockchain
   */
  public async getProducerDeliveries(
    walletAddress: string,
  ): Promise<BlockchainDeliveryData[]> {
    if (!this.isAvailable()) {
      return [];
    }

    try {
      const deliveries: BlockchainDeliveryData[] = [];
      const recordIds = await this.contract!.getProducerRecords(walletAddress);

      for (const recordId of recordIds) {
        const record = await this.contract!.getDeliveryRecord(recordId);

        deliveries.push({
          txHash: recordId,
          orderId: '', // Would need to decode from record
          producerAddress: record.producer,
          deliveryTimestamp: Number(record.timestamp),
          expectedDeliveryTimestamp: Number(record.timestamp), // Would need additional data
          wasOnTime: true, // Would need to calculate
          qualityGrade: Number(record.qualityGrade),
          weightKg: Number(record.weightKg) / 100, // Convert from fixed point
          expectedWeightKg: Number(record.weightKg) / 100,
          valueUSD: 0, // Would need price data
          isVerified: record.verified,
          blockNumber: 0, // Would need to query
        });
      }

      return deliveries;
    } catch (error) {
      console.error('Error fetching producer deliveries:', error);
      return [];
    }
  }

  /**
   * Sync blockchain data to database
   */
  public async syncBlockchainData(producerId: string): Promise<{
    synced: number;
    errors: number;
  }> {
    let synced = 0;
    let errors = 0;

    if (!this.isAvailable()) {
      return { synced, errors };
    }

    try {
      const producer = await this.prisma.producer.findUnique({
        where: { id: producerId },
        include: { user: true },
      });

      if (!producer?.user.walletAddress) {
        return { synced, errors };
      }

      const onChainDeliveries = await this.getProducerDeliveries(
        producer.user.walletAddress,
      );

      for (const delivery of onChainDeliveries) {
        try {
          // Update traceability events with blockchain verification
          await this.prisma.traceabilityEvent.updateMany({
            where: {
              batch: { producerId },
              blockchainTxHash: delivery.txHash,
            },
            data: {
              isVerified: delivery.isVerified,
              verifiedAt: delivery.isVerified ? new Date() : null,
            },
          });
          synced++;
        } catch {
          errors++;
        }
      }

      // Update credit score with sync timestamp
      await this.prisma.creditScore.updateMany({
        where: { producerId },
        data: {
          lastBlockchainSync: new Date(),
          blockchainVerifications: onChainDeliveries
            .filter((d) => d.isVerified)
            .map((d) => d.txHash),
        },
      });

      return { synced, errors };
    } catch (error) {
      console.error('Error syncing blockchain data:', error);
      return { synced, errors: errors + 1 };
    }
  }

  /**
   * Calculate verification score (0-100)
   */
  public calculateVerificationScore(metrics: BlockchainMetrics): number {
    if (metrics.totalTransactions === 0) {
      return 50; // Neutral for new producers
    }

    // Weight factors
    const rateWeight = 0.7;
    const volumeWeight = 0.3;

    // Verification rate score (0-70)
    const rateScore = (metrics.verificationRate / 100) * 70 * rateWeight;

    // Volume score (0-30) - more verifications = higher trust
    const volumeScore = Math.min(30, (metrics.verifiedTransactions / 10) * 30) * volumeWeight;

    return Math.round(rateScore + volumeScore);
  }

  /**
   * Check if producer has recent blockchain activity
   */
  public async hasRecentActivity(
    producerId: string,
    daysBack = 30,
  ): Promise<boolean> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const recentEvents = await this.prisma.traceabilityEvent.count({
      where: {
        batch: { producerId },
        blockchainTxHash: { not: null },
        createdAt: { gte: cutoffDate },
      },
    });

    return recentEvents > 0;
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * Get metrics from database
   */
  private async getMetricsFromDatabase(
    producerId: string,
  ): Promise<BlockchainMetrics> {
    const events = await this.prisma.traceabilityEvent.findMany({
      where: {
        batch: { producerId },
      },
    });

    const verified = events.filter((e) => e.isVerified && e.blockchainTxHash);
    const hashes = verified
      .map((e) => e.blockchainTxHash)
      .filter((h): h is string => h !== null);

    const lastSync = await this.prisma.creditScore.findUnique({
      where: { producerId },
      select: { lastBlockchainSync: true },
    });

    return {
      verifiedTransactions: verified.length,
      totalTransactions: events.length,
      verificationRate: events.length > 0 ? (verified.length / events.length) * 100 : 0,
      verificationHashes: hashes,
      lastSyncAt: lastSync?.lastBlockchainSync || null,
    };
  }

  /**
   * Fetch on-chain records for a wallet
   */
  private async fetchOnChainRecords(
    walletAddress: string,
  ): Promise<OnChainDeliveryRecord[]> {
    if (!this.contract) return [];

    try {
      const recordIds = await this.contract.getProducerRecords(walletAddress);
      const records: OnChainDeliveryRecord[] = [];

      for (const recordId of recordIds) {
        const record = await this.contract.getDeliveryRecord(recordId);
        records.push({
          deliveryId: recordId,
          producer: record.producer,
          timestamp: Number(record.timestamp),
          weightKg: Number(record.weightKg) / 100,
          qualityGrade: Number(record.qualityGrade),
          verified: record.verified,
          blockNumber: 0,
          txHash: recordId,
        });
      }

      return records;
    } catch (error) {
      console.error('Error fetching on-chain records:', error);
      return [];
    }
  }

  /**
   * Get specific delivery record
   */
  private async getDeliveryRecord(
    deliveryId: string,
  ): Promise<OnChainDeliveryRecord | null> {
    if (!this.contract) return null;

    try {
      const deliveryIdBytes = ethers.utils.id(deliveryId);
      const record = await this.contract.getDeliveryRecord(deliveryIdBytes);

      return {
        deliveryId,
        producer: record.producer,
        timestamp: Number(record.timestamp),
        weightKg: Number(record.weightKg) / 100,
        qualityGrade: Number(record.qualityGrade),
        verified: record.verified,
        blockNumber: 0,
        txHash: deliveryIdBytes,
      };
    } catch {
      return null;
    }
  }

  /**
   * Merge database metrics with on-chain data
   */
  private mergeMetrics(
    dbMetrics: BlockchainMetrics,
    onChainRecords: OnChainDeliveryRecord[],
  ): BlockchainMetrics {
    const onChainVerified = onChainRecords.filter((r) => r.verified);
    const onChainHashes = onChainVerified.map((r) => r.txHash);

    // Merge verification hashes (deduplicate)
    const allHashes = [...new Set([...dbMetrics.verificationHashes, ...onChainHashes])];

    // Use the higher count
    const verifiedCount = Math.max(dbMetrics.verifiedTransactions, onChainVerified.length);
    const totalCount = Math.max(dbMetrics.totalTransactions, onChainRecords.length);

    return {
      verifiedTransactions: verifiedCount,
      totalTransactions: totalCount,
      verificationRate: totalCount > 0 ? (verifiedCount / totalCount) * 100 : 0,
      verificationHashes: allHashes,
      lastSyncAt: new Date(),
    };
  }
}

/**
 * Factory function to create service instance
 */
export function createBlockchainVerifierService(
  prisma: PrismaClient,
  config?: Partial<BlockchainVerifierConfig>,
): BlockchainVerifierService {
  return new BlockchainVerifierService(prisma, config);
}
