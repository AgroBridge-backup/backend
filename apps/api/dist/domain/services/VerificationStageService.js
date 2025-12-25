import { UserRole } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError.js';
import { StageType, StageStatus, STAGE_ORDER, getStageIndex, isValidStageTransition, isValidStatusTransition, } from '../entities/VerificationStage.js';
import logger from '../../shared/utils/logger.js';
export const STAGE_PERMISSIONS = {
    [StageType.HARVEST]: {
        canCreate: [UserRole.PRODUCER, UserRole.ADMIN],
        canApprove: [UserRole.QA, UserRole.CERTIFIER, UserRole.ADMIN],
    },
    [StageType.PACKING]: {
        canCreate: [UserRole.PRODUCER, UserRole.QA, UserRole.ADMIN],
        canApprove: [UserRole.QA, UserRole.CERTIFIER, UserRole.ADMIN],
    },
    [StageType.COLD_CHAIN]: {
        canCreate: [UserRole.PRODUCER, UserRole.QA, UserRole.DRIVER, UserRole.ADMIN],
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
export class VerificationStageService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async getBatchStages(batchId) {
        const stages = await this.repository.findByBatchId(batchId);
        let currentStage = null;
        let nextStage = STAGE_ORDER[0];
        for (const stage of stages) {
            if (stage.status === StageStatus.APPROVED) {
                currentStage = stage.stageType;
                const currentIndex = getStageIndex(stage.stageType);
                nextStage = currentIndex < STAGE_ORDER.length - 1
                    ? STAGE_ORDER[currentIndex + 1]
                    : null;
            }
        }
        const approvedCount = stages.filter(s => s.status === StageStatus.APPROVED).length;
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
    async createNextStage(batchId, input, context) {
        const { nextStage } = await this.getBatchStages(batchId);
        if (!nextStage) {
            throw new AppError('All stages have already been completed for this batch', 400);
        }
        this.validateCreatePermission(nextStage, context.userRole);
        const existingStage = await this.repository.findByBatchAndType(batchId, nextStage);
        if (existingStage) {
            throw new AppError(`Stage ${nextStage} already exists for this batch`, 400);
        }
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
        logger.info('Verification stage created', {
            batchId,
            stageType: nextStage,
            stageId: stage.id,
            actorId: context.userId,
        });
        const isComplete = await this.repository.areAllStagesApproved(batchId);
        return { stage, isComplete };
    }
    async createSpecificStage(input, context) {
        const { batchId, stageType } = input;
        const stages = await this.repository.findByBatchId(batchId);
        const latestApproved = await this.repository.findLatestApprovedStage(batchId);
        if (context.userRole !== UserRole.ADMIN) {
            const currentStageType = latestApproved?.stageType ?? null;
            if (!isValidStageTransition(currentStageType, stageType)) {
                const expectedNext = currentStageType
                    ? STAGE_ORDER[getStageIndex(currentStageType) + 1]
                    : STAGE_ORDER[0];
                throw new AppError(`Invalid stage order. Expected ${expectedNext}, got ${stageType}`, 400);
            }
        }
        this.validateCreatePermission(stageType, context.userRole);
        const existingStage = await this.repository.findByBatchAndType(batchId, stageType);
        if (existingStage) {
            throw new AppError(`Stage ${stageType} already exists for this batch`, 400);
        }
        const stage = await this.repository.create({
            ...input,
            actorId: context.userId,
        });
        logger.info('Specific verification stage created', {
            batchId,
            stageType,
            stageId: stage.id,
            actorId: context.userId,
        });
        const isComplete = await this.repository.areAllStagesApproved(batchId);
        return { stage, isComplete };
    }
    async updateStage(stageId, input, context) {
        const stage = await this.repository.findById(stageId);
        if (!stage) {
            throw new AppError('Verification stage not found', 404);
        }
        if (input.status && input.status !== stage.status) {
            if (!isValidStatusTransition(stage.status, input.status)) {
                throw new AppError(`Invalid status transition from ${stage.status} to ${input.status}`, 400);
            }
            if (input.status === StageStatus.APPROVED) {
                this.validateApprovePermission(stage.stageType, context.userRole);
            }
        }
        const updatedStage = await this.repository.update(stageId, input);
        logger.info('Verification stage updated', {
            stageId,
            batchId: stage.batchId,
            stageType: stage.stageType,
            oldStatus: stage.status,
            newStatus: input.status || stage.status,
            actorId: context.userId,
        });
        return updatedStage;
    }
    async areAllStagesComplete(batchId) {
        return this.repository.areAllStagesApproved(batchId);
    }
    async getStageTimeline(batchId) {
        const stages = await this.repository.findByBatchId(batchId);
        const allApproved = stages.length === STAGE_ORDER.length &&
            stages.every(s => s.status === StageStatus.APPROVED);
        return {
            batchId,
            stages: stages.map(s => ({
                stageType: s.stageType,
                status: s.status,
                actorId: s.actorId,
                timestamp: s.timestamp,
                location: s.location,
                coordinates: s.latitude && s.longitude
                    ? { lat: s.latitude, lng: s.longitude }
                    : null,
            })),
            completedAt: allApproved
                ? stages[stages.length - 1]?.timestamp ?? null
                : null,
        };
    }
    validateCreatePermission(stageType, userRole) {
        const permissions = STAGE_PERMISSIONS[stageType];
        if (!permissions.canCreate.includes(userRole)) {
            throw new AppError(`Role ${userRole} is not authorized to create ${stageType} stage`, 403);
        }
    }
    validateApprovePermission(stageType, userRole) {
        const permissions = STAGE_PERMISSIONS[stageType];
        if (!permissions.canApprove.includes(userRole)) {
            throw new AppError(`Role ${userRole} is not authorized to approve ${stageType} stage`, 403);
        }
    }
}
