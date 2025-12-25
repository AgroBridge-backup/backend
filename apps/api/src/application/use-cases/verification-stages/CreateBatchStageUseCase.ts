/**
 * Traceability 2.0 - Multi-Stage Verification
 * Use Case: Create the next verification stage for a batch
 */

import { UserRole } from '@prisma/client';
import { VerificationStageService } from '../../../domain/services/VerificationStageService.js';
import { VerificationStage, StageType } from '../../../domain/entities/VerificationStage.js';

export interface CreateBatchStageRequest {
  batchId: string;
  userId: string;
  userRole: UserRole;
  stageType?: StageType; // Optional: if not provided, creates the next stage in sequence
  location?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  evidenceUrl?: string;
}

export interface CreateBatchStageResponse {
  stage: VerificationStage;
  isComplete: boolean;
}

export class CreateBatchStageUseCase {
  constructor(private stageService: VerificationStageService) {}

  async execute(request: CreateBatchStageRequest): Promise<CreateBatchStageResponse> {
    const context = {
      userId: request.userId,
      userRole: request.userRole,
    };

    if (request.stageType) {
      // Create a specific stage (requires admin or valid order)
      return this.stageService.createSpecificStage(
        {
          batchId: request.batchId,
          stageType: request.stageType,
          actorId: request.userId,
          location: request.location,
          latitude: request.latitude,
          longitude: request.longitude,
          notes: request.notes,
          evidenceUrl: request.evidenceUrl,
        },
        context
      );
    } else {
      // Create the next stage in sequence
      return this.stageService.createNextStage(
        request.batchId,
        {
          actorId: request.userId,
          location: request.location,
          latitude: request.latitude,
          longitude: request.longitude,
          notes: request.notes,
          evidenceUrl: request.evidenceUrl,
        },
        context
      );
    }
  }
}
