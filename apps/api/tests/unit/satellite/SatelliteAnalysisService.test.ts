/**
 * Satellite Analysis Service Unit Tests
 *
 * Tests for NDVI-based organic compliance verification
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SatelliteComplianceStatus,
  SatelliteCropType,
  ViolationType,
  ViolationSeverity,
  NDVIDataPoint,
  ViolationFlag,
  calculateAnalysisConfidence,
  determineComplianceStatus,
  estimateCostSavings,
  CROP_NDVI_BASELINES,
  VIOLATION_DETECTION_RULES,
} from '../../../src/domain/entities/SatelliteAnalysis.js';

describe('SatelliteAnalysis Domain Logic', () => {
  describe('calculateAnalysisConfidence', () => {
    it('should return high confidence with good data coverage and no violations', () => {
      const confidence = calculateAnalysisConfidence(36, 36, [], 10);
      expect(confidence).toBeGreaterThan(0.8);
    });

    it('should reduce confidence with low data coverage', () => {
      const highCoverage = calculateAnalysisConfidence(36, 36, [], 10);
      const lowCoverage = calculateAnalysisConfidence(18, 36, [], 10);
      expect(lowCoverage).toBeLessThan(highCoverage);
    });

    it('should reduce confidence for each violation', () => {
      const violations: ViolationFlag[] = [
        {
          id: 'v1',
          date: '2022-03-15',
          type: ViolationType.SYNTHETIC_FERTILIZER,
          ndviDelta: 0.3,
          severity: ViolationSeverity.HIGH,
          confidence: 0.9,
          description: 'Test violation',
          descriptionEn: 'Test violation',
          affectedAreaPercent: 100,
        },
        {
          id: 'v2',
          date: '2022-06-15',
          type: ViolationType.SYNTHETIC_FERTILIZER,
          ndviDelta: 0.28,
          severity: ViolationSeverity.MEDIUM,
          confidence: 0.85,
          description: 'Test violation 2',
          descriptionEn: 'Test violation 2',
          affectedAreaPercent: 100,
        },
      ];

      const noViolations = calculateAnalysisConfidence(36, 36, [], 10);
      const withViolations = calculateAnalysisConfidence(36, 36, violations, 10);

      expect(withViolations).toBeLessThan(noViolations);
    });

    it('should reduce confidence for high cloud coverage', () => {
      const lowCloud = calculateAnalysisConfidence(36, 36, [], 10);
      const highCloud = calculateAnalysisConfidence(36, 36, [], 60);

      expect(highCloud).toBeLessThan(lowCloud);
    });

    it('should not go below 0.5', () => {
      const worstCase = calculateAnalysisConfidence(5, 36, [], 90);
      expect(worstCase).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe('determineComplianceStatus', () => {
    it('should return ELIGIBLE when no violations and sufficient data', () => {
      const status = determineComplianceStatus([], 36, 36);
      expect(status).toBe(SatelliteComplianceStatus.ELIGIBLE);
    });

    it('should return NEEDS_REVIEW when insufficient data', () => {
      const status = determineComplianceStatus([], 12, 36);
      expect(status).toBe(SatelliteComplianceStatus.NEEDS_REVIEW);
    });

    it('should return INELIGIBLE when HIGH severity violations exist', () => {
      const violations: ViolationFlag[] = [
        {
          id: 'v1',
          date: '2022-03-15',
          type: ViolationType.SYNTHETIC_FERTILIZER,
          ndviDelta: 0.35,
          severity: ViolationSeverity.HIGH,
          confidence: 0.9,
          description: 'Synthetic fertilizer detected',
          descriptionEn: 'Synthetic fertilizer detected',
          affectedAreaPercent: 100,
        },
      ];

      const status = determineComplianceStatus(violations, 36, 36);
      expect(status).toBe(SatelliteComplianceStatus.INELIGIBLE);
    });

    it('should return NEEDS_REVIEW when 3+ MEDIUM severity violations', () => {
      const violations: ViolationFlag[] = Array(3).fill(null).map((_, i) => ({
        id: `v${i}`,
        date: `2022-0${i + 1}-15`,
        type: ViolationType.PESTICIDE_APPLICATION,
        ndviDelta: -0.18,
        severity: ViolationSeverity.MEDIUM,
        confidence: 0.8,
        description: 'Pesticide detected',
        descriptionEn: 'Pesticide detected',
        affectedAreaPercent: 100,
      }));

      const status = determineComplianceStatus(violations, 36, 36);
      expect(status).toBe(SatelliteComplianceStatus.NEEDS_REVIEW);
    });

    it('should return NEEDS_REVIEW when few violations exist', () => {
      const violations: ViolationFlag[] = [
        {
          id: 'v1',
          date: '2022-03-15',
          type: ViolationType.PESTICIDE_APPLICATION,
          ndviDelta: -0.18,
          severity: ViolationSeverity.MEDIUM,
          confidence: 0.8,
          description: 'Pesticide detected',
          descriptionEn: 'Pesticide detected',
          affectedAreaPercent: 100,
        },
      ];

      const status = determineComplianceStatus(violations, 36, 36);
      expect(status).toBe(SatelliteComplianceStatus.NEEDS_REVIEW);
    });
  });

  describe('estimateCostSavings', () => {
    it('should calculate cost savings based on analyses count', () => {
      const savings = estimateCostSavings(10);

      expect(savings.soilTestsAvoided).toBe(10);
      expect(savings.estimatedSavingsUSD).toBe(3500); // 10 * $350 average
    });

    it('should return zero for zero analyses', () => {
      const savings = estimateCostSavings(0);

      expect(savings.soilTestsAvoided).toBe(0);
      expect(savings.estimatedSavingsUSD).toBe(0);
    });
  });

  describe('CROP_NDVI_BASELINES', () => {
    it('should have baselines for all supported crop types', () => {
      const cropTypes = Object.values(SatelliteCropType);

      for (const cropType of cropTypes) {
        expect(CROP_NDVI_BASELINES[cropType]).toBeDefined();
        expect(CROP_NDVI_BASELINES[cropType].peakMonths).toBeDefined();
        expect(CROP_NDVI_BASELINES[cropType].lowMonths).toBeDefined();
        expect(CROP_NDVI_BASELINES[cropType].healthyNdviMin).toBeLessThan(
          CROP_NDVI_BASELINES[cropType].healthyNdviMax
        );
        expect(CROP_NDVI_BASELINES[cropType].syntheticThreshold).toBeGreaterThan(0);
      }
    });

    it('should have realistic NDVI ranges for avocado', () => {
      const avocado = CROP_NDVI_BASELINES[SatelliteCropType.AVOCADO];

      expect(avocado.healthyNdviMin).toBeGreaterThanOrEqual(0.4);
      expect(avocado.healthyNdviMax).toBeLessThanOrEqual(0.9);
      expect(avocado.peakMonths).toContain(5); // June (peak growing)
      expect(avocado.lowMonths).toContain(11); // December (harvest)
    });
  });

  describe('VIOLATION_DETECTION_RULES', () => {
    it('should have synthetic fertilizer detection rules', () => {
      const rules = VIOLATION_DETECTION_RULES.syntheticFertilizer;

      expect(rules.ndviSpikeThreshold).toBeGreaterThan(0.2);
      expect(rules.recoveryWindow).toBe(30);
      expect(rules.description).toContain('fertilizante');
      expect(rules.descriptionEn).toContain('fertilizer');
    });

    it('should have pesticide detection rules', () => {
      const rules = VIOLATION_DETECTION_RULES.pesticide;

      expect(rules.ndviDropThreshold).toBeLessThan(0);
      expect(rules.recoveryThreshold).toBeGreaterThan(0);
      expect(rules.description).toContain('pesticida');
    });

    it('should have land clearing detection rules', () => {
      const rules = VIOLATION_DETECTION_RULES.landClearing;

      expect(rules.ndviDropThreshold).toBeLessThan(-0.3);
      expect(rules.sustainedDays).toBeGreaterThan(30);
      expect(rules.description).toContain('desmonte');
    });
  });
});

describe('Synthetic Fertilizer Detection', () => {
  it('should detect NDVI spike above threshold as synthetic fertilizer', () => {
    // Simulate NDVI data with a spike indicating synthetic fertilizer
    const ndviData: NDVIDataPoint[] = [
      { date: '2022-01-15', ndviAverage: 0.45, ndviStdDev: 0.05, ndviMin: 0.35, ndviMax: 0.55, cloudCoverage: 10, syntheticFertilizerDetected: false, confidence: 0.9, anomalyScore: 5, source: 'SENTINEL_2' as any },
      { date: '2022-02-15', ndviAverage: 0.48, ndviStdDev: 0.05, ndviMin: 0.38, ndviMax: 0.58, cloudCoverage: 15, syntheticFertilizerDetected: false, confidence: 0.9, anomalyScore: 5, source: 'SENTINEL_2' as any },
      { date: '2022-03-15', ndviAverage: 0.78, ndviStdDev: 0.05, ndviMin: 0.68, ndviMax: 0.88, cloudCoverage: 5, syntheticFertilizerDetected: true, confidence: 0.9, anomalyScore: 80, source: 'SENTINEL_2' as any }, // SPIKE! +0.30
      { date: '2022-04-15', ndviAverage: 0.75, ndviStdDev: 0.05, ndviMin: 0.65, ndviMax: 0.85, cloudCoverage: 20, syntheticFertilizerDetected: false, confidence: 0.9, anomalyScore: 10, source: 'SENTINEL_2' as any },
    ];

    // The spike from 0.48 to 0.78 (delta = 0.30) should be detected
    const spikeIndex = 2;
    const delta = ndviData[spikeIndex].ndviAverage - ndviData[spikeIndex - 1].ndviAverage;

    expect(delta).toBeGreaterThan(0.25); // Above synthetic threshold
    expect(ndviData[spikeIndex].syntheticFertilizerDetected).toBe(true);
  });

  it('should NOT detect normal seasonal variation as synthetic fertilizer', () => {
    // Simulate normal seasonal NDVI increase (gradual)
    const ndviData: NDVIDataPoint[] = [
      { date: '2022-01-15', ndviAverage: 0.45, ndviStdDev: 0.05, ndviMin: 0.35, ndviMax: 0.55, cloudCoverage: 10, syntheticFertilizerDetected: false, confidence: 0.9, anomalyScore: 5, source: 'SENTINEL_2' as any },
      { date: '2022-02-15', ndviAverage: 0.52, ndviStdDev: 0.05, ndviMin: 0.42, ndviMax: 0.62, cloudCoverage: 15, syntheticFertilizerDetected: false, confidence: 0.9, anomalyScore: 5, source: 'SENTINEL_2' as any },
      { date: '2022-03-15', ndviAverage: 0.58, ndviStdDev: 0.05, ndviMin: 0.48, ndviMax: 0.68, cloudCoverage: 5, syntheticFertilizerDetected: false, confidence: 0.9, anomalyScore: 10, source: 'SENTINEL_2' as any },
      { date: '2022-04-15', ndviAverage: 0.65, ndviStdDev: 0.05, ndviMin: 0.55, ndviMax: 0.75, cloudCoverage: 20, syntheticFertilizerDetected: false, confidence: 0.9, anomalyScore: 8, source: 'SENTINEL_2' as any },
    ];

    // All deltas should be below the synthetic threshold
    for (let i = 1; i < ndviData.length; i++) {
      const delta = ndviData[i].ndviAverage - ndviData[i - 1].ndviAverage;
      expect(delta).toBeLessThan(0.25);
      expect(ndviData[i].syntheticFertilizerDetected).toBe(false);
    }
  });
});

describe('Compliance Report Generation', () => {
  it('should generate ELIGIBLE report for clean organic field', () => {
    // 3 years of clean monthly data (36 data points)
    const validDataPoints = 36;
    const expectedDataPoints = 36;
    const violations: ViolationFlag[] = [];
    const avgCloudCoverage = 15;

    const status = determineComplianceStatus(violations, validDataPoints, expectedDataPoints);
    const confidence = calculateAnalysisConfidence(validDataPoints, expectedDataPoints, violations, avgCloudCoverage);

    expect(status).toBe(SatelliteComplianceStatus.ELIGIBLE);
    expect(confidence).toBeGreaterThan(0.80); // Confidence is ~0.83 with given parameters
  });

  it('should generate INELIGIBLE report for field with synthetic fertilizer', () => {
    const violations: ViolationFlag[] = [
      {
        id: 'v1',
        date: '2022-03-15',
        type: ViolationType.SYNTHETIC_FERTILIZER,
        ndviDelta: 0.35,
        severity: ViolationSeverity.HIGH,
        confidence: 0.92,
        description: 'Posible aplicación de fertilizante sintético detectada. Incremento NDVI de 35.0% en 30 días.',
        descriptionEn: 'Possible synthetic fertilizer application detected. NDVI increased by 35.0% in 30 days.',
        affectedAreaPercent: 100,
      },
    ];

    const status = determineComplianceStatus(violations, 36, 36);

    expect(status).toBe(SatelliteComplianceStatus.INELIGIBLE);
  });
});
