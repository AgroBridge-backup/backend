import { createHash } from 'crypto';
import { AppError } from '../../shared/errors/AppError.js';
import logger from '../../shared/utils/logger.js';
export class StageFinalizationService {
    prisma;
    stageService;
    blockchainService;
    static VERSION = '1.0.0';
    constructor(prisma, stageService, blockchainService) {
        this.prisma = prisma;
        this.stageService = stageService;
        this.blockchainService = blockchainService;
    }
    async isReadyForFinalization(batchId) {
        return this.stageService.areAllStagesComplete(batchId);
    }
    async finalize(batchId) {
        const batch = await this.prisma.batch.findUnique({
            where: { id: batchId },
        });
        if (!batch) {
            throw new AppError('Batch not found', 404);
        }
        if (batch.stagesFinalized) {
            throw new AppError('Batch stages have already been finalized', 400);
        }
        const isReady = await this.isReadyForFinalization(batchId);
        if (!isReady) {
            throw new AppError('Not all stages are approved. Cannot finalize.', 400);
        }
        const timeline = await this.stageService.getStageTimeline(batchId);
        const payload = {
            batchId,
            batchCode: batch.code,
            stages: timeline.stages.map(s => ({
                stageType: s.stageType,
                status: s.status,
                actorId: s.actorId,
                timestamp: s.timestamp.toISOString(),
                location: s.location,
                coordinates: s.coordinates,
            })),
            finalizedAt: new Date().toISOString(),
            version: StageFinalizationService.VERSION,
        };
        const payloadJson = JSON.stringify(payload);
        const hash = this.computeHash(payloadJson);
        logger.info('Finalizing batch stages', {
            batchId,
            hash,
            stageCount: payload.stages.length,
        });
        let txId = null;
        if (this.blockchainService) {
            try {
                const blockchainResult = await this.blockchainService.registerEventOnChain({
                    eventType: 'STAGES_FINALIZED',
                    batchId,
                    latitude: batch.latitude ? Number(batch.latitude) : 0,
                    longitude: batch.longitude ? Number(batch.longitude) : 0,
                    ipfsHash: hash,
                });
                txId = blockchainResult.txHash;
                logger.info('Stages finalized on blockchain', {
                    batchId,
                    txHash: txId,
                    eventId: blockchainResult.eventId,
                });
            }
            catch (error) {
                logger.error('Failed to store stages on blockchain', {
                    batchId,
                    error: error.message,
                });
            }
        }
        await this.prisma.batch.update({
            where: { id: batchId },
            data: {
                stagesFinalized: true,
                stagesFinalizedAt: new Date(),
                stagesFinalizedHash: hash,
                stagesFinalizedTxId: txId,
            },
        });
        logger.info('Batch stages finalized successfully', {
            batchId,
            hash,
            txId,
        });
        return {
            success: true,
            batchId,
            hash,
            txId,
            payload,
        };
    }
    async getFinalizationStatus(batchId) {
        const batch = await this.prisma.batch.findUnique({
            where: { id: batchId },
            select: {
                stagesFinalized: true,
                stagesFinalizedAt: true,
                stagesFinalizedHash: true,
                stagesFinalizedTxId: true,
            },
        });
        if (!batch) {
            throw new AppError('Batch not found', 404);
        }
        const isReady = await this.isReadyForFinalization(batchId);
        return {
            isFinalized: batch.stagesFinalized,
            hash: batch.stagesFinalizedHash,
            txId: batch.stagesFinalizedTxId,
            finalizedAt: batch.stagesFinalizedAt,
            isReadyForFinalization: isReady,
        };
    }
    computeHash(payload) {
        return createHash('sha256').update(payload).digest('hex');
    }
}
