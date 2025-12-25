import { ethers } from 'ethers';
import { logger } from '../logging/logger.js';
const INVOICE_REGISTRY_ABI = [
    'function registerInvoice(bytes32 invoiceHash, string uuid, string folio, address producer, uint256 total, string currency, uint256 issuedAt) returns (bool)',
    'function getInvoice(bytes32 invoiceHash) view returns (tuple(bytes32 invoiceHash, string uuid, string folio, address producer, uint256 total, string currency, uint256 issuedAt, uint256 registeredAt, bool exists))',
    'function isInvoiceRegistered(bytes32 invoiceHash) view returns (bool)',
    'event InvoiceRegistered(bytes32 indexed invoiceHash, string uuid, string folio, address indexed producer, uint256 total, uint256 timestamp)',
];
export const BLOCKCHAIN_STATUS = {
    CONFIRMED: 'CONFIRMED',
    PENDING: 'PENDING',
    UNAVAILABLE: 'BLOCKCHAIN_UNAVAILABLE',
    FAILED: 'FAILED',
};
export class EthersInvoiceBlockchainService {
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
        this.contract = new ethers.Contract(config.contractAddress, INVOICE_REGISTRY_ABI, this.wallet);
        logger.info('EthersInvoiceBlockchainService initialized', {
            network: this.networkName,
            contractAddress: config.contractAddress,
        });
    }
    hashInvoice(data) {
        const encoded = ethers.utils.defaultAbiCoder.encode(['string', 'string', 'string', 'string', 'uint256', 'string', 'uint256'], [
            data.uuid,
            data.folio,
            data.producerId,
            data.recipientRfc,
            Math.round(data.total * 100),
            data.currency,
            Math.floor(data.issuedAt.getTime() / 1000),
        ]);
        return ethers.utils.keccak256(encoded);
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
    async registerInvoice(data) {
        const invoiceHash = this.hashInvoice(data);
        try {
            return await this.withTimeout(this.executeWithRetry(async () => {
                logger.info('Registering invoice on blockchain', {
                    uuid: data.uuid,
                    folio: data.folio,
                    invoiceHash,
                });
                const estimatedGas = await this.contract.registerInvoice.estimateGas(invoiceHash, data.uuid, data.folio, this.wallet.address, Math.round(data.total * 100), data.currency, Math.floor(data.issuedAt.getTime() / 1000));
                const gasLimit = Math.ceil(Number(estimatedGas) * this.GAS_LIMIT_BUFFER);
                const feeData = await this.provider.getFeeData();
                const tx = await this.contract.registerInvoice(invoiceHash, data.uuid, data.folio, this.wallet.address, Math.round(data.total * 100), data.currency, Math.floor(data.issuedAt.getTime() / 1000), {
                    gasLimit,
                    maxFeePerGas: feeData.maxFeePerGas,
                    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
                });
                logger.info('Invoice registration transaction sent', {
                    txHash: tx.hash,
                    uuid: data.uuid,
                });
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
        }
        catch (error) {
            await this.notifyBlockchainFailure('invoice', data.uuid, error);
            logger.warn('Blockchain registration failed, returning fallback', {
                uuid: data.uuid,
                error: error.message,
            });
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
    async verifyInvoice(uuid, expectedHash) {
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
                txHash: null,
                registeredAt: new Date(Number(invoiceData.registeredAt) * 1000),
                network: this.networkName,
            };
        }
        catch (error) {
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
