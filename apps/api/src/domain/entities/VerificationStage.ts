/**
 * Traceability 2.0 - Multi-Stage Verification
 * Domain Entity for VerificationStage
 */

export enum StageType {
  HARVEST = 'HARVEST',
  PACKING = 'PACKING',
  COLD_CHAIN = 'COLD_CHAIN',
  EXPORT = 'EXPORT',
  DELIVERY = 'DELIVERY',
}

export enum StageStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  FLAGGED = 'FLAGGED',
}

export interface VerificationStage {
  id: string;
  batchId: string;
  stageType: StageType;
  status: StageStatus;
  actorId: string;
  timestamp: Date;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  evidenceUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVerificationStageInput {
  batchId: string;
  stageType: StageType;
  actorId: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  evidenceUrl?: string;
}

export interface UpdateVerificationStageInput {
  status?: StageStatus;
  notes?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  evidenceUrl?: string;
}

/**
 * Stage order for state machine validation
 * Stages must be completed in this specific order
 */
export const STAGE_ORDER: StageType[] = [
  StageType.HARVEST,
  StageType.PACKING,
  StageType.COLD_CHAIN,
  StageType.EXPORT,
  StageType.DELIVERY,
];

/**
 * Get the index of a stage in the order
 */
export function getStageIndex(stageType: StageType): number {
  return STAGE_ORDER.indexOf(stageType);
}

/**
 * Check if a stage transition is valid
 */
export function isValidStageTransition(currentStage: StageType | null, nextStage: StageType): boolean {
  if (currentStage === null) {
    // First stage must be HARVEST
    return nextStage === StageType.HARVEST;
  }

  const currentIndex = getStageIndex(currentStage);
  const nextIndex = getStageIndex(nextStage);

  // Next stage must be exactly one step ahead
  return nextIndex === currentIndex + 1;
}

/**
 * Valid status transitions
 */
export const VALID_STATUS_TRANSITIONS: Record<StageStatus, StageStatus[]> = {
  [StageStatus.PENDING]: [StageStatus.APPROVED, StageStatus.REJECTED, StageStatus.FLAGGED],
  [StageStatus.APPROVED]: [], // Terminal state
  [StageStatus.REJECTED]: [StageStatus.PENDING], // Can retry
  [StageStatus.FLAGGED]: [StageStatus.APPROVED, StageStatus.REJECTED], // Admin can resolve
};

/**
 * Check if a status transition is valid
 */
export function isValidStatusTransition(currentStatus: StageStatus, newStatus: StageStatus): boolean {
  if (currentStatus === newStatus) {
    return true; // Same status is allowed (no-op)
  }
  return VALID_STATUS_TRANSITIONS[currentStatus].includes(newStatus);
}
