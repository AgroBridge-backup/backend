import { ethers, providers, Contract } from 'ethers';
const TRACEABILITY_ABI = [
    'function getDeliveryRecord(bytes32 deliveryId) view returns (address producer, uint256 timestamp, uint256 weightKg, uint256 qualityGrade, bool verified)',
    'function getProducerRecords(address producer) view returns (bytes32[] memory)',
    'function verifyDelivery(bytes32 deliveryId) view returns (bool)',
    'event DeliveryRecorded(bytes32 indexed deliveryId, address indexed producer, uint256 timestamp)',
    'event DeliveryVerified(bytes32 indexed deliveryId, address indexed verifier, uint256 timestamp)',
];
const DEFAULT_CONFIG = {
    rpcUrl: process.env.BLOCKCHAIN_RPC_URL || 'https://rpc-mumbai.maticvigil.com',
    contractAddress: process.env.TRACEABILITY_CONTRACT_ADDRESS || '',
    networkName: 'polygon-mumbai',
    chainId: 80001,
    confirmationsRequired: 3,
    timeout: 30000,
    enabled: process.env.BLOCKCHAIN_VERIFICATION_ENABLED === 'true',
};
export class BlockchainVerifierService {
    provider = null;
    contract = null;
    prisma;
    config;
    isConnected = false;
    constructor(prisma, config = {}) {
        this.prisma = prisma;
        this.config = { ...DEFAULT_CONFIG, ...config };
        if (this.config.enabled && this.config.contractAddress) {
            this.initialize();
        }
    }
    async initialize() {
        try {
            this.provider = new providers.JsonRpcProvider(this.config.rpcUrl);
            const network = await this.provider.getNetwork();
            if (Number(network.chainId) !== this.config.chainId) {
                console.warn(`Blockchain network mismatch: expected ${this.config.chainId}, got ${network.chainId}`);
            }
            this.contract = new Contract(this.config.contractAddress, TRACEABILITY_ABI, this.provider);
            this.isConnected = true;
            console.log(`✅ Blockchain verifier connected to ${this.config.networkName}`);
        }
        catch (error) {
            console.error('Failed to initialize blockchain verifier:', error);
            this.isConnected = false;
        }
    }
    isAvailable() {
        return this.config.enabled && this.isConnected && this.contract !== null;
    }
    async getBlockchainMetrics(producerId) {
        const dbMetrics = await this.getMetricsFromDatabase(producerId);
        if (!this.isAvailable()) {
            return dbMetrics;
        }
        try {
            const producer = await this.prisma.producer.findUnique({
                where: { id: producerId },
                include: { user: true },
            });
            if (!producer?.user.walletAddress) {
                return dbMetrics;
            }
            const onChainRecords = await this.fetchOnChainRecords(producer.user.walletAddress);
            return this.mergeMetrics(dbMetrics, onChainRecords);
        }
        catch (error) {
            console.error('Error fetching blockchain metrics:', error);
            return dbMetrics;
        }
    }
    async verifyDelivery(deliveryId) {
        if (!this.isAvailable()) {
            return {
                verified: false,
                error: 'Blockchain verification not available',
            };
        }
        try {
            const deliveryIdBytes = ethers.utils.id(deliveryId);
            const isVerified = await this.contract.verifyDelivery(deliveryIdBytes);
            if (isVerified) {
                const record = await this.getDeliveryRecord(deliveryId);
                return {
                    verified: true,
                    txHash: record?.txHash,
                    blockNumber: record?.blockNumber,
                };
            }
            return { verified: false };
        }
        catch (error) {
            console.error('Error verifying delivery:', error);
            return {
                verified: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    async getProducerDeliveries(walletAddress) {
        if (!this.isAvailable()) {
            return [];
        }
        try {
            const deliveries = [];
            const recordIds = await this.contract.getProducerRecords(walletAddress);
            for (const recordId of recordIds) {
                const record = await this.contract.getDeliveryRecord(recordId);
                deliveries.push({
                    txHash: recordId,
                    orderId: '',
                    producerAddress: record.producer,
                    deliveryTimestamp: Number(record.timestamp),
                    expectedDeliveryTimestamp: Number(record.timestamp),
                    wasOnTime: true,
                    qualityGrade: Number(record.qualityGrade),
                    weightKg: Number(record.weightKg) / 100,
                    expectedWeightKg: Number(record.weightKg) / 100,
                    valueUSD: 0,
                    isVerified: record.verified,
                    blockNumber: 0,
                });
            }
            return deliveries;
        }
        catch (error) {
            console.error('Error fetching producer deliveries:', error);
            return [];
        }
    }
    async syncBlockchainData(producerId) {
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
            const onChainDeliveries = await this.getProducerDeliveries(producer.user.walletAddress);
            for (const delivery of onChainDeliveries) {
                try {
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
                }
                catch {
                    errors++;
                }
            }
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
        }
        catch (error) {
            console.error('Error syncing blockchain data:', error);
            return { synced, errors: errors + 1 };
        }
    }
    calculateVerificationScore(metrics) {
        if (metrics.totalTransactions === 0) {
            return 50;
        }
        const rateWeight = 0.7;
        const volumeWeight = 0.3;
        const rateScore = (metrics.verificationRate / 100) * 70 * rateWeight;
        const volumeScore = Math.min(30, (metrics.verifiedTransactions / 10) * 30) * volumeWeight;
        return Math.round(rateScore + volumeScore);
    }
    async hasRecentActivity(producerId, daysBack = 30) {
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
    async getMetricsFromDatabase(producerId) {
        const events = await this.prisma.traceabilityEvent.findMany({
            where: {
                batch: { producerId },
            },
        });
        const verified = events.filter((e) => e.isVerified && e.blockchainTxHash);
        const hashes = verified
            .map((e) => e.blockchainTxHash)
            .filter((h) => h !== null);
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
    async fetchOnChainRecords(walletAddress) {
        if (!this.contract)
            return [];
        try {
            const recordIds = await this.contract.getProducerRecords(walletAddress);
            const records = [];
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
        }
        catch (error) {
            console.error('Error fetching on-chain records:', error);
            return [];
        }
    }
    async getDeliveryRecord(deliveryId) {
        if (!this.contract)
            return null;
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
        }
        catch {
            return null;
        }
    }
    mergeMetrics(dbMetrics, onChainRecords) {
        const onChainVerified = onChainRecords.filter((r) => r.verified);
        const onChainHashes = onChainVerified.map((r) => r.txHash);
        const allHashes = [...new Set([...dbMetrics.verificationHashes, ...onChainHashes])];
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
export function createBlockchainVerifierService(prisma, config) {
    return new BlockchainVerifierService(prisma, config);
}
