/**
 * Traceability 2.0 - Multi-Stage Verification
 * Use Case: Finalize batch stages and store on blockchain
 */

import {
  StageFinalizationService,
  StageFinalizationResult,
} from "../../../domain/services/StageFinalizationService.js";

export interface FinalizeBatchStagesRequest {
  batchId: string;
}

export class FinalizeBatchStagesUseCase {
  constructor(private finalizationService: StageFinalizationService) {}

  async execute(
    request: FinalizeBatchStagesRequest,
  ): Promise<StageFinalizationResult> {
    return this.finalizationService.finalize(request.batchId);
  }
}
