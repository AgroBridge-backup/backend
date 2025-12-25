/**
 * Traceability 2.0 - Multi-Stage Verification
 * Prisma Repository Implementation for VerificationStage
 */

import { PrismaClient, StageType as PrismaStageType, StageStatus as PrismaStageStatus } from '@prisma/client';
import { IVerificationStageRepository } from '../../../../domain/repositories/IVerificationStageRepository.js';
import {
  VerificationStage,
  CreateVerificationStageInput,
  UpdateVerificationStageInput,
  StageType,
  StageStatus,
  STAGE_ORDER
} from '../../../../domain/entities/VerificationStage.js';

export class PrismaVerificationStageRepository implements IVerificationStageRepository {
  constructor(private prisma: PrismaClient) {}

  private mapToDomain(stage: any): VerificationStage {
    return {
      id: stage.id,
      batchId: stage.batchId,
      stageType: stage.stageType as StageType,
      status: stage.status as StageStatus,
      actorId: stage.actorId,
      timestamp: stage.timestamp,
      location: stage.location,
      latitude: stage.latitude ? Number(stage.latitude) : null,
      longitude: stage.longitude ? Number(stage.longitude) : null,
      notes: stage.notes,
      evidenceUrl: stage.evidenceUrl,
      createdAt: stage.createdAt,
      updatedAt: stage.updatedAt,
    };
  }

  async findById(id: string): Promise<VerificationStage | null> {
    const stage = await this.prisma.verificationStage.findUnique({
      where: { id },
    });
    return stage ? this.mapToDomain(stage) : null;
  }

  async findByBatchId(batchId: string): Promise<VerificationStage[]> {
    const stages = await this.prisma.verificationStage.findMany({
      where: { batchId },
      orderBy: { createdAt: 'asc' },
    });

    // Sort by stage order
    return stages
      .map(this.mapToDomain)
      .sort((a, b) => {
        const indexA = STAGE_ORDER.indexOf(a.stageType);
        const indexB = STAGE_ORDER.indexOf(b.stageType);
        return indexA - indexB;
      });
  }

  async findByBatchAndType(batchId: string, stageType: StageType): Promise<VerificationStage | null> {
    const stage = await this.prisma.verificationStage.findUnique({
      where: {
        batchId_stageType: {
          batchId,
          stageType: stageType as PrismaStageType,
        },
      },
    });
    return stage ? this.mapToDomain(stage) : null;
  }

  async findLatestApprovedStage(batchId: string): Promise<VerificationStage | null> {
    const stages = await this.prisma.verificationStage.findMany({
      where: {
        batchId,
        status: 'APPROVED',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (stages.length === 0) {
      return null;
    }

    // Find the latest in stage order
    const domainStages = stages.map(this.mapToDomain);
    let latestStage = domainStages[0];
    let latestIndex = STAGE_ORDER.indexOf(latestStage.stageType);

    for (const stage of domainStages) {
      const index = STAGE_ORDER.indexOf(stage.stageType);
      if (index > latestIndex) {
        latestStage = stage;
        latestIndex = index;
      }
    }

    return latestStage;
  }

  async create(input: CreateVerificationStageInput): Promise<VerificationStage> {
    const stage = await this.prisma.verificationStage.create({
      data: {
        batchId: input.batchId,
        stageType: input.stageType as PrismaStageType,
        actorId: input.actorId,
        status: 'PENDING',
        location: input.location,
        latitude: input.latitude,
        longitude: input.longitude,
        notes: input.notes,
        evidenceUrl: input.evidenceUrl,
      },
    });
    return this.mapToDomain(stage);
  }

  async update(id: string, input: UpdateVerificationStageInput): Promise<VerificationStage> {
    const stage = await this.prisma.verificationStage.update({
      where: { id },
      data: {
        status: input.status as PrismaStageStatus | undefined,
        notes: input.notes,
        location: input.location,
        latitude: input.latitude,
        longitude: input.longitude,
        evidenceUrl: input.evidenceUrl,
      },
    });
    return this.mapToDomain(stage);
  }

  async areAllStagesApproved(batchId: string): Promise<boolean> {
    const approvedCount = await this.prisma.verificationStage.count({
      where: {
        batchId,
        status: 'APPROVED',
      },
    });
    return approvedCount === STAGE_ORDER.length;
  }

  async countByStatus(batchId: string, status: StageStatus): Promise<number> {
    return this.prisma.verificationStage.count({
      where: {
        batchId,
        status: status as PrismaStageStatus,
      },
    });
  }
}
