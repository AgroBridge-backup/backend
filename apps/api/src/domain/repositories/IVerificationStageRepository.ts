/**
 * Traceability 2.0 - Multi-Stage Verification
 * Repository Interface for VerificationStage
 */

import {
  VerificationStage,
  CreateVerificationStageInput,
  UpdateVerificationStageInput,
  StageType,
  StageStatus
} from '../entities/VerificationStage.js';

export interface IVerificationStageRepository {
  /**
   * Find a stage by ID
   */
  findById(id: string): Promise<VerificationStage | null>;

  /**
   * Find all stages for a batch, ordered by stage type
   */
  findByBatchId(batchId: string): Promise<VerificationStage[]>;

  /**
   * Find a specific stage type for a batch
   */
  findByBatchAndType(batchId: string, stageType: StageType): Promise<VerificationStage | null>;

  /**
   * Get the latest approved stage for a batch
   */
  findLatestApprovedStage(batchId: string): Promise<VerificationStage | null>;

  /**
   * Create a new verification stage
   */
  create(input: CreateVerificationStageInput): Promise<VerificationStage>;

  /**
   * Update a verification stage
   */
  update(id: string, input: UpdateVerificationStageInput): Promise<VerificationStage>;

  /**
   * Check if all stages are approved for a batch
   */
  areAllStagesApproved(batchId: string): Promise<boolean>;

  /**
   * Count stages by status for a batch
   */
  countByStatus(batchId: string, status: StageStatus): Promise<number>;
}
