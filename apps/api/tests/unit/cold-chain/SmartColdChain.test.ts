/**
 * Smart-Cold Chain Domain Logic Tests
 *
 * Tests for cold chain thresholds, compliance scoring, and quality grading
 */

import { describe, it, expect } from 'vitest';
import {
  CropType,
  QualityGradeType,
  BreachSeverity,
  COLD_CHAIN_THRESHOLDS,
  calculateComplianceScore,
  calculateQualityGrade,
  calculateBreachSeverity,
  isTemperatureCompliant,
  isHumidityCompliant,
  calculateShelfLife,
  estimateMarketPrice,
  gradeBrixLevel,
  gradePhLevel,
} from '../../../src/domain/entities/SmartColdChain.js';

// ════════════════════════════════════════════════════════════════════════════════
// COLD CHAIN THRESHOLDS
// ════════════════════════════════════════════════════════════════════════════════

describe('COLD_CHAIN_THRESHOLDS', () => {
  it('should have thresholds for all crop types', () => {
    const cropTypes = Object.values(CropType);

    for (const cropType of cropTypes) {
      expect(COLD_CHAIN_THRESHOLDS[cropType]).toBeDefined();
      expect(COLD_CHAIN_THRESHOLDS[cropType].minTemp).toBeDefined();
      expect(COLD_CHAIN_THRESHOLDS[cropType].maxTemp).toBeDefined();
      expect(COLD_CHAIN_THRESHOLDS[cropType].targetHumidity).toBeDefined();
      expect(COLD_CHAIN_THRESHOLDS[cropType].brixMin).toBeDefined();
      expect(COLD_CHAIN_THRESHOLDS[cropType].brixMax).toBeDefined();
      expect(COLD_CHAIN_THRESHOLDS[cropType].phMin).toBeDefined();
      expect(COLD_CHAIN_THRESHOLDS[cropType].phMax).toBeDefined();
    }
  });

  it('should have valid temperature ranges for avocado', () => {
    const avocado = COLD_CHAIN_THRESHOLDS[CropType.AVOCADO];

    expect(avocado.minTemp).toBe(5);
    expect(avocado.maxTemp).toBe(7);
    expect(avocado.maxTemp).toBeGreaterThan(avocado.minTemp);
  });

  it('should have stricter temperature for berries than avocado', () => {
    const avocado = COLD_CHAIN_THRESHOLDS[CropType.AVOCADO];
    const blueberry = COLD_CHAIN_THRESHOLDS[CropType.BLUEBERRY];

    expect(blueberry.maxTemp).toBeLessThan(avocado.minTemp);
  });

  it('should have ambient temperature for coffee', () => {
    const coffee = COLD_CHAIN_THRESHOLDS[CropType.COFFEE];

    expect(coffee.minTemp).toBe(15);
    expect(coffee.maxTemp).toBe(25);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// TEMPERATURE COMPLIANCE
// ════════════════════════════════════════════════════════════════════════════════

describe('isTemperatureCompliant', () => {
  it('should return true for temperature within range for avocado', () => {
    expect(isTemperatureCompliant(CropType.AVOCADO, 6)).toBe(true);
    expect(isTemperatureCompliant(CropType.AVOCADO, 5)).toBe(true);
    expect(isTemperatureCompliant(CropType.AVOCADO, 7)).toBe(true);
  });

  it('should return false for temperature outside range for avocado', () => {
    expect(isTemperatureCompliant(CropType.AVOCADO, 4)).toBe(false);
    expect(isTemperatureCompliant(CropType.AVOCADO, 8)).toBe(false);
    expect(isTemperatureCompliant(CropType.AVOCADO, 10)).toBe(false);
  });

  it('should return true for temperature within range for blueberry', () => {
    expect(isTemperatureCompliant(CropType.BLUEBERRY, 0)).toBe(true);
    expect(isTemperatureCompliant(CropType.BLUEBERRY, 2)).toBe(true);
    expect(isTemperatureCompliant(CropType.BLUEBERRY, 4)).toBe(true);
  });

  it('should return false for temperature outside range for blueberry', () => {
    expect(isTemperatureCompliant(CropType.BLUEBERRY, -1)).toBe(false);
    expect(isTemperatureCompliant(CropType.BLUEBERRY, 5)).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// HUMIDITY COMPLIANCE
// ════════════════════════════════════════════════════════════════════════════════

describe('isHumidityCompliant', () => {
  it('should return true for humidity within tolerance for avocado', () => {
    const avocado = COLD_CHAIN_THRESHOLDS[CropType.AVOCADO];
    const target = avocado.targetHumidity;
    const tolerance = avocado.humidityTolerance;

    expect(isHumidityCompliant(CropType.AVOCADO, target)).toBe(true);
    expect(isHumidityCompliant(CropType.AVOCADO, target + tolerance)).toBe(true);
    expect(isHumidityCompliant(CropType.AVOCADO, target - tolerance)).toBe(true);
  });

  it('should return false for humidity outside tolerance', () => {
    const avocado = COLD_CHAIN_THRESHOLDS[CropType.AVOCADO];
    const target = avocado.targetHumidity;
    const tolerance = avocado.humidityTolerance;

    expect(isHumidityCompliant(CropType.AVOCADO, target + tolerance + 1)).toBe(false);
    expect(isHumidityCompliant(CropType.AVOCADO, target - tolerance - 1)).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// COMPLIANCE SCORE
// ════════════════════════════════════════════════════════════════════════════════

describe('calculateComplianceScore', () => {
  it('should return 100 for perfect compliance', () => {
    const score = calculateComplianceScore(100, 100, 0, 0);

    expect(score).toBe(100);
  });

  it('should return 0 for no readings', () => {
    const score = calculateComplianceScore(0, 0, 0, 0);

    expect(score).toBe(0);
  });

  it('should reduce score for non-compliant readings', () => {
    const perfect = calculateComplianceScore(100, 100, 0, 0);
    const partial = calculateComplianceScore(100, 80, 0, 0);

    expect(partial).toBeLessThan(perfect);
  });

  it('should reduce score for breaches', () => {
    const noBreach = calculateComplianceScore(100, 100, 0, 0);
    const withBreach = calculateComplianceScore(100, 100, 5, 0);

    expect(withBreach).toBeLessThan(noBreach);
  });

  it('should reduce score for long breach duration', () => {
    const shortBreach = calculateComplianceScore(100, 100, 1, 10);
    const longBreach = calculateComplianceScore(100, 100, 1, 120);

    expect(longBreach).toBeLessThan(shortBreach);
  });

  it('should not go below 0', () => {
    const worstCase = calculateComplianceScore(100, 0, 10, 300);

    expect(worstCase).toBeGreaterThanOrEqual(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// QUALITY GRADE
// ════════════════════════════════════════════════════════════════════════════════

describe('calculateQualityGrade', () => {
  it('should return PREMIUM for high brix and compliant pH', () => {
    const grade = calculateQualityGrade(CropType.AVOCADO, 7.8, 6.2);

    expect(grade).toBe(QualityGradeType.PREMIUM);
  });

  it('should return EXPORT for normal brix and compliant pH', () => {
    const grade = calculateQualityGrade(CropType.AVOCADO, 6.5, 6.2);

    expect(grade).toBe(QualityGradeType.EXPORT);
  });

  it('should return DOMESTIC for brix in range but pH out of range', () => {
    const grade = calculateQualityGrade(CropType.AVOCADO, 6.5, 7.0);

    expect(grade).toBe(QualityGradeType.DOMESTIC);
  });

  it('should return REJECT for low brix', () => {
    const grade = calculateQualityGrade(CropType.AVOCADO, 4.0, 6.2);

    expect(grade).toBe(QualityGradeType.REJECT);
  });

  it('should return EXPORT if pH is not provided but brix is good', () => {
    const grade = calculateQualityGrade(CropType.AVOCADO, 6.5, null);

    expect(grade).toBe(QualityGradeType.EXPORT);
  });

  it('should work for different crop types', () => {
    // Blueberry: brix 10-15, premium at 13
    expect(calculateQualityGrade(CropType.BLUEBERRY, 14, 3.5)).toBe(QualityGradeType.PREMIUM);
    expect(calculateQualityGrade(CropType.BLUEBERRY, 11, 3.5)).toBe(QualityGradeType.EXPORT);
    expect(calculateQualityGrade(CropType.BLUEBERRY, 8, 3.5)).toBe(QualityGradeType.REJECT);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// BREACH SEVERITY
// ════════════════════════════════════════════════════════════════════════════════

describe('calculateBreachSeverity', () => {
  it('should return LOW for small deviation and short duration', () => {
    const severity = calculateBreachSeverity(0.5, 5);

    expect(severity).toBe(BreachSeverity.LOW);
  });

  it('should return MEDIUM for moderate deviation', () => {
    const severity = calculateBreachSeverity(2, 5);

    expect(severity).toBe(BreachSeverity.MEDIUM);
  });

  it('should return HIGH for significant deviation', () => {
    const severity = calculateBreachSeverity(4, 5);

    expect(severity).toBe(BreachSeverity.HIGH);
  });

  it('should return CRITICAL for large deviation', () => {
    const severity = calculateBreachSeverity(6, 5);

    expect(severity).toBe(BreachSeverity.CRITICAL);
  });

  it('should return CRITICAL for long duration regardless of deviation', () => {
    const severity = calculateBreachSeverity(0.5, 120);

    expect(severity).toBe(BreachSeverity.CRITICAL);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// SHELF LIFE CALCULATION
// ════════════════════════════════════════════════════════════════════════════════

describe('calculateShelfLife', () => {
  it('should return full shelf life for 100% compliance', () => {
    const shelfLife = calculateShelfLife(CropType.AVOCADO, 100, 0);
    const expected = COLD_CHAIN_THRESHOLDS[CropType.AVOCADO].shelfLifeDays;

    expect(shelfLife).toBe(expected);
  });

  it('should reduce shelf life for partial compliance', () => {
    const fullCompliance = calculateShelfLife(CropType.AVOCADO, 100, 0);
    const partialCompliance = calculateShelfLife(CropType.AVOCADO, 80, 0);

    expect(partialCompliance).toBeLessThan(fullCompliance);
  });

  it('should reduce shelf life for time in transit', () => {
    const noTransit = calculateShelfLife(CropType.AVOCADO, 100, 0);
    const withTransit = calculateShelfLife(CropType.AVOCADO, 100, 48);

    expect(withTransit).toBeLessThan(noTransit);
  });

  it('should not go below 0', () => {
    const negative = calculateShelfLife(CropType.AVOCADO, 50, 500);

    expect(negative).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// MARKET PRICE ESTIMATION
// ════════════════════════════════════════════════════════════════════════════════

describe('estimateMarketPrice', () => {
  it('should return higher price for PREMIUM grade', () => {
    const premium = estimateMarketPrice(CropType.AVOCADO, QualityGradeType.PREMIUM);
    const export_ = estimateMarketPrice(CropType.AVOCADO, QualityGradeType.EXPORT);

    expect(premium).toBeGreaterThan(export_);
  });

  it('should return positive price for all grades', () => {
    for (const cropType of Object.values(CropType)) {
      for (const grade of Object.values(QualityGradeType)) {
        const price = estimateMarketPrice(cropType, grade);
        expect(price).toBeGreaterThan(0);
      }
    }
  });

  it('should return higher price for berries than avocado', () => {
    const avocado = estimateMarketPrice(CropType.AVOCADO, QualityGradeType.PREMIUM);
    const blueberry = estimateMarketPrice(CropType.BLUEBERRY, QualityGradeType.PREMIUM);

    expect(blueberry).toBeGreaterThan(avocado);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// BRIX/PH GRADING
// ════════════════════════════════════════════════════════════════════════════════

describe('gradeBrixLevel', () => {
  it('should return EXCELLENT for premium brix', () => {
    const grade = gradeBrixLevel(CropType.AVOCADO, 8);

    expect(grade).toBe('EXCELLENT');
  });

  it('should return GOOD for normal brix', () => {
    const grade = gradeBrixLevel(CropType.AVOCADO, 6.5);

    expect(grade).toBe('GOOD');
  });

  it('should return ACCEPTABLE for slightly low brix', () => {
    const grade = gradeBrixLevel(CropType.AVOCADO, 5.5);

    expect(grade).toBe('ACCEPTABLE');
  });

  it('should return POOR for low brix', () => {
    const grade = gradeBrixLevel(CropType.AVOCADO, 4);

    expect(grade).toBe('POOR');
  });
});

describe('gradePhLevel', () => {
  it('should return EXCELLENT for pH near midpoint', () => {
    // Avocado: pH 6.0-6.5, midpoint is 6.25
    const grade = gradePhLevel(CropType.AVOCADO, 6.25);

    expect(grade).toBe('EXCELLENT');
  });

  it('should return GOOD for pH in range', () => {
    const grade = gradePhLevel(CropType.AVOCADO, 6.0);

    expect(grade).toBe('GOOD');
  });

  it('should return ACCEPTABLE for pH slightly out of range', () => {
    const grade = gradePhLevel(CropType.AVOCADO, 5.9);

    expect(grade).toBe('ACCEPTABLE');
  });

  it('should return POOR for pH far out of range', () => {
    const grade = gradePhLevel(CropType.AVOCADO, 5.0);

    expect(grade).toBe('POOR');
  });
});
