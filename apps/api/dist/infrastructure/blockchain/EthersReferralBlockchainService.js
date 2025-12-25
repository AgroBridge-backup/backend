import { ethers } from 'ethers';
import { logger } from '../logging/logger.js';
import { BLOCKCHAIN_STATUS } from './EthersInvoiceBlockchainService.js';
const REFERRAL_PROGRAM_ABI = [
    'function registerReferral(bytes32 referralId, address referrer, address referred, string referralCode, uint256 appliedAt) returns (bytes32 eventId)',
    'function recordReward(bytes32 referralId, string rewardType, uint256 amount, string currency, uint256 rewardedAt) returns (bytes32 eventId)',
    'function getReferral(bytes32 referralId) view returns (tuple(bytes32 referralId, address referrer, address referred, string referralCode, uint256 appliedAt, bool rewarded, uint256 rewardAmount, uint256 registeredAt, bool exists))',
    'function isReferralRegistered(bytes32 referralId) view returns (bool)',
    'event ReferralRegistered(bytes32 indexed referralId, address indexed referrer, address indexed referred, string referralCode, uint256 timestamp)',
    'event RewardRecorded(bytes32 indexed referralId, string rewardType, uint256 amount, uint256 timestamp)',
];
export class EthersReferralBlockchainService {
    provider;
    wallet;
    contract;
    networkName;
    MAX_RETRIES = 3;
    RETRY_DELAY_MS = 2000;
    GAS_LIMIT_BUFFER = 1.2;
    REQUIRED_CONFIRMATIONS = 1;
    RPC_TIMEOUT_MS = 30000;
    constructor(config) {
        this.networkName = config.networkName;
        this.provider = new ethers.providers.JsonRpcProvider(config.rpcUrl, config.chainId);
        this.wallet = new ethers.Wallet(config.privateKey, this.provider);
        this.contract = new ethers.Contract(config.contractAddress, REFERRAL_PROGRAM_ABI, this.wallet);
        logger.info('EthersReferralBlockchainService initialized', {
            network: this.networkName,
            contractAddress: config.contractAddress,
        });
    }
    hashReferralId(referralId) {
        return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(referralId));
    }
    async withTimeout(promise, timeoutMs = this.RPC_TIMEOUT_MS) {
        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error(`RPC timeout after ${timeoutMs}ms`));
            }, timeoutMs);
        });
        try {
            const result = await Promise.race([promise, timeoutPromise]);
            clearTimeout(timeoutId);
            return result;
        }
        catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
    async notifyBlockchainFailure(type, id, error) {
        logger.error('🚨 BLOCKCHAIN FAILURE ALERT', {
            type,
            id,
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            network: this.networkName,
            action: 'REQUIRES_RETRY',
        });
    }
    async registerReferral(data) {
        const referralIdHash = this.hashReferralId(data.referralId);
        try {
            return await this.withTimeout(this.executeWithRetry(async () => {
                logger.info('Registering referral on blockchain', {
                    referralId: data.referralId,
                    referralCode: data.referralCode,
                });
                const estimatedGas = await this.contract.registerReferral.estimateGas(referralIdHash, this.wallet.address, this.wallet.address, data.referralCode, Math.floor(data.appliedAt.getTime() / 1000));
                const gasLimit = Math.ceil(Number(estimatedGas) * this.GAS_LIMIT_BUFFER);
                const feeData = await this.provider.getFeeData();
                const tx = await this.contract.registerReferral(referralIdHash, this.wallet.address, this.wallet.address, data.referralCode, Math.floor(data.appliedAt.getTime() / 1000), {
                    gasLimit,
                    maxFeePerGas: feeData.maxFeePerGas,
                    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
                });
                logger.info('Referral registration transaction sent', {
                    txHash: tx.hash,
                    referralId: data.referralId,
                });
                const receipt = await tx.wait(this.REQUIRED_CONFIRMATIONS);
                if (!receipt || receipt.status !== 1) {
                    throw new Error('Transaction failed');
                }
                const eventLog = receipt.logs.find((log) => {
                    try {
                        const parsedLog = this.contract.interface.parseLog(log);
                        return parsedLog?.name === 'ReferralRegistered';
                    }
                    catch {
                        return false;
                    }
                });
                let eventId = '';
                if (eventLog) {
                    const parsed = this.contract.interface.parseLog(eventLog);
                    eventId = parsed?.args[0];
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
        }
        catch (error) {
            await this.notifyBlockchainFailure('referral', data.referralId, error);
            logger.warn('Blockchain referral registration failed, returning fallback', {
                referralId: data.referralId,
                error: error.message,
            });
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
    async recordReferralReward(data) {
        const referralIdHash = this.hashReferralId(data.referralId);
        try {
            return await this.withTimeout(this.executeWithRetry(async () => {
                logger.info('Recording referral reward on blockchain', {
                    referralId: data.referralId,
                    rewardType: data.rewardType,
                    amount: data.rewardAmount,
                });
                const estimatedGas = await this.contract.recordReward.estimateGas(referralIdHash, data.rewardType, Math.round(data.rewardAmount * 100), data.currency, Math.floor(data.rewardedAt.getTime() / 1000));
                const gasLimit = Math.ceil(Number(estimatedGas) * this.GAS_LIMIT_BUFFER);
                const feeData = await this.provider.getFeeData();
                const tx = await this.contract.recordReward(referralIdHash, data.rewardType, Math.round(data.rewardAmount * 100), data.currency, Math.floor(data.rewardedAt.getTime() / 1000), {
                    gasLimit,
                    maxFeePerGas: feeData.maxFeePerGas,
                    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
                });
                logger.info('Reward recording transaction sent', {
                    txHash: tx.hash,
                    referralId: data.referralId,
                });
                const receipt = await tx.wait(this.REQUIRED_CONFIRMATIONS);
                if (!receipt || receipt.status !== 1) {
                    throw new Error('Transaction failed');
                }
                const eventLog = receipt.logs.find((log) => {
                    try {
                        const parsedLog = this.contract.interface.parseLog(log);
                        return parsedLog?.name === 'RewardRecorded';
                    }
                    catch {
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
        }
        catch (error) {
            await this.notifyBlockchainFailure('reward', data.referralId, error);
            logger.warn('Blockchain reward recording failed, returning fallback', {
                referralId: data.referralId,
                error: error.message,
            });
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
    async verifyReferral(referralId) {
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
                txHash: null,
                eventId: referralIdHash,
                registeredAt: new Date(Number(referralData.registeredAt) * 1000),
                network: this.networkName,
            };
        }
        catch (error) {
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
    async isHealthy() {
        try {
            const blockNumber = await this.provider.getBlockNumber();
            return blockNumber > 0;
        }
        catch {
            return false;
        }
    }
    async executeWithRetry(fn, attempt = 1) {
        try {
            return await fn();
        }
        catch (error) {
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
