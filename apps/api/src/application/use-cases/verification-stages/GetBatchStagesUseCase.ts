/**
 * Traceability 2.0 - Multi-Stage Verification
 * Use Case: Get all verification stages for a batch
 */

import { VerificationStageService } from '../../../domain/services/VerificationStageService.js';
import { VerificationStage, StageType } from '../../../domain/entities/VerificationStage.js';

export interface GetBatchStagesRequest {
  batchId: string;
}

export interface GetBatchStagesResponse {
  stages: VerificationStage[];
  currentStage: StageType | null;
  nextStage: StageType | null;
  isComplete: boolean;
  progress: number;
}

export class GetBatchStagesUseCase {
  constructor(private stageService: VerificationStageService) {}

  async execute(request: GetBatchStagesRequest): Promise<GetBatchStagesResponse> {
    return this.stageService.getBatchStages(request.batchId);
  }
}
