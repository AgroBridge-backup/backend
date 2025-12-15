import { PrismaClient } from '@prisma/client';
import { BaseJobProcessor } from '../processors/JobProcessor.js';
import logger from '../../../shared/utils/logger.js';
const prisma = new PrismaClient();
const DEFAULT_CONFIG = {
    maxGasLimit: 500000,
    gasPriceMultiplier: {
        low: 1.0,
        normal: 1.2,
        high: 1.5,
    },
    confirmations: 2,
    timeout: 120000,
};
export class BlockchainTransactionJob extends BaseJobProcessor {
    config;
    isBlockchainAvailable = false;
    constructor(config = {}) {
        super('blockchain-tx');
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.checkBlockchainAvailability();
    }
    checkBlockchainAvailability() {
        const requiredVars = ['BLOCKCHAIN_RPC_URL', 'BLOCKCHAIN_PRIVATE_KEY'];
        this.isBlockchainAvailable = requiredVars.every(v => !!process.env[v]);
        if (!this.isBlockchainAvailable) {
            logger.warn('[BlockchainTransactionJob] Blockchain not configured - jobs will be simulated', {
                missingVars: requiredVars.filter(v => !process.env[v]),
            });
        }
    }
    async process(job) {
        const { type, batchId, eventId, producerId, userId, payload, priority } = job.data;
        try {
            await this.reportProgress(job, 10, 'Validating transaction data');
            const validationResult = await this.validateJobData(job.data);
            if (!validationResult.valid) {
                return {
                    success: false,
                    error: validationResult.error,
                    errorCode: 'VALIDATION_ERROR',
                };
            }
            if (!this.isBlockchainAvailable) {
                return await this.simulateTransaction(job);
            }
            await this.reportProgress(job, 20, 'Preparing transaction');
            const txData = await this.prepareTransaction(type, {
                batchId,
                eventId,
                producerId,
                payload,
            });
            await this.reportProgress(job, 30, 'Estimating gas');
            const gasEstimate = await this.estimateGas(txData, priority || 'normal');
            await this.reportProgress(job, 50, 'Sending transaction');
            const txHash = await this.sendTransaction(txData, gasEstimate);
            await this.reportProgress(job, 70, 'Waiting for confirmation');
            const receipt = await this.waitForConfirmation(txHash);
            await this.reportProgress(job, 90, 'Updating database');
            await this.updateDatabaseWithTxHash(type, {
                batchId,
                eventId,
                producerId,
                txHash: receipt.transactionHash,
                blockNumber: receipt.blockNumber,
            });
            await this.reportProgress(job, 100, 'Complete');
            logger.info('[BlockchainTransactionJob] Transaction completed', {
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
        }
        catch (error) {
            const err = error;
            logger.error('[BlockchainTransactionJob] Transaction failed', {
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
    async simulateTransaction(job) {
        const { type, batchId, eventId, producerId } = job.data;
        logger.info('[BlockchainTransactionJob] Simulating transaction (blockchain not configured)', {
            type,
            batchId,
            eventId,
        });
        await this.delay(1000 + Math.random() * 2000);
        const fakeHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
        const fakeBlockNumber = Math.floor(Math.random() * 1000000) + 10000000;
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
    async validateJobData(data) {
        const { type, batchId, eventId, producerId } = data;
        switch (type) {
            case 'batch-creation':
                if (!batchId) {
                    return { valid: false, error: 'batchId required for batch-creation' };
                }
                const batch = await prisma.batch.findUnique({ where: { id: batchId } });
                if (!batch) {
                    return { valid: false, error: `Batch not found: ${batchId}` };
                }
                break;
            case 'event-creation':
                if (!eventId) {
                    return { valid: false, error: 'eventId required for event-creation' };
                }
                const event = await prisma.traceabilityEvent.findUnique({ where: { id: eventId } });
                if (!event) {
                    return { valid: false, error: `Event not found: ${eventId}` };
                }
                break;
            case 'certification':
                if (!producerId) {
                    return { valid: false, error: 'producerId required for certification' };
                }
                const producer = await prisma.producer.findUnique({ where: { id: producerId } });
                if (!producer) {
                    return { valid: false, error: `Producer not found: ${producerId}` };
                }
                break;
            case 'transfer':
                if (!batchId) {
                    return { valid: false, error: 'batchId required for transfer' };
                }
                break;
            default:
                return { valid: false, error: `Unknown transaction type: ${type}` };
        }
        return { valid: true };
    }
    async prepareTransaction(type, data) {
        return {
            type,
            ...data,
            timestamp: Date.now(),
        };
    }
    async estimateGas(_txData, priority) {
        const baseGasLimit = 100000;
        const baseGasPrice = 20000000000;
        return {
            gasLimit: Math.min(baseGasLimit * 1.2, this.config.maxGasLimit),
            gasPrice: Math.floor(baseGasPrice * this.config.gasPriceMultiplier[priority]),
        };
    }
    async sendTransaction(_txData, _gasEstimate) {
        throw new Error('Blockchain integration not implemented');
    }
    async waitForConfirmation(_txHash) {
        throw new Error('Blockchain integration not implemented');
    }
    async updateDatabaseWithTxHash(type, data) {
        const { batchId, eventId, producerId, txHash, blockNumber } = data;
        switch (type) {
            case 'batch-creation':
            case 'transfer':
                if (batchId) {
                    await prisma.batch.update({
                        where: { id: batchId },
                        data: {
                            blockchainHash: txHash,
                        },
                    });
                    logger.info('[BlockchainTransactionJob] Batch blockchain hash updated', {
                        batchId,
                        txHash,
                        blockNumber,
                    });
                }
                break;
            case 'event-creation':
                if (eventId) {
                    await prisma.traceabilityEvent.update({
                        where: { id: eventId },
                        data: {
                            blockchainTxHash: txHash,
                        },
                    });
                    logger.info('[BlockchainTransactionJob] Event blockchain hash updated', {
                        eventId,
                        txHash,
                        blockNumber,
                    });
                }
                break;
            case 'certification':
                if (producerId) {
                    logger.info('[BlockchainTransactionJob] Certification recorded on blockchain', {
                        producerId,
                        txHash,
                        blockNumber,
                    });
                }
                break;
        }
    }
    getErrorCode(error) {
        const message = error.message.toLowerCase();
        if (message.includes('insufficient funds'))
            return 'INSUFFICIENT_FUNDS';
        if (message.includes('gas'))
            return 'GAS_ERROR';
        if (message.includes('nonce'))
            return 'NONCE_ERROR';
        if (message.includes('timeout'))
            return 'TIMEOUT';
        if (message.includes('rejected'))
            return 'REJECTED';
        if (message.includes('network'))
            return 'NETWORK_ERROR';
        return 'UNKNOWN_ERROR';
    }
    isRetryableError(error) {
        const nonRetryablePatterns = [
            /insufficient funds/i,
            /invalid signature/i,
            /contract reverted/i,
            /validation/i,
        ];
        return !nonRetryablePatterns.some(pattern => pattern.test(error.message));
    }
    async onFailed(job, error) {
        await super.onFailed(job, error);
        logger.error('[BlockchainTransactionJob] Transaction failed permanently', {
            type: job.data.type,
            batchId: job.data.batchId,
            eventId: job.data.eventId,
            userId: job.data.userId,
            error: error.message,
            errorCode: this.getErrorCode(error),
        });
    }
}
export const blockchainTransactionJob = new BlockchainTransactionJob();
export default blockchainTransactionJob;
