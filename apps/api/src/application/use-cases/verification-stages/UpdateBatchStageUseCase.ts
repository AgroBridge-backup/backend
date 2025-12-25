/**
 * Traceability 2.0 - Multi-Stage Verification
 * Use Case: Update a verification stage (status, notes, location)
 */

import { UserRole } from '@prisma/client';
import { VerificationStageService } from '../../../domain/services/VerificationStageService.js';
import { VerificationStage, StageStatus } from '../../../domain/entities/VerificationStage.js';

export interface UpdateBatchStageRequest {
  stageId: string;
  userId: string;
  userRole: UserRole;
  status?: StageStatus;
  notes?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  evidenceUrl?: string;
}

export interface UpdateBatchStageResponse {
  stage: VerificationStage;
}

export class UpdateBatchStageUseCase {
  constructor(private stageService: VerificationStageService) {}

  async execute(request: UpdateBatchStageRequest): Promise<UpdateBatchStageResponse> {
    const context = {
      userId: request.userId,
      userRole: request.userRole,
    };

    const stage = await this.stageService.updateStage(
      request.stageId,
      {
        status: request.status,
        notes: request.notes,
        location: request.location,
        latitude: request.latitude,
        longitude: request.longitude,
        evidenceUrl: request.evidenceUrl,
      },
      context
    );

    return { stage };
  }
}
