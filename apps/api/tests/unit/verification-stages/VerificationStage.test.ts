/**
 * Traceability 2.0 - Multi-Stage Verification
 * Unit Tests for State Machine Logic
 */

import { describe, it, expect } from 'vitest';
import {
  StageType,
  StageStatus,
  STAGE_ORDER,
  getStageIndex,
  isValidStageTransition,
  isValidStatusTransition,
  VALID_STATUS_TRANSITIONS,
} from '../../../src/domain/entities/VerificationStage.js';

describe('VerificationStage State Machine', () => {
  describe('STAGE_ORDER', () => {
    it('should have correct order of stages', () => {
      expect(STAGE_ORDER).toEqual([
        StageType.HARVEST,
        StageType.PACKING,
        StageType.COLD_CHAIN,
        StageType.EXPORT,
        StageType.DELIVERY,
      ]);
    });

    it('should have exactly 5 stages', () => {
      expect(STAGE_ORDER.length).toBe(5);
    });
  });

  describe('getStageIndex', () => {
    it('should return correct index for HARVEST', () => {
      expect(getStageIndex(StageType.HARVEST)).toBe(0);
    });

    it('should return correct index for PACKING', () => {
      expect(getStageIndex(StageType.PACKING)).toBe(1);
    });

    it('should return correct index for COLD_CHAIN', () => {
      expect(getStageIndex(StageType.COLD_CHAIN)).toBe(2);
    });

    it('should return correct index for EXPORT', () => {
      expect(getStageIndex(StageType.EXPORT)).toBe(3);
    });

    it('should return correct index for DELIVERY', () => {
      expect(getStageIndex(StageType.DELIVERY)).toBe(4);
    });
  });

  describe('isValidStageTransition', () => {
    describe('when current stage is null (no stages created)', () => {
      it('should allow HARVEST as first stage', () => {
        expect(isValidStageTransition(null, StageType.HARVEST)).toBe(true);
      });

      it('should NOT allow PACKING as first stage', () => {
        expect(isValidStageTransition(null, StageType.PACKING)).toBe(false);
      });

      it('should NOT allow COLD_CHAIN as first stage', () => {
        expect(isValidStageTransition(null, StageType.COLD_CHAIN)).toBe(false);
      });

      it('should NOT allow EXPORT as first stage', () => {
        expect(isValidStageTransition(null, StageType.EXPORT)).toBe(false);
      });

      it('should NOT allow DELIVERY as first stage', () => {
        expect(isValidStageTransition(null, StageType.DELIVERY)).toBe(false);
      });
    });

    describe('valid sequential transitions', () => {
      it('should allow HARVEST -> PACKING', () => {
        expect(isValidStageTransition(StageType.HARVEST, StageType.PACKING)).toBe(true);
      });

      it('should allow PACKING -> COLD_CHAIN', () => {
        expect(isValidStageTransition(StageType.PACKING, StageType.COLD_CHAIN)).toBe(true);
      });

      it('should allow COLD_CHAIN -> EXPORT', () => {
        expect(isValidStageTransition(StageType.COLD_CHAIN, StageType.EXPORT)).toBe(true);
      });

      it('should allow EXPORT -> DELIVERY', () => {
        expect(isValidStageTransition(StageType.EXPORT, StageType.DELIVERY)).toBe(true);
      });
    });

    describe('invalid transitions (skipping stages)', () => {
      it('should NOT allow HARVEST -> COLD_CHAIN (skip PACKING)', () => {
        expect(isValidStageTransition(StageType.HARVEST, StageType.COLD_CHAIN)).toBe(false);
      });

      it('should NOT allow HARVEST -> EXPORT (skip 2)', () => {
        expect(isValidStageTransition(StageType.HARVEST, StageType.EXPORT)).toBe(false);
      });

      it('should NOT allow HARVEST -> DELIVERY (skip 3)', () => {
        expect(isValidStageTransition(StageType.HARVEST, StageType.DELIVERY)).toBe(false);
      });

      it('should NOT allow PACKING -> DELIVERY (skip 2)', () => {
        expect(isValidStageTransition(StageType.PACKING, StageType.DELIVERY)).toBe(false);
      });
    });

    describe('invalid transitions (going backwards)', () => {
      it('should NOT allow PACKING -> HARVEST', () => {
        expect(isValidStageTransition(StageType.PACKING, StageType.HARVEST)).toBe(false);
      });

      it('should NOT allow DELIVERY -> EXPORT', () => {
        expect(isValidStageTransition(StageType.DELIVERY, StageType.EXPORT)).toBe(false);
      });
    });

    describe('invalid transitions (same stage)', () => {
      it('should NOT allow HARVEST -> HARVEST', () => {
        expect(isValidStageTransition(StageType.HARVEST, StageType.HARVEST)).toBe(false);
      });

      it('should NOT allow DELIVERY -> DELIVERY', () => {
        expect(isValidStageTransition(StageType.DELIVERY, StageType.DELIVERY)).toBe(false);
      });
    });
  });

  describe('isValidStatusTransition', () => {
    describe('PENDING status transitions', () => {
      it('should allow PENDING -> APPROVED', () => {
        expect(isValidStatusTransition(StageStatus.PENDING, StageStatus.APPROVED)).toBe(true);
      });

      it('should allow PENDING -> REJECTED', () => {
        expect(isValidStatusTransition(StageStatus.PENDING, StageStatus.REJECTED)).toBe(true);
      });

      it('should allow PENDING -> FLAGGED', () => {
        expect(isValidStatusTransition(StageStatus.PENDING, StageStatus.FLAGGED)).toBe(true);
      });

      it('should allow PENDING -> PENDING (no-op)', () => {
        expect(isValidStatusTransition(StageStatus.PENDING, StageStatus.PENDING)).toBe(true);
      });
    });

    describe('APPROVED status transitions', () => {
      it('should allow APPROVED -> APPROVED (no-op)', () => {
        expect(isValidStatusTransition(StageStatus.APPROVED, StageStatus.APPROVED)).toBe(true);
      });

      it('should NOT allow APPROVED -> PENDING (terminal state)', () => {
        expect(isValidStatusTransition(StageStatus.APPROVED, StageStatus.PENDING)).toBe(false);
      });

      it('should NOT allow APPROVED -> REJECTED (terminal state)', () => {
        expect(isValidStatusTransition(StageStatus.APPROVED, StageStatus.REJECTED)).toBe(false);
      });

      it('should NOT allow APPROVED -> FLAGGED (terminal state)', () => {
        expect(isValidStatusTransition(StageStatus.APPROVED, StageStatus.FLAGGED)).toBe(false);
      });
    });

    describe('REJECTED status transitions', () => {
      it('should allow REJECTED -> REJECTED (no-op)', () => {
        expect(isValidStatusTransition(StageStatus.REJECTED, StageStatus.REJECTED)).toBe(true);
      });

      it('should allow REJECTED -> PENDING (retry)', () => {
        expect(isValidStatusTransition(StageStatus.REJECTED, StageStatus.PENDING)).toBe(true);
      });

      it('should NOT allow REJECTED -> APPROVED', () => {
        expect(isValidStatusTransition(StageStatus.REJECTED, StageStatus.APPROVED)).toBe(false);
      });

      it('should NOT allow REJECTED -> FLAGGED', () => {
        expect(isValidStatusTransition(StageStatus.REJECTED, StageStatus.FLAGGED)).toBe(false);
      });
    });

    describe('FLAGGED status transitions', () => {
      it('should allow FLAGGED -> FLAGGED (no-op)', () => {
        expect(isValidStatusTransition(StageStatus.FLAGGED, StageStatus.FLAGGED)).toBe(true);
      });

      it('should allow FLAGGED -> APPROVED (admin resolution)', () => {
        expect(isValidStatusTransition(StageStatus.FLAGGED, StageStatus.APPROVED)).toBe(true);
      });

      it('should allow FLAGGED -> REJECTED (admin resolution)', () => {
        expect(isValidStatusTransition(StageStatus.FLAGGED, StageStatus.REJECTED)).toBe(true);
      });

      it('should NOT allow FLAGGED -> PENDING', () => {
        expect(isValidStatusTransition(StageStatus.FLAGGED, StageStatus.PENDING)).toBe(false);
      });
    });
  });

  describe('VALID_STATUS_TRANSITIONS map', () => {
    it('should have correct transitions for PENDING', () => {
      expect(VALID_STATUS_TRANSITIONS[StageStatus.PENDING]).toEqual([
        StageStatus.APPROVED,
        StageStatus.REJECTED,
        StageStatus.FLAGGED,
      ]);
    });

    it('should have no transitions for APPROVED (terminal)', () => {
      expect(VALID_STATUS_TRANSITIONS[StageStatus.APPROVED]).toEqual([]);
    });

    it('should have correct transitions for REJECTED', () => {
      expect(VALID_STATUS_TRANSITIONS[StageStatus.REJECTED]).toEqual([
        StageStatus.PENDING,
      ]);
    });

    it('should have correct transitions for FLAGGED', () => {
      expect(VALID_STATUS_TRANSITIONS[StageStatus.FLAGGED]).toEqual([
        StageStatus.APPROVED,
        StageStatus.REJECTED,
      ]);
    });
  });
});
