/**
 * Field Imagery Unit Tests
 * GPS Satellite Imagery - Traceability 2.0
 *
 * Tests all utility functions for satellite imagery,
 * including NDVI calculations, health scoring, GeoJSON validation,
 * and polygon area calculations.
 */

import { describe, it, expect } from 'vitest';
import {
  ImagerySource,
  ImageryType,
  FieldStatus,
  GeoJsonPolygon,
  IMAGERY_SOURCE_INFO,
  IMAGE_TYPE_INFO,
  calculateNdvi,
  calculateNdwi,
  calculateEvi,
  ndviToHealthScore,
  getHealthCategory,
  calculateNdviTrend,
  isValidGeoJsonPolygon,
  calculateCentroid,
  calculateAreaHectares,
} from '../../../src/domain/entities/FieldImagery.js';

// ═══════════════════════════════════════════════════════════════════════════════
// calculateNdvi() Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('calculateNdvi()', () => {
  it('should calculate NDVI correctly for healthy vegetation', () => {
    // High NIR, low Red = healthy vegetation (NDVI ~ 0.7-0.9)
    const ndvi = calculateNdvi(0.1, 0.8);
    expect(ndvi).toBeCloseTo(0.778, 2);
  });

  it('should calculate NDVI correctly for bare soil', () => {
    // Similar NIR and Red = bare soil (NDVI ~ 0.1-0.2)
    const ndvi = calculateNdvi(0.2, 0.25);
    expect(ndvi).toBeCloseTo(0.111, 2);
  });

  it('should calculate NDVI correctly for water', () => {
    // Higher Red than NIR = water (NDVI < 0)
    const ndvi = calculateNdvi(0.3, 0.1);
    expect(ndvi).toBeLessThan(0);
  });

  it('should return 0 for zero reflectance', () => {
    const ndvi = calculateNdvi(0, 0);
    expect(ndvi).toBe(0);
  });

  it('should return 1 for maximum vegetation (NIR=1, Red=0)', () => {
    const ndvi = calculateNdvi(0, 1);
    expect(ndvi).toBe(1);
  });

  it('should return -1 for maximum water (NIR=0, Red=1)', () => {
    const ndvi = calculateNdvi(1, 0);
    expect(ndvi).toBe(-1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// calculateNdwi() Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('calculateNdwi()', () => {
  it('should calculate NDWI correctly for water bodies', () => {
    // High Green, low NIR = water (NDWI > 0)
    const ndwi = calculateNdwi(0.5, 0.2);
    expect(ndwi).toBeGreaterThan(0);
  });

  it('should calculate NDWI correctly for vegetation', () => {
    // High NIR, lower Green = vegetation (NDWI < 0)
    const ndwi = calculateNdwi(0.2, 0.6);
    expect(ndwi).toBeLessThan(0);
  });

  it('should return 0 for zero reflectance', () => {
    const ndwi = calculateNdwi(0, 0);
    expect(ndwi).toBe(0);
  });

  it('should calculate NDWI in range [-1, 1]', () => {
    const ndwi1 = calculateNdwi(1, 0);
    const ndwi2 = calculateNdwi(0, 1);
    expect(ndwi1).toBe(1);
    expect(ndwi2).toBe(-1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// calculateEvi() Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('calculateEvi()', () => {
  it('should calculate EVI for typical vegetation', () => {
    const evi = calculateEvi(0.1, 0.1, 0.5);
    expect(evi).toBeDefined();
    expect(typeof evi).toBe('number');
  });

  it('should handle edge case when denominator is zero', () => {
    // Carefully craft values to make denominator 0
    // NIR + 6*Red - 7.5*Blue + 1 = 0
    const evi = calculateEvi(0, 0, -1);
    // With NIR=-1, Red=0, Blue=0: -1 + 0 - 0 + 1 = 0
    // Should return 0 for zero denominator
    expect(typeof evi).toBe('number');
  });

  it('should return positive values for healthy vegetation', () => {
    // High NIR relative to Red
    const evi = calculateEvi(0.05, 0.1, 0.6);
    expect(evi).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ndviToHealthScore() Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('ndviToHealthScore()', () => {
  it('should return 0 for negative NDVI', () => {
    expect(ndviToHealthScore(-0.5)).toBe(0);
    expect(ndviToHealthScore(-0.1)).toBe(0);
  });

  it('should return low scores for low NDVI (0-0.2)', () => {
    const score = ndviToHealthScore(0.1);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(20);
  });

  it('should return fair scores for moderate NDVI (0.2-0.4)', () => {
    const score = ndviToHealthScore(0.3);
    expect(score).toBeGreaterThanOrEqual(20);
    expect(score).toBeLessThanOrEqual(50);
  });

  it('should return good scores for healthy NDVI (0.4-0.6)', () => {
    const score = ndviToHealthScore(0.5);
    expect(score).toBeGreaterThanOrEqual(50);
    expect(score).toBeLessThanOrEqual(80);
  });

  it('should return very good scores for high NDVI (0.6-0.8)', () => {
    const score = ndviToHealthScore(0.7);
    expect(score).toBeGreaterThanOrEqual(80);
    expect(score).toBeLessThanOrEqual(95);
  });

  it('should return excellent scores for very high NDVI (>0.8)', () => {
    const score = ndviToHealthScore(0.9);
    expect(score).toBeGreaterThanOrEqual(95);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('should cap at 100', () => {
    expect(ndviToHealthScore(1.0)).toBeLessThanOrEqual(100);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getHealthCategory() Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('getHealthCategory()', () => {
  it('should return EXCELLENT for scores >= 80', () => {
    expect(getHealthCategory(80)).toBe('EXCELLENT');
    expect(getHealthCategory(95)).toBe('EXCELLENT');
    expect(getHealthCategory(100)).toBe('EXCELLENT');
  });

  it('should return GOOD for scores 60-79', () => {
    expect(getHealthCategory(60)).toBe('GOOD');
    expect(getHealthCategory(70)).toBe('GOOD');
    expect(getHealthCategory(79)).toBe('GOOD');
  });

  it('should return FAIR for scores 40-59', () => {
    expect(getHealthCategory(40)).toBe('FAIR');
    expect(getHealthCategory(50)).toBe('FAIR');
    expect(getHealthCategory(59)).toBe('FAIR');
  });

  it('should return POOR for scores 20-39', () => {
    expect(getHealthCategory(20)).toBe('POOR');
    expect(getHealthCategory(30)).toBe('POOR');
    expect(getHealthCategory(39)).toBe('POOR');
  });

  it('should return CRITICAL for scores < 20', () => {
    expect(getHealthCategory(0)).toBe('CRITICAL');
    expect(getHealthCategory(10)).toBe('CRITICAL');
    expect(getHealthCategory(19)).toBe('CRITICAL');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// calculateNdviTrend() Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('calculateNdviTrend()', () => {
  it('should return UNKNOWN for less than 3 values', () => {
    expect(calculateNdviTrend([])).toBe('UNKNOWN');
    expect(calculateNdviTrend([0.5])).toBe('UNKNOWN');
    expect(calculateNdviTrend([0.5, 0.6])).toBe('UNKNOWN');
  });

  it('should return IMPROVING for increasing values', () => {
    const values = [0.3, 0.4, 0.5, 0.6, 0.7];
    expect(calculateNdviTrend(values)).toBe('IMPROVING');
  });

  it('should return DECLINING for decreasing values', () => {
    const values = [0.7, 0.6, 0.5, 0.4, 0.3];
    expect(calculateNdviTrend(values)).toBe('DECLINING');
  });

  it('should return STABLE for flat values', () => {
    const values = [0.5, 0.5, 0.5, 0.5, 0.5];
    expect(calculateNdviTrend(values)).toBe('STABLE');
  });

  it('should return STABLE for minor fluctuations', () => {
    const values = [0.5, 0.51, 0.49, 0.5, 0.5];
    expect(calculateNdviTrend(values)).toBe('STABLE');
  });

  it('should handle noisy but overall improving trend', () => {
    const values = [0.3, 0.35, 0.32, 0.45, 0.5, 0.55, 0.6];
    const trend = calculateNdviTrend(values);
    expect(trend).toBe('IMPROVING');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// isValidGeoJsonPolygon() Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('isValidGeoJsonPolygon()', () => {
  it('should validate a correct polygon', () => {
    const polygon: GeoJsonPolygon = {
      type: 'Polygon',
      coordinates: [[
        [-101.5, 19.5],
        [-101.4, 19.5],
        [-101.4, 19.6],
        [-101.5, 19.6],
        [-101.5, 19.5], // Closing point
      ]],
    };
    expect(isValidGeoJsonPolygon(polygon)).toBe(true);
  });

  it('should reject polygon with wrong type', () => {
    const invalid = {
      type: 'Point',
      coordinates: [[-101.5, 19.5]],
    } as any;
    expect(isValidGeoJsonPolygon(invalid)).toBe(false);
  });

  it('should reject polygon with empty coordinates', () => {
    const invalid: GeoJsonPolygon = {
      type: 'Polygon',
      coordinates: [],
    };
    expect(isValidGeoJsonPolygon(invalid)).toBe(false);
  });

  it('should reject polygon with less than 4 points', () => {
    const invalid: GeoJsonPolygon = {
      type: 'Polygon',
      coordinates: [[
        [-101.5, 19.5],
        [-101.4, 19.5],
        [-101.5, 19.5], // Only 3 points including closing
      ]],
    };
    expect(isValidGeoJsonPolygon(invalid)).toBe(false);
  });

  it('should reject unclosed polygon (first != last point)', () => {
    const invalid: GeoJsonPolygon = {
      type: 'Polygon',
      coordinates: [[
        [-101.5, 19.5],
        [-101.4, 19.5],
        [-101.4, 19.6],
        [-101.5, 19.6], // Not closing back to first point
      ]],
    };
    expect(isValidGeoJsonPolygon(invalid)).toBe(false);
  });

  it('should reject invalid longitude (> 180)', () => {
    const invalid: GeoJsonPolygon = {
      type: 'Polygon',
      coordinates: [[
        [200, 19.5], // Invalid longitude
        [-101.4, 19.5],
        [-101.4, 19.6],
        [-101.5, 19.6],
        [200, 19.5],
      ]],
    };
    expect(isValidGeoJsonPolygon(invalid)).toBe(false);
  });

  it('should reject invalid latitude (> 90)', () => {
    const invalid: GeoJsonPolygon = {
      type: 'Polygon',
      coordinates: [[
        [-101.5, 100], // Invalid latitude
        [-101.4, 19.5],
        [-101.4, 19.6],
        [-101.5, 19.6],
        [-101.5, 100],
      ]],
    };
    expect(isValidGeoJsonPolygon(invalid)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// calculateCentroid() Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('calculateCentroid()', () => {
  it('should calculate centroid for a square', () => {
    const polygon: GeoJsonPolygon = {
      type: 'Polygon',
      coordinates: [[
        [-101.5, 19.5],
        [-101.4, 19.5],
        [-101.4, 19.6],
        [-101.5, 19.6],
        [-101.5, 19.5],
      ]],
    };
    const centroid = calculateCentroid(polygon);
    expect(centroid.longitude).toBeCloseTo(-101.45, 2);
    expect(centroid.latitude).toBeCloseTo(19.55, 2);
  });

  it('should calculate centroid for a triangle', () => {
    const polygon: GeoJsonPolygon = {
      type: 'Polygon',
      coordinates: [[
        [0, 0],
        [3, 0],
        [1.5, 3],
        [0, 0],
      ]],
    };
    const centroid = calculateCentroid(polygon);
    expect(centroid.longitude).toBeCloseTo(1.5, 2);
    expect(centroid.latitude).toBeCloseTo(1.0, 2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// calculateAreaHectares() Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('calculateAreaHectares()', () => {
  it('should return 0 for polygon with less than 4 points', () => {
    const invalid: GeoJsonPolygon = {
      type: 'Polygon',
      coordinates: [[
        [-101.5, 19.5],
        [-101.4, 19.5],
        [-101.5, 19.5],
      ]],
    };
    expect(calculateAreaHectares(invalid)).toBe(0);
  });

  it('should calculate approximate area for a small field', () => {
    // ~100m x 100m square at equator ≈ 1 hectare
    const polygon: GeoJsonPolygon = {
      type: 'Polygon',
      coordinates: [[
        [0, 0],
        [0.0009, 0],      // ~100m longitude at equator
        [0.0009, 0.0009], // ~100m latitude
        [0, 0.0009],
        [0, 0],
      ]],
    };
    const area = calculateAreaHectares(polygon);
    expect(area).toBeGreaterThan(0);
    expect(area).toBeLessThan(2); // Should be approximately 1 hectare
  });

  it('should calculate larger area for bigger polygon', () => {
    // ~1km x 1km square
    const largePolygon: GeoJsonPolygon = {
      type: 'Polygon',
      coordinates: [[
        [-101.5, 19.5],
        [-101.49, 19.5],
        [-101.49, 19.51],
        [-101.5, 19.51],
        [-101.5, 19.5],
      ]],
    };
    const area = calculateAreaHectares(largePolygon);
    expect(area).toBeGreaterThan(50); // Should be ~100 hectares for 1km x 1km
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Enum Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('ImagerySource Enum', () => {
  it('should have all required sources', () => {
    expect(ImagerySource.SENTINEL_2).toBe('SENTINEL_2');
    expect(ImagerySource.LANDSAT_8).toBe('LANDSAT_8');
    expect(ImagerySource.PLANET).toBe('PLANET');
    expect(ImagerySource.MAXAR).toBe('MAXAR');
    expect(ImagerySource.DRONE).toBe('DRONE');
  });
});

describe('ImageryType Enum', () => {
  it('should have all required types', () => {
    expect(ImageryType.RGB).toBe('RGB');
    expect(ImageryType.NDVI).toBe('NDVI');
    expect(ImageryType.NDWI).toBe('NDWI');
    expect(ImageryType.EVI).toBe('EVI');
    expect(ImageryType.SAVI).toBe('SAVI');
    expect(ImageryType.FALSE_COLOR).toBe('FALSE_COLOR');
  });
});

describe('FieldStatus Enum', () => {
  it('should have all required statuses', () => {
    expect(FieldStatus.ACTIVE).toBe('ACTIVE');
    expect(FieldStatus.FALLOW).toBe('FALLOW');
    expect(FieldStatus.HARVESTED).toBe('HARVESTED');
    expect(FieldStatus.PREPARING).toBe('PREPARING');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// IMAGERY_SOURCE_INFO Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('IMAGERY_SOURCE_INFO', () => {
  it('should have info for all imagery sources', () => {
    expect(IMAGERY_SOURCE_INFO[ImagerySource.SENTINEL_2]).toBeDefined();
    expect(IMAGERY_SOURCE_INFO[ImagerySource.LANDSAT_8]).toBeDefined();
    expect(IMAGERY_SOURCE_INFO[ImagerySource.PLANET]).toBeDefined();
    expect(IMAGERY_SOURCE_INFO[ImagerySource.MAXAR]).toBeDefined();
    expect(IMAGERY_SOURCE_INFO[ImagerySource.DRONE]).toBeDefined();
  });

  it('should have correct free/paid status', () => {
    expect(IMAGERY_SOURCE_INFO[ImagerySource.SENTINEL_2].isFree).toBe(true);
    expect(IMAGERY_SOURCE_INFO[ImagerySource.LANDSAT_8].isFree).toBe(true);
    expect(IMAGERY_SOURCE_INFO[ImagerySource.PLANET].isFree).toBe(false);
    expect(IMAGERY_SOURCE_INFO[ImagerySource.MAXAR].isFree).toBe(false);
  });

  it('should have display names for all sources', () => {
    for (const source of Object.values(ImagerySource)) {
      expect(IMAGERY_SOURCE_INFO[source].displayName).toBeDefined();
      expect(typeof IMAGERY_SOURCE_INFO[source].displayName).toBe('string');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// IMAGE_TYPE_INFO Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('IMAGE_TYPE_INFO', () => {
  it('should have info for all image types', () => {
    expect(IMAGE_TYPE_INFO[ImageryType.RGB]).toBeDefined();
    expect(IMAGE_TYPE_INFO[ImageryType.NDVI]).toBeDefined();
    expect(IMAGE_TYPE_INFO[ImageryType.NDWI]).toBeDefined();
    expect(IMAGE_TYPE_INFO[ImageryType.EVI]).toBeDefined();
    expect(IMAGE_TYPE_INFO[ImageryType.SAVI]).toBeDefined();
    expect(IMAGE_TYPE_INFO[ImageryType.FALSE_COLOR]).toBeDefined();
  });

  it('should have use cases for all types', () => {
    for (const type of Object.values(ImageryType)) {
      expect(IMAGE_TYPE_INFO[type].useCases).toBeDefined();
      expect(Array.isArray(IMAGE_TYPE_INFO[type].useCases)).toBe(true);
      expect(IMAGE_TYPE_INFO[type].useCases.length).toBeGreaterThan(0);
    }
  });
});
