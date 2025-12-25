/**
 * SatelliteImageryService Unit Tests
 * GPS Satellite Imagery - Traceability 2.0
 *
 * Tests the service layer for satellite imagery management,
 * including field creation, time-lapse generation, and health analysis.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SatelliteImageryService } from '../../../src/domain/services/SatelliteImageryService.js';
import { IFieldRepository, IFieldImageryRepository } from '../../../src/domain/repositories/IFieldImageryRepository.js';
import {
  Field,
  FieldImagery,
  FieldStatus,
  ImagerySource,
  ImageryType,
  GeoJsonPolygon,
} from '../../../src/domain/entities/FieldImagery.js';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../../../src/shared/errors/AppError.js';

// ═══════════════════════════════════════════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════════════════════════════════════════

const mockPrisma = {
  producer: {
    findUnique: vi.fn(),
  },
  batch: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
} as unknown as PrismaClient;

const mockFieldRepository: IFieldRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findByProducerId: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockImageryRepository: IFieldImageryRepository = {
  create: vi.fn(),
  findByFieldId: vi.fn(),
  findByFieldIdAndDateRange: vi.fn(),
  findLatestByFieldId: vi.fn(),
  getNdviTimeSeries: vi.fn(),
  getStatsByFieldId: vi.fn(),
};

const FIXED_DATE = new Date('2025-01-15T12:00:00Z');

// ═══════════════════════════════════════════════════════════════════════════════
// TEST FIXTURES
// ═══════════════════════════════════════════════════════════════════════════════

const validPolygon: GeoJsonPolygon = {
  type: 'Polygon',
  coordinates: [[
    [-101.5, 19.5],
    [-101.4, 19.5],
    [-101.4, 19.6],
    [-101.5, 19.6],
    [-101.5, 19.5],
  ]],
};

const mockField: Field = {
  id: 'field-123',
  producerId: 'producer-456',
  name: 'Test Field',
  description: 'A test avocado field',
  status: FieldStatus.ACTIVE,
  cropType: 'HASS',
  varietyName: 'Hass Avocado',
  plantingDate: new Date('2024-01-01'),
  expectedHarvestDate: new Date('2025-06-01'),
  areaHectares: 50,
  boundaryGeoJson: validPolygon,
  centroidLatitude: 19.55,
  centroidLongitude: -101.45,
  altitude: 1800,
  soilType: 'Volcanic',
  irrigationType: 'Drip',
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
};

const mockImagery: FieldImagery = {
  id: 'imagery-789',
  fieldId: 'field-123',
  source: ImagerySource.SENTINEL_2,
  imageType: ImageryType.NDVI,
  captureDate: FIXED_DATE,
  cloudCoverPercent: 10,
  resolution: 10,
  imageUrl: 'https://cdn.example.com/imagery/123.tif',
  thumbnailUrl: 'https://cdn.example.com/imagery/123_thumb.png',
  ndviValue: 0.65,
  ndwiValue: 0.3,
  healthScore: 75,
  anomalyDetected: false,
  anomalyDetails: null,
  metadata: { satellite: 'Sentinel-2A', sensor: 'MSI' },
  createdAt: FIXED_DATE,
};

const mockProducer = {
  id: 'producer-456',
  businessName: 'Rancho Los Aguacates',
};

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════════════════════

describe('SatelliteImageryService', () => {
  let service: SatelliteImageryService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_DATE);
    service = new SatelliteImageryService(
      mockPrisma,
      mockFieldRepository,
      mockImageryRepository
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // createField() Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('createField()', () => {
    it('should create field with valid polygon', async () => {
      vi.mocked(mockPrisma.producer.findUnique).mockResolvedValue(mockProducer);
      vi.mocked(mockFieldRepository.create).mockResolvedValue(mockField);

      const result = await service.createField({
        producerId: 'producer-456',
        name: 'Test Field',
        boundaryGeoJson: validPolygon,
        areaHectares: 50,
      });

      expect(result.field).toEqual(mockField);
      expect(mockFieldRepository.create).toHaveBeenCalled();
    });

    it('should throw error for invalid polygon', async () => {
      const invalidPolygon = {
        type: 'Polygon',
        coordinates: [], // Empty coordinates
      } as GeoJsonPolygon;

      await expect(service.createField({
        producerId: 'producer-456',
        name: 'Test Field',
        boundaryGeoJson: invalidPolygon,
        areaHectares: 50,
      })).rejects.toThrow(AppError);

      await expect(service.createField({
        producerId: 'producer-456',
        name: 'Test Field',
        boundaryGeoJson: invalidPolygon,
        areaHectares: 50,
      })).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should throw 404 when producer not found', async () => {
      vi.mocked(mockPrisma.producer.findUnique).mockResolvedValue(null);

      await expect(service.createField({
        producerId: 'nonexistent',
        name: 'Test Field',
        boundaryGeoJson: validPolygon,
        areaHectares: 50,
      })).rejects.toThrow(AppError);

      await expect(service.createField({
        producerId: 'nonexistent',
        name: 'Test Field',
        boundaryGeoJson: validPolygon,
        areaHectares: 50,
      })).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should calculate area if not provided', async () => {
      vi.mocked(mockPrisma.producer.findUnique).mockResolvedValue(mockProducer);
      vi.mocked(mockFieldRepository.create).mockResolvedValue(mockField);

      const result = await service.createField({
        producerId: 'producer-456',
        name: 'Test Field',
        boundaryGeoJson: validPolygon,
        // No areaHectares provided
      } as any);

      expect(result.computedArea).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getField() Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getField()', () => {
    it('should return field by ID', async () => {
      vi.mocked(mockFieldRepository.findById).mockResolvedValue(mockField);

      const result = await service.getField('field-123');

      expect(result).toEqual(mockField);
    });

    it('should return null for non-existent field', async () => {
      vi.mocked(mockFieldRepository.findById).mockResolvedValue(null);

      const result = await service.getField('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getProducerFields() Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getProducerFields()', () => {
    it('should return all fields for a producer', async () => {
      vi.mocked(mockFieldRepository.findByProducerId).mockResolvedValue([mockField]);

      const result = await service.getProducerFields('producer-456');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockField);
    });

    it('should return empty array if producer has no fields', async () => {
      vi.mocked(mockFieldRepository.findByProducerId).mockResolvedValue([]);

      const result = await service.getProducerFields('producer-no-fields');

      expect(result).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // updateFieldStatus() Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('updateFieldStatus()', () => {
    it('should update field status', async () => {
      const updatedField = { ...mockField, status: FieldStatus.HARVESTED };
      vi.mocked(mockFieldRepository.findById).mockResolvedValue(mockField);
      vi.mocked(mockFieldRepository.update).mockResolvedValue(updatedField);

      const result = await service.updateFieldStatus('field-123', FieldStatus.HARVESTED);

      expect(result.status).toBe(FieldStatus.HARVESTED);
    });

    it('should throw 404 when field not found', async () => {
      vi.mocked(mockFieldRepository.findById).mockResolvedValue(null);

      await expect(service.updateFieldStatus('nonexistent', FieldStatus.ACTIVE))
        .rejects.toThrow(AppError);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // storeImagery() Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('storeImagery()', () => {
    it('should store imagery for existing field', async () => {
      vi.mocked(mockFieldRepository.findById).mockResolvedValue(mockField);
      vi.mocked(mockImageryRepository.create).mockResolvedValue(mockImagery);

      const imageryData = {
        source: ImagerySource.SENTINEL_2,
        imageType: ImageryType.NDVI,
        captureDate: FIXED_DATE,
        cloudCoverPercent: 10,
        resolution: 10,
        imageUrl: 'https://example.com/imagery.tif',
        thumbnailUrl: null,
        ndviValue: 0.65,
        ndwiValue: null,
        healthScore: 75,
        anomalyDetected: false,
        anomalyDetails: null,
        metadata: {},
      };

      const result = await service.storeImagery('field-123', imageryData);

      expect(result).toEqual(mockImagery);
      expect(mockImageryRepository.create).toHaveBeenCalled();
    });

    it('should throw 404 when field not found', async () => {
      vi.mocked(mockFieldRepository.findById).mockResolvedValue(null);

      await expect(service.storeImagery('nonexistent', {} as any))
        .rejects.toThrow(AppError);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // generateTimeLapse() Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('generateTimeLapse()', () => {
    const startDate = new Date('2024-06-01');
    const endDate = new Date('2024-12-01');

    it('should generate time-lapse from imagery', async () => {
      const imageryList = [
        { ...mockImagery, captureDate: new Date('2024-06-15'), ndviValue: 0.5 },
        { ...mockImagery, captureDate: new Date('2024-07-15'), ndviValue: 0.55 },
        { ...mockImagery, captureDate: new Date('2024-08-15'), ndviValue: 0.6 },
        { ...mockImagery, captureDate: new Date('2024-09-15'), ndviValue: 0.65 },
      ];

      vi.mocked(mockFieldRepository.findById).mockResolvedValue(mockField);
      vi.mocked(mockImageryRepository.findByFieldIdAndDateRange).mockResolvedValue(imageryList);

      const result = await service.generateTimeLapse('field-123', startDate, endDate);

      expect(result.timeLapse.frames).toHaveLength(4);
      expect(result.timeLapse.frameCount).toBe(4);
      expect(result.timeLapse.ndviTrend).toBe('IMPROVING');
    });

    it('should throw 404 when field not found', async () => {
      vi.mocked(mockFieldRepository.findById).mockResolvedValue(null);

      await expect(service.generateTimeLapse('nonexistent', startDate, endDate))
        .rejects.toThrow(AppError);
    });

    it('should filter by cloud cover', async () => {
      const imageryList = [
        { ...mockImagery, cloudCoverPercent: 10 }, // Include
        { ...mockImagery, cloudCoverPercent: 50 }, // Exclude (default maxCloudCover = 30)
        { ...mockImagery, cloudCoverPercent: 5 },  // Include
      ];

      vi.mocked(mockFieldRepository.findById).mockResolvedValue(mockField);
      vi.mocked(mockImageryRepository.findByFieldIdAndDateRange).mockResolvedValue(imageryList);

      const result = await service.generateTimeLapse('field-123', startDate, endDate);

      expect(result.timeLapse.frames).toHaveLength(2);
    });

    it('should handle empty imagery list', async () => {
      vi.mocked(mockFieldRepository.findById).mockResolvedValue(mockField);
      vi.mocked(mockImageryRepository.findByFieldIdAndDateRange).mockResolvedValue([]);

      const result = await service.generateTimeLapse('field-123', startDate, endDate);

      expect(result.timeLapse.frames).toHaveLength(0);
      expect(result.timeLapse.ndviTrend).toBe('UNKNOWN');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // analyzeFieldHealth() Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('analyzeFieldHealth()', () => {
    it('should analyze field health with imagery data', async () => {
      const imageryList = [
        { ...mockImagery, ndviValue: 0.6, cloudCoverPercent: 10 },
        { ...mockImagery, ndviValue: 0.65, cloudCoverPercent: 15 },
        { ...mockImagery, ndviValue: 0.7, cloudCoverPercent: 5 },
      ];

      vi.mocked(mockFieldRepository.findById).mockResolvedValue(mockField);
      vi.mocked(mockImageryRepository.findByFieldIdAndDateRange).mockResolvedValue(imageryList);

      const result = await service.analyzeFieldHealth('field-123');

      expect(result.fieldId).toBe('field-123');
      expect(result.overallHealthScore).toBeGreaterThan(0);
      expect(result.ndviAverage).toBeGreaterThan(0);
      expect(result.recommendations).toBeDefined();
    });

    it('should throw 404 when field not found', async () => {
      vi.mocked(mockFieldRepository.findById).mockResolvedValue(null);

      await expect(service.analyzeFieldHealth('nonexistent'))
        .rejects.toThrow(AppError);
    });

    it('should return critical health for no imagery', async () => {
      vi.mocked(mockFieldRepository.findById).mockResolvedValue(mockField);
      vi.mocked(mockImageryRepository.findByFieldIdAndDateRange).mockResolvedValue([]);

      const result = await service.analyzeFieldHealth('field-123');

      expect(result.healthDistribution.critical).toBe(100);
      expect(result.recommendations).toContain('Insufficient imagery data. Please ensure satellite coverage.');
    });

    it('should detect anomalies from imagery', async () => {
      const imageryWithAnomaly = {
        ...mockImagery,
        anomalyDetected: true,
        anomalyDetails: 'Water stress detected in northwest section',
      };

      vi.mocked(mockFieldRepository.findById).mockResolvedValue(mockField);
      vi.mocked(mockImageryRepository.findByFieldIdAndDateRange).mockResolvedValue([imageryWithAnomaly]);

      const result = await service.analyzeFieldHealth('field-123');

      expect(result.anomalies).toHaveLength(1);
      expect(result.recommendations).toContain('1 anomalies detected. Review affected areas.');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getNdviTimeSeries() Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getNdviTimeSeries()', () => {
    it('should return NDVI time series', async () => {
      const series = [
        { date: new Date('2024-06-01'), ndviValue: 0.5 },
        { date: new Date('2024-07-01'), ndviValue: 0.6 },
      ];
      vi.mocked(mockImageryRepository.getNdviTimeSeries).mockResolvedValue(series);

      const result = await service.getNdviTimeSeries(
        'field-123',
        new Date('2024-06-01'),
        new Date('2024-08-01')
      );

      expect(result).toEqual(series);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getFieldStats() Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getFieldStats()', () => {
    it('should return field statistics', async () => {
      const stats = {
        totalImages: 50,
        latestCapture: FIXED_DATE,
        averageNdvi: 0.65,
        averageHealthScore: 75,
        anomalyCount: 2,
      };
      vi.mocked(mockImageryRepository.getStatsByFieldId).mockResolvedValue(stats);

      const result = await service.getFieldStats('field-123');

      expect(result.totalImages).toBe(50);
      expect(result.averageNdvi).toBe(0.65);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // linkFieldToBatch() Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('linkFieldToBatch()', () => {
    it('should link field to batch', async () => {
      vi.mocked(mockFieldRepository.findById).mockResolvedValue(mockField);
      vi.mocked(mockPrisma.batch.findUnique).mockResolvedValue({ id: 'batch-123' } as any);
      vi.mocked(mockPrisma.batch.update).mockResolvedValue({} as any);

      await expect(service.linkFieldToBatch('field-123', 'batch-123'))
        .resolves.toBeUndefined();

      expect(mockPrisma.batch.update).toHaveBeenCalledWith({
        where: { id: 'batch-123' },
        data: { fieldId: 'field-123' },
      });
    });

    it('should throw 404 when field not found', async () => {
      vi.mocked(mockFieldRepository.findById).mockResolvedValue(null);

      await expect(service.linkFieldToBatch('nonexistent', 'batch-123'))
        .rejects.toMatchObject({ statusCode: 404, message: 'Field not found' });
    });

    it('should throw 404 when batch not found', async () => {
      vi.mocked(mockFieldRepository.findById).mockResolvedValue(mockField);
      vi.mocked(mockPrisma.batch.findUnique).mockResolvedValue(null);

      await expect(service.linkFieldToBatch('field-123', 'nonexistent'))
        .rejects.toMatchObject({ statusCode: 404, message: 'Batch not found' });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getLatestImagery() Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getLatestImagery()', () => {
    it('should return latest imagery for field', async () => {
      vi.mocked(mockImageryRepository.findLatestByFieldId).mockResolvedValue(mockImagery);

      const result = await service.getLatestImagery('field-123');

      expect(result).toEqual(mockImagery);
    });

    it('should return null if no imagery exists', async () => {
      vi.mocked(mockImageryRepository.findLatestByFieldId).mockResolvedValue(null);

      const result = await service.getLatestImagery('field-no-imagery');

      expect(result).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getFieldImagery() Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getFieldImagery()', () => {
    it('should return all imagery for field', async () => {
      vi.mocked(mockImageryRepository.findByFieldId).mockResolvedValue([mockImagery]);

      const result = await service.getFieldImagery('field-123');

      expect(result).toHaveLength(1);
    });

    it('should filter by date range when provided', async () => {
      vi.mocked(mockImageryRepository.findByFieldIdAndDateRange).mockResolvedValue([mockImagery]);

      const result = await service.getFieldImagery(
        'field-123',
        new Date('2024-01-01'),
        new Date('2024-12-31')
      );

      expect(result).toHaveLength(1);
      expect(mockImageryRepository.findByFieldIdAndDateRange).toHaveBeenCalled();
    });
  });
});
