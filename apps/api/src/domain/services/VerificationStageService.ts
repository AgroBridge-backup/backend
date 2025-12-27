/**
 * Traceability 2.0 - Multi-Stage Verification
 * Domain Service with State Machine Logic
 */

import { UserRole } from "@prisma/client";
import { AppError } from "../../shared/errors/AppError.js";
import { IVerificationStageRepository } from "../repositories/IVerificationStageRepository.js";
import {
  VerificationStage,
  CreateVerificationStageInput,
  UpdateVerificationStageInput,
  StageType,
  StageStatus,
  STAGE_ORDER,
  getStageIndex,
  isValidStageTransition,
  isValidStatusTransition,
} from "../entities/VerificationStage.js";
import logger from "../../shared/utils/logger.js";

/**
 * Role-based permissions for stage operations
 */
export const STAGE_PERMISSIONS: Record<
  StageType,
  {
    canCreate: UserRole[];
    canApprove: UserRole[];
  }
> = {
  [StageType.HARVEST]: {
    canCreate: [UserRole.PRODUCER, UserRole.ADMIN],
    canApprove: [UserRole.QA, UserRole.CERTIFIER, UserRole.ADMIN],
  },
  [StageType.PACKING]: {
    canCreate: [UserRole.PRODUCER, UserRole.QA, UserRole.ADMIN],
    canApprove: [UserRole.QA, UserRole.CERTIFIER, UserRole.ADMIN],
  },
  [StageType.COLD_CHAIN]: {
    canCreate: [
      UserRole.PRODUCER,
      UserRole.QA,
      UserRole.DRIVER,
      UserRole.ADMIN,
    ],
    canApprove: [UserRole.QA, UserRole.CERTIFIER, UserRole.ADMIN],
  },
  [StageType.EXPORT]: {
    canCreate: [UserRole.EXPORTER, UserRole.ADMIN],
    canApprove: [UserRole.EXPORTER, UserRole.CERTIFIER, UserRole.ADMIN],
  },
  [StageType.DELIVERY]: {
    canCreate: [UserRole.DRIVER, UserRole.EXPORTER, UserRole.ADMIN],
    canApprove: [UserRole.QA, UserRole.CERTIFIER, UserRole.ADMIN],
  },
};

export interface StageOperationContext {
  userId: string;
  userRole: UserRole;
}

export interface CreateStageResult {
  stage: VerificationStage;
  isComplete: boolean;
}

export class VerificationStageService {
  constructor(private repository: IVerificationStageRepository) {}

  /**
   * Get all stages for a batch
   */
  async getBatchStages(batchId: string): Promise<{
    stages: VerificationStage[];
    currentStage: StageType | null;
    nextStage: StageType | null;
    isComplete: boolean;
    progress: number;
  }> {
    const stages = await this.repository.findByBatchId(batchId);

    // Determine current and next stage
    let currentStage: StageType | null = null;
    let nextStage: StageType | null = STAGE_ORDER[0];

    for (const stage of stages) {
      if (stage.status === StageStatus.APPROVED) {
        currentStage = stage.stageType;
        const currentIndex = getStageIndex(stage.stageType);
        nextStage =
          currentIndex < STAGE_ORDER.length - 1
            ? STAGE_ORDER[currentIndex + 1]
            : null;
      }
    }

    const approvedCount = stages.filter(
      (s) => s.status === StageStatus.APPROVED,
    ).length;
    const isComplete = approvedCount === STAGE_ORDER.length;
    const progress = Math.round((approvedCount / STAGE_ORDER.length) * 100);

    return {
      stages,
      currentStage,
      nextStage,
      isComplete,
      progress,
    };
  }

  /**
   * Create the next stage in the sequence
   */
  async createNextStage(
    batchId: string,
    input: Omit<CreateVerificationStageInput, "batchId" | "stageType">,
    context: StageOperationContext,
  ): Promise<CreateStageResult> {
    // Get current stages
    const { nextStage } = await this.getBatchStages(batchId);

    if (!nextStage) {
      throw new AppError(
        "All stages have already been completed for this batch",
        400,
      );
    }

    // Check permissions
    this.validateCreatePermission(nextStage, context.userRole);

    // Check if stage already exists
    const existingStage = await this.repository.findByBatchAndType(
      batchId,
      nextStage,
    );
    if (existingStage) {
      throw new AppError(
        `Stage ${nextStage} already exists for this batch`,
        400,
      );
    }

    // Create the stage
    const stage = await this.repository.create({
      batchId,
      stageType: nextStage,
      actorId: context.userId,
      location: input.location,
      latitude: input.latitude,
      longitude: input.longitude,
      notes: input.notes,
      evidenceUrl: input.evidenceUrl,
    });

    logger.info("Verification stage created", {
      batchId,
      stageType: nextStage,
      stageId: stage.id,
      actorId: context.userId,
    });

    const isComplete = await this.repository.areAllStagesApproved(batchId);

    return { stage, isComplete };
  }

  /**
   * Create a specific stage (for admin override or stage skipping with permission)
   */
  async createSpecificStage(
    input: CreateVerificationStageInput,
    context: StageOperationContext,
  ): Promise<CreateStageResult> {
    const { batchId, stageType } = input;

    // Get current stages
    const stages = await this.repository.findByBatchId(batchId);
    const latestApproved =
      await this.repository.findLatestApprovedStage(batchId);

    // Validate stage order (unless admin)
    if (context.userRole !== UserRole.ADMIN) {
      const currentStageType = latestApproved?.stageType ?? null;
      if (!isValidStageTransition(currentStageType, stageType)) {
        const expectedNext = currentStageType
          ? STAGE_ORDER[getStageIndex(currentStageType) + 1]
          : STAGE_ORDER[0];
        throw new AppError(
          `Invalid stage order. Expected ${expectedNext}, got ${stageType}`,
          400,
        );
      }
    }

    // Check permissions
    this.validateCreatePermission(stageType, context.userRole);

    // Check if stage already exists
    const existingStage = await this.repository.findByBatchAndType(
      batchId,
      stageType,
    );
    if (existingStage) {
      throw new AppError(
        `Stage ${stageType} already exists for this batch`,
        400,
      );
    }

    // Create the stage
    const stage = await this.repository.create({
      ...input,
      actorId: context.userId,
    });

    logger.info("Specific verification stage created", {
      batchId,
      stageType,
      stageId: stage.id,
      actorId: context.userId,
    });

    const isComplete = await this.repository.areAllStagesApproved(batchId);

    return { stage, isComplete };
  }

  /**
   * Update a stage (change status, notes, location, evidence)
   */
  async updateStage(
    stageId: string,
    input: UpdateVerificationStageInput,
    context: StageOperationContext,
  ): Promise<VerificationStage> {
    const stage = await this.repository.findById(stageId);

    if (!stage) {
      throw new AppError("Verification stage not found", 404);
    }

    // Validate status transition if status is being changed
    if (input.status && input.status !== stage.status) {
      // Validate transition
      if (!isValidStatusTransition(stage.status, input.status)) {
        throw new AppError(
          `Invalid status transition from ${stage.status} to ${input.status}`,
          400,
        );
      }

      // Check approval permissions
      if (input.status === StageStatus.APPROVED) {
        this.validateApprovePermission(stage.stageType, context.userRole);
      }
    }

    const updatedStage = await this.repository.update(stageId, input);

    logger.info("Verification stage updated", {
      stageId,
      batchId: stage.batchId,
      stageType: stage.stageType,
      oldStatus: stage.status,
      newStatus: input.status || stage.status,
      actorId: context.userId,
    });

    return updatedStage;
  }

  /**
   * Check if all stages are complete (all approved)
   */
  async areAllStagesComplete(batchId: string): Promise<boolean> {
    return this.repository.areAllStagesApproved(batchId);
  }

  /**
   * Get the full stage timeline for blockchain finalization
   */
  async getStageTimeline(batchId: string): Promise<{
    batchId: string;
    stages: Array<{
      stageType: StageType;
      status: StageStatus;
      actorId: string;
      timestamp: Date;
      location: string | null;
      coordinates: { lat: number; lng: number } | null;
    }>;
    completedAt: Date | null;
  }> {
    const stages = await this.repository.findByBatchId(batchId);
    const allApproved =
      stages.length === STAGE_ORDER.length &&
      stages.every((s) => s.status === StageStatus.APPROVED);

    return {
      batchId,
      stages: stages.map((s) => ({
        stageType: s.stageType,
        status: s.status,
        actorId: s.actorId,
        timestamp: s.timestamp,
        location: s.location,
        coordinates:
          s.latitude && s.longitude
            ? { lat: s.latitude, lng: s.longitude }
            : null,
      })),
      completedAt: allApproved
        ? (stages[stages.length - 1]?.timestamp ?? null)
        : null,
    };
  }

  /**
   * Validate create permission for a stage type
   */
  private validateCreatePermission(
    stageType: StageType,
    userRole: UserRole,
  ): void {
    const permissions = STAGE_PERMISSIONS[stageType];
    if (!permissions.canCreate.includes(userRole)) {
      throw new AppError(
        `Role ${userRole} is not authorized to create ${stageType} stage`,
        403,
      );
    }
  }

  /**
   * Validate approve permission for a stage type
   */
  private validateApprovePermission(
    stageType: StageType,
    userRole: UserRole,
  ): void {
    const permissions = STAGE_PERMISSIONS[stageType];
    if (!permissions.canApprove.includes(userRole)) {
      throw new AppError(
        `Role ${userRole} is not authorized to approve ${stageType} stage`,
        403,
      );
    }
  }
}
