/**
 * Traceability 2.0 - Cold Chain Temperature Log
 * Unit Tests for Temperature Domain Logic
 */

import { describe, it, expect } from 'vitest';
import {
  TemperatureReading,
  TemperatureSource,
  isTemperatureInRange,
  getAlertSeverity,
  calculateTemperatureStats,
  detectRapidChange,
  DEFAULT_THRESHOLDS,
} from '../../../src/domain/entities/TemperatureReading.js';

describe('TemperatureReading Domain Logic', () => {
  describe('isTemperatureInRange', () => {
    it('should return true for temperature within range', () => {
      expect(isTemperatureInRange(4, 0, 8)).toBe(true);
      expect(isTemperatureInRange(0, 0, 8)).toBe(true);
      expect(isTemperatureInRange(8, 0, 8)).toBe(true);
    });

    it('should return false for temperature below minimum', () => {
      expect(isTemperatureInRange(-1, 0, 8)).toBe(false);
      expect(isTemperatureInRange(-5, 0, 8)).toBe(false);
    });

    it('should return false for temperature above maximum', () => {
      expect(isTemperatureInRange(9, 0, 8)).toBe(false);
      expect(isTemperatureInRange(15, 0, 8)).toBe(false);
    });

    it('should handle negative thresholds', () => {
      expect(isTemperatureInRange(-2, -5, 0)).toBe(true);
      expect(isTemperatureInRange(-6, -5, 0)).toBe(false);
    });
  });

  describe('getAlertSeverity', () => {
    it('should return null for temperature in range', () => {
      expect(getAlertSeverity(4, 0, 8)).toBeNull();
    });

    it('should return WARNING for small deviation', () => {
      expect(getAlertSeverity(10, 0, 8)).toBe('WARNING');
      expect(getAlertSeverity(-2, 0, 8)).toBe('WARNING');
    });

    it('should return CRITICAL for large deviation (>5°C)', () => {
      expect(getAlertSeverity(15, 0, 8)).toBe('CRITICAL');
      expect(getAlertSeverity(-10, 0, 8)).toBe('CRITICAL');
    });

    it('should handle edge case at threshold boundary', () => {
      // Exactly 5°C deviation should be WARNING
      expect(getAlertSeverity(13, 0, 8)).toBe('WARNING');
      // More than 5°C should be CRITICAL
      expect(getAlertSeverity(14, 0, 8)).toBe('CRITICAL');
    });
  });

  describe('calculateTemperatureStats', () => {
    const createReading = (
      id: string,
      value: number,
      isOutOfRange: boolean,
      timestamp: Date
    ): TemperatureReading => ({
      id,
      batchId: 'batch-1',
      value,
      humidity: 60,
      source: TemperatureSource.IOT_SENSOR,
      minThreshold: 0,
      maxThreshold: 8,
      isOutOfRange,
      sensorId: 'sensor-1',
      deviceId: null,
      latitude: null,
      longitude: null,
      recordedBy: null,
      timestamp,
    });

    it('should return null for empty readings', () => {
      expect(calculateTemperatureStats([])).toBeNull();
    });

    it('should calculate correct statistics', () => {
      const readings: TemperatureReading[] = [
        createReading('1', 4, false, new Date('2024-01-01T10:00:00Z')),
        createReading('2', 6, false, new Date('2024-01-01T11:00:00Z')),
        createReading('3', 2, false, new Date('2024-01-01T12:00:00Z')),
        createReading('4', 10, true, new Date('2024-01-01T13:00:00Z')),
      ];

      const stats = calculateTemperatureStats(readings);

      expect(stats).not.toBeNull();
      expect(stats!.count).toBe(4);
      expect(stats!.minValue).toBe(2);
      expect(stats!.maxValue).toBe(10);
      expect(stats!.avgValue).toBe(5.5);
      expect(stats!.outOfRangeCount).toBe(1);
      expect(stats!.outOfRangePercent).toBe(25);
      expect(stats!.isCompliant).toBe(false);
    });

    it('should identify compliant batch', () => {
      const readings: TemperatureReading[] = [
        createReading('1', 4, false, new Date('2024-01-01T10:00:00Z')),
        createReading('2', 5, false, new Date('2024-01-01T11:00:00Z')),
        createReading('3', 3, false, new Date('2024-01-01T12:00:00Z')),
      ];

      const stats = calculateTemperatureStats(readings);

      expect(stats!.isCompliant).toBe(true);
      expect(stats!.outOfRangeCount).toBe(0);
    });

    it('should calculate first and last reading timestamps', () => {
      const readings: TemperatureReading[] = [
        createReading('2', 5, false, new Date('2024-01-01T11:00:00Z')),
        createReading('1', 4, false, new Date('2024-01-01T10:00:00Z')),
        createReading('3', 3, false, new Date('2024-01-01T12:00:00Z')),
      ];

      const stats = calculateTemperatureStats(readings);

      expect(stats!.firstReading).toEqual(new Date('2024-01-01T10:00:00Z'));
      expect(stats!.lastReading).toEqual(new Date('2024-01-01T12:00:00Z'));
    });
  });

  describe('detectRapidChange', () => {
    const createReading = (
      id: string,
      value: number,
      timestamp: Date
    ): TemperatureReading => ({
      id,
      batchId: 'batch-1',
      value,
      humidity: 60,
      source: TemperatureSource.IOT_SENSOR,
      minThreshold: 0,
      maxThreshold: 8,
      isOutOfRange: false,
      sensorId: 'sensor-1',
      deviceId: null,
      latitude: null,
      longitude: null,
      recordedBy: null,
      timestamp,
    });

    it('should return empty array for less than 2 readings', () => {
      expect(detectRapidChange([])).toHaveLength(0);
      expect(detectRapidChange([createReading('1', 4, new Date())])).toHaveLength(0);
    });

    it('should detect rapid temperature increase', () => {
      const readings: TemperatureReading[] = [
        createReading('1', 4, new Date('2024-01-01T10:00:00Z')),
        createReading('2', 10, new Date('2024-01-01T11:00:00Z')), // 6°C in 1 hour
      ];

      const rapidChanges = detectRapidChange(readings, 3);

      expect(rapidChanges).toHaveLength(1);
      expect(rapidChanges[0].id).toBe('2');
    });

    it('should detect rapid temperature decrease', () => {
      const readings: TemperatureReading[] = [
        createReading('1', 10, new Date('2024-01-01T10:00:00Z')),
        createReading('2', 2, new Date('2024-01-01T11:00:00Z')), // -8°C in 1 hour
      ];

      const rapidChanges = detectRapidChange(readings, 3);

      expect(rapidChanges).toHaveLength(1);
    });

    it('should not flag gradual changes', () => {
      const readings: TemperatureReading[] = [
        createReading('1', 4, new Date('2024-01-01T10:00:00Z')),
        createReading('2', 5, new Date('2024-01-01T11:00:00Z')), // 1°C in 1 hour
        createReading('3', 6, new Date('2024-01-01T12:00:00Z')), // 1°C in 1 hour
      ];

      const rapidChanges = detectRapidChange(readings, 3);

      expect(rapidChanges).toHaveLength(0);
    });

    it('should handle out-of-order readings', () => {
      const readings: TemperatureReading[] = [
        createReading('2', 10, new Date('2024-01-01T11:00:00Z')),
        createReading('1', 4, new Date('2024-01-01T10:00:00Z')),
      ];

      const rapidChanges = detectRapidChange(readings, 3);

      // Should sort and detect the change
      expect(rapidChanges).toHaveLength(1);
    });

    it('should skip readings at same timestamp', () => {
      const readings: TemperatureReading[] = [
        createReading('1', 4, new Date('2024-01-01T10:00:00Z')),
        createReading('2', 10, new Date('2024-01-01T10:00:00Z')),
      ];

      const rapidChanges = detectRapidChange(readings, 3);

      expect(rapidChanges).toHaveLength(0);
    });
  });

  describe('DEFAULT_THRESHOLDS', () => {
    it('should have correct thresholds for berries', () => {
      expect(DEFAULT_THRESHOLDS.BERRIES).toEqual({ min: 0, max: 4 });
    });

    it('should have correct thresholds for avocado', () => {
      expect(DEFAULT_THRESHOLDS.AVOCADO).toEqual({ min: 5, max: 12 });
    });

    it('should have correct thresholds for mango', () => {
      expect(DEFAULT_THRESHOLDS.MANGO).toEqual({ min: 10, max: 13 });
    });

    it('should have correct thresholds for citrus', () => {
      expect(DEFAULT_THRESHOLDS.CITRUS).toEqual({ min: 3, max: 8 });
    });

    it('should have correct thresholds for vegetables', () => {
      expect(DEFAULT_THRESHOLDS.VEGETABLES).toEqual({ min: 0, max: 5 });
    });

    it('should have correct default thresholds', () => {
      expect(DEFAULT_THRESHOLDS.DEFAULT).toEqual({ min: 0, max: 8 });
    });
  });

  describe('TemperatureSource enum', () => {
    it('should have all expected sources', () => {
      expect(TemperatureSource.IOT_SENSOR).toBe('IOT_SENSOR');
      expect(TemperatureSource.MANUAL).toBe('MANUAL');
      expect(TemperatureSource.DRIVER_APP).toBe('DRIVER_APP');
    });
  });
});
