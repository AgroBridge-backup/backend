/**
 * Traceability 2.0 - Multi-Stage Verification
 * Use Cases Index
 */

export { GetBatchStagesUseCase } from './GetBatchStagesUseCase.js';
export { CreateBatchStageUseCase } from './CreateBatchStageUseCase.js';
export { UpdateBatchStageUseCase } from './UpdateBatchStageUseCase.js';
export { FinalizeBatchStagesUseCase } from './FinalizeBatchStagesUseCase.js';

export interface VerificationStagesUseCases {
  getBatchStagesUseCase: import('./GetBatchStagesUseCase.js').GetBatchStagesUseCase;
  createBatchStageUseCase: import('./CreateBatchStageUseCase.js').CreateBatchStageUseCase;
  updateBatchStageUseCase: import('./UpdateBatchStageUseCase.js').UpdateBatchStageUseCase;
  finalizeBatchStagesUseCase?: import('./FinalizeBatchStagesUseCase.js').FinalizeBatchStagesUseCase;
}
