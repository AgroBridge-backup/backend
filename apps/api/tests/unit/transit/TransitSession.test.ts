/**
 * Traceability 2.0 - Real-Time Transit Tracking
 * Unit Tests for Transit Domain Logic
 */

import { describe, it, expect } from 'vitest';
import {
  TransitStatus,
  isValidStatusTransition,
  calculateDistance,
  calculateRouteDeviation,
  calculateProgress,
  estimateArrival,
} from '../../../src/domain/entities/TransitSession.js';

describe('TransitSession Domain Entity', () => {
  describe('TransitStatus', () => {
    it('should have all expected statuses', () => {
      expect(TransitStatus.SCHEDULED).toBe('SCHEDULED');
      expect(TransitStatus.IN_TRANSIT).toBe('IN_TRANSIT');
      expect(TransitStatus.PAUSED).toBe('PAUSED');
      expect(TransitStatus.DELAYED).toBe('DELAYED');
      expect(TransitStatus.COMPLETED).toBe('COMPLETED');
      expect(TransitStatus.CANCELLED).toBe('CANCELLED');
    });
  });

  describe('isValidStatusTransition', () => {
    it('allows SCHEDULED -> IN_TRANSIT', () => {
      expect(isValidStatusTransition(TransitStatus.SCHEDULED, TransitStatus.IN_TRANSIT)).toBe(true);
    });

    it('allows SCHEDULED -> CANCELLED', () => {
      expect(isValidStatusTransition(TransitStatus.SCHEDULED, TransitStatus.CANCELLED)).toBe(true);
    });

    it('allows IN_TRANSIT -> PAUSED', () => {
      expect(isValidStatusTransition(TransitStatus.IN_TRANSIT, TransitStatus.PAUSED)).toBe(true);
    });

    it('allows IN_TRANSIT -> COMPLETED', () => {
      expect(isValidStatusTransition(TransitStatus.IN_TRANSIT, TransitStatus.COMPLETED)).toBe(true);
    });

    it('allows PAUSED -> IN_TRANSIT (resume)', () => {
      expect(isValidStatusTransition(TransitStatus.PAUSED, TransitStatus.IN_TRANSIT)).toBe(true);
    });

    it('disallows SCHEDULED -> COMPLETED (must transit first)', () => {
      expect(isValidStatusTransition(TransitStatus.SCHEDULED, TransitStatus.COMPLETED)).toBe(false);
    });

    it('disallows COMPLETED -> any (terminal state)', () => {
      expect(isValidStatusTransition(TransitStatus.COMPLETED, TransitStatus.IN_TRANSIT)).toBe(false);
      expect(isValidStatusTransition(TransitStatus.COMPLETED, TransitStatus.CANCELLED)).toBe(false);
    });

    it('disallows CANCELLED -> any (terminal state)', () => {
      expect(isValidStatusTransition(TransitStatus.CANCELLED, TransitStatus.IN_TRANSIT)).toBe(false);
    });
  });

  describe('calculateDistance', () => {
    it('returns 0 for same coordinates', () => {
      const distance = calculateDistance(19.4326, -99.1332, 19.4326, -99.1332);
      expect(distance).toBe(0);
    });

    it('calculates distance between Mexico City and Guadalajara (~460km)', () => {
      // Mexico City: 19.4326, -99.1332
      // Guadalajara: 20.6597, -103.3496
      const distance = calculateDistance(19.4326, -99.1332, 20.6597, -103.3496);
      expect(distance).toBeGreaterThan(450);
      expect(distance).toBeLessThan(480);
    });

    it('calculates distance between two nearby points', () => {
      // ~1km apart
      const distance = calculateDistance(19.4326, -99.1332, 19.4416, -99.1332);
      expect(distance).toBeGreaterThan(0.9);
      expect(distance).toBeLessThan(1.1);
    });
  });

  describe('calculateRouteDeviation', () => {
    it('returns 0 when point is on the direct path', () => {
      // Point exactly between origin and destination
      const deviation = calculateRouteDeviation(
        19.5, -99.5, // current
        19.0, -99.0, // origin
        20.0, -100.0 // destination
      );
      expect(deviation).toBeLessThan(0.1);
    });

    it('detects significant deviation from route', () => {
      const deviation = calculateRouteDeviation(
        19.5, -98.0, // current (way off to the east)
        19.0, -99.0, // origin
        20.0, -100.0 // destination
      );
      expect(deviation).toBeGreaterThan(50); // Should be significant deviation
    });

    it('returns distance from origin when before origin', () => {
      const deviation = calculateRouteDeviation(
        18.0, -99.0, // current (before origin)
        19.0, -99.0, // origin
        20.0, -100.0 // destination
      );
      expect(deviation).toBeGreaterThan(100); // ~111km
    });
  });

  describe('calculateProgress', () => {
    it('returns 0 when no distance traveled', () => {
      expect(calculateProgress(0, 100)).toBe(0);
    });

    it('returns 50 when halfway', () => {
      expect(calculateProgress(50, 100)).toBe(50);
    });

    it('returns 100 when complete', () => {
      expect(calculateProgress(100, 100)).toBe(100);
    });

    it('caps at 100 for over-travel', () => {
      expect(calculateProgress(120, 100)).toBe(100);
    });

    it('handles edge case of 0 total distance', () => {
      expect(calculateProgress(50, 0)).toBe(0);
    });
  });

  describe('estimateArrival', () => {
    it('returns null for 0 speed', () => {
      expect(estimateArrival(100, 0)).toBeNull();
    });

    it('returns null for 0 remaining distance', () => {
      expect(estimateArrival(0, 60)).toBeNull();
    });

    it('calculates ETA correctly', () => {
      const now = Date.now();
      const eta = estimateArrival(60, 60); // 60km at 60km/h = 1 hour

      expect(eta).not.toBeNull();
      // ETA should be roughly 1 hour from now
      const oneHourFromNow = now + 60 * 60 * 1000;
      expect(eta!.getTime()).toBeGreaterThan(oneHourFromNow - 1000);
      expect(eta!.getTime()).toBeLessThan(oneHourFromNow + 1000);
    });
  });
});
