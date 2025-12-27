/**
 * Traceability 2.0 - Multi-Stage Verification
 * Blockchain Finalization Hook
 *
 * When all stages are complete (approved), this service:
 * 1. Builds a JSON representation of all stages
 * 2. Computes a hash
 * 3. Stores the hash on the ZTD blockchain
 * 4. Updates the batch with the finalization data
 */

import { createHash } from "crypto";
import { PrismaClient } from "@prisma/client";
import { VerificationStageService } from "./VerificationStageService.js";
import { BlockchainService } from "./BlockchainService.js";
import { AppError } from "../../shared/errors/AppError.js";
import logger from "../../shared/utils/logger.js";

export interface StageFinalizationPayload {
  batchId: string;
  batchCode: string;
  stages: Array<{
    stageType: string;
    status: string;
    actorId: string;
    timestamp: string;
    location: string | null;
    coordinates: { lat: number; lng: number } | null;
  }>;
  finalizedAt: string;
  version: string;
}

export interface StageFinalizationResult {
  success: boolean;
  batchId: string;
  hash: string;
  txId: string | null;
  payload: StageFinalizationPayload;
}

export class StageFinalizationService {
  private static readonly VERSION = "1.0.0";

  constructor(
    private prisma: PrismaClient,
    private stageService: VerificationStageService,
    private blockchainService?: BlockchainService,
  ) {}

  /**
   * Check if a batch is ready for finalization
   */
  async isReadyForFinalization(batchId: string): Promise<boolean> {
    return this.stageService.areAllStagesComplete(batchId);
  }

  /**
   * Finalize stages for a batch and store on blockchain
   */
  async finalize(batchId: string): Promise<StageFinalizationResult> {
    // Check if already finalized
    const batch = await this.prisma.batch.findUnique({
      where: { id: batchId },
      include: { producer: { select: { latitude: true, longitude: true } } },
    });

    if (!batch) {
      throw new AppError("Batch not found", 404);
    }

    if (batch.stagesFinalized) {
      throw new AppError("Batch stages have already been finalized", 400);
    }

    // Verify all stages are complete
    const isReady = await this.isReadyForFinalization(batchId);
    if (!isReady) {
      throw new AppError("Not all stages are approved. Cannot finalize.", 400);
    }

    // Get stage timeline
    const timeline = await this.stageService.getStageTimeline(batchId);

    // Build finalization payload
    const payload: StageFinalizationPayload = {
      batchId,
      batchCode: batchId, // Use batchId as code
      stages: timeline.stages.map((s) => ({
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

    // Compute hash
    const payloadJson = JSON.stringify(payload);
    const hash = this.computeHash(payloadJson);

    logger.info("Finalizing batch stages", {
      batchId,
      hash,
      stageCount: payload.stages.length,
    });

    // Store on blockchain if service is available
    let txId: string | null = null;
    if (this.blockchainService) {
      try {
        const blockchainResult =
          await this.blockchainService.registerEventOnChain({
            eventType: "STAGES_FINALIZED",
            batchId,
            latitude: batch.producer?.latitude
              ? Number(batch.producer.latitude)
              : 0,
            longitude: batch.producer?.longitude
              ? Number(batch.producer.longitude)
              : 0,
            ipfsHash: hash, // Using hash as IPFS hash for now
          });
        txId = blockchainResult.txHash;

        logger.info("Stages finalized on blockchain", {
          batchId,
          txHash: txId,
          eventId: blockchainResult.eventId,
        });
      } catch (error: any) {
        logger.error("Failed to store stages on blockchain", {
          batchId,
          error: error.message,
        });
        // Continue without blockchain - can retry later
      }
    }

    // Update batch with finalization data
    await this.prisma.batch.update({
      where: { id: batchId },
      data: {
        stagesFinalized: true,
        stagesFinalizedHash: hash,
        stagesFinalizedTxId: txId,
      },
    });

    logger.info("Batch stages finalized successfully", {
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

  /**
   * Get finalization status for a batch
   */
  async getFinalizationStatus(batchId: string): Promise<{
    isFinalized: boolean;
    hash: string | null;
    txId: string | null;
    finalizedAt: Date | null;
    isReadyForFinalization: boolean;
  }> {
    const batch = await this.prisma.batch.findUnique({
      where: { id: batchId },
      select: {
        stagesFinalized: true,
        stagesFinalizedHash: true,
        stagesFinalizedTxId: true,
        updatedAt: true,
      },
    });

    if (!batch) {
      throw new AppError("Batch not found", 404);
    }

    const isReady = await this.isReadyForFinalization(batchId);

    return {
      isFinalized: batch.stagesFinalized,
      hash: batch.stagesFinalizedHash,
      txId: batch.stagesFinalizedTxId,
      finalizedAt: batch.stagesFinalized ? batch.updatedAt : null, // Use updatedAt as proxy
      isReadyForFinalization: isReady,
    };
  }

  /**
   * Compute SHA-256 hash of the payload
   */
  private computeHash(payload: string): string {
    return createHash("sha256").update(payload).digest("hex");
  }
}
