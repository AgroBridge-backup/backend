/**
 * PublicTraceabilityService Unit Tests
 * Feature 6: Consumer QR Code + Public Storytelling
 *
 * Tests the service layer for public-facing traceability,
 * including link generation, scan analytics, and data aggregation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PublicTraceabilityService } from '../../../src/domain/services/PublicTraceabilityService.js';
import { IPublicTraceabilityRepository } from '../../../src/domain/repositories/IPublicTraceabilityRepository.js';
import { PublicTraceabilityLink, QrScanEvent, DeviceType } from '../../../src/domain/entities/PublicTraceability.js';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../../../src/shared/errors/AppError.js';

// ═══════════════════════════════════════════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════════════════════════════════════════

const mockPrisma = {
  batch: {
    findUnique: vi.fn(),
  },
  producer: {
    findFirst: vi.fn(),
  },
} as unknown as PrismaClient;

const mockRepository: IPublicTraceabilityRepository = {
  create: vi.fn(),
  findByBatchId: vi.fn(),
  findByShortCode: vi.fn(),
  update: vi.fn(),
  incrementViewCount: vi.fn(),
  recordScan: vi.fn(),
  getScans: vi.fn(),
  getAnalytics: vi.fn(),
};

// Fixed timestamp for consistent testing
const FIXED_DATE = new Date('2025-01-15T12:00:00Z');

// ═══════════════════════════════════════════════════════════════════════════════
// TEST FIXTURES
// ═══════════════════════════════════════════════════════════════════════════════

const mockExistingLink: PublicTraceabilityLink = {
  id: 'link-123',
  batchId: 'batch-456',
  shortCode: 'ABC12345',
  publicUrl: 'https://agrobridge.io/t/ABC12345',
  qrImageUrl: 'https://cdn.agrobridge.io/qr/ABC12345.png',
  isActive: true,
  viewCount: 42,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-10'),
  expiresAt: null,
};

const mockBatch = {
  id: 'batch-456',
  variety: 'HASS',
  harvestDate: FIXED_DATE,
  weightKg: 500,
  status: 'APPROVED',
  producer: {
    id: 'producer-789',
    businessName: 'Rancho Los Aguacates',
    municipality: 'Uruapan',
    state: 'Michoacán',
    fields: [],
  },
  verificationStages: [
    { stageType: 'HARVEST', status: 'APPROVED', timestamp: FIXED_DATE },
    { stageType: 'PACKING', status: 'APPROVED', timestamp: FIXED_DATE },
  ],
  qualityCertificates: [],
  transitSessions: [],
  temperatureReadings: [],
  nfcSeals: [],
};

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════════════════════

describe('PublicTraceabilityService', () => {
  let service: PublicTraceabilityService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_DATE);
    service = new PublicTraceabilityService(mockPrisma, mockRepository);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // generatePublicLink() Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('generatePublicLink()', () => {
    it('should return existing active link without creating new one', async () => {
      vi.mocked(mockRepository.findByBatchId).mockResolvedValue(mockExistingLink);

      const result = await service.generatePublicLink('batch-456');

      expect(result.isNew).toBe(false);
      expect(result.link).toEqual(mockExistingLink);
      expect(result.publicUrl).toBe(mockExistingLink.publicUrl);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should create new link when none exists', async () => {
      vi.mocked(mockRepository.findByBatchId).mockResolvedValue(null);
      vi.mocked(mockRepository.findByShortCode).mockResolvedValue(null);
      vi.mocked(mockPrisma.batch.findUnique).mockResolvedValue(mockBatch);

      const newLink: PublicTraceabilityLink = {
        ...mockExistingLink,
        id: 'new-link-id',
        viewCount: 0,
      };
      vi.mocked(mockRepository.create).mockResolvedValue(newLink);

      const result = await service.generatePublicLink('batch-456');

      expect(result.isNew).toBe(true);
      expect(mockRepository.create).toHaveBeenCalled();
    });

    it('should throw 404 when batch does not exist', async () => {
      vi.mocked(mockRepository.findByBatchId).mockResolvedValue(null);
      vi.mocked(mockPrisma.batch.findUnique).mockResolvedValue(null);

      await expect(service.generatePublicLink('nonexistent-batch'))
        .rejects.toThrow(AppError);

      await expect(service.generatePublicLink('nonexistent-batch'))
        .rejects.toMatchObject({ statusCode: 404, message: 'Batch not found' });
    });

    it('should retry on short code collision', async () => {
      vi.mocked(mockRepository.findByBatchId).mockResolvedValue(null);
      vi.mocked(mockPrisma.batch.findUnique).mockResolvedValue(mockBatch);

      // First code collides, second doesn't
      vi.mocked(mockRepository.findByShortCode)
        .mockResolvedValueOnce(mockExistingLink)
        .mockResolvedValueOnce(null);

      const newLink: PublicTraceabilityLink = {
        ...mockExistingLink,
        id: 'new-link-id',
      };
      vi.mocked(mockRepository.create).mockResolvedValue(newLink);

      const result = await service.generatePublicLink('batch-456');

      expect(result.isNew).toBe(true);
      expect(mockRepository.findByShortCode).toHaveBeenCalledTimes(2);
    });

    it('should throw error after 10 collision attempts', async () => {
      vi.mocked(mockRepository.findByBatchId).mockResolvedValue(null);
      vi.mocked(mockPrisma.batch.findUnique).mockResolvedValue(mockBatch);

      // All codes collide
      vi.mocked(mockRepository.findByShortCode).mockResolvedValue(mockExistingLink);

      await expect(service.generatePublicLink('batch-456'))
        .rejects.toThrow('Failed to generate unique short code');
    });

    it('should create new link if existing link is inactive', async () => {
      const inactiveLink = { ...mockExistingLink, isActive: false };
      vi.mocked(mockRepository.findByBatchId).mockResolvedValue(inactiveLink);
      vi.mocked(mockRepository.findByShortCode).mockResolvedValue(null);
      vi.mocked(mockPrisma.batch.findUnique).mockResolvedValue(mockBatch);

      const newLink: PublicTraceabilityLink = {
        ...mockExistingLink,
        id: 'new-link-id',
        isActive: true,
      };
      vi.mocked(mockRepository.create).mockResolvedValue(newLink);

      const result = await service.generatePublicLink('batch-456');

      expect(result.isNew).toBe(true);
      expect(mockRepository.create).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // setQrImageUrl() Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('setQrImageUrl()', () => {
    it('should update QR image URL for existing link', async () => {
      vi.mocked(mockRepository.findByShortCode).mockResolvedValue(mockExistingLink);
      const updatedLink = { ...mockExistingLink, qrImageUrl: 'https://new-qr-url.png' };
      vi.mocked(mockRepository.update).mockResolvedValue(updatedLink);

      const result = await service.setQrImageUrl('ABC12345', 'https://new-qr-url.png');

      expect(result.qrImageUrl).toBe('https://new-qr-url.png');
      expect(mockRepository.update).toHaveBeenCalledWith(mockExistingLink.id, {
        qrImageUrl: 'https://new-qr-url.png',
      });
    });

    it('should throw 404 when link not found', async () => {
      vi.mocked(mockRepository.findByShortCode).mockResolvedValue(null);

      await expect(service.setQrImageUrl('INVALID', 'https://qr.png'))
        .rejects.toThrow(AppError);

      await expect(service.setQrImageUrl('INVALID', 'https://qr.png'))
        .rejects.toMatchObject({ statusCode: 404, message: 'Link not found' });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // recordScan() Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('recordScan()', () => {
    it('should record scan event with device detection', async () => {
      vi.mocked(mockRepository.findByShortCode).mockResolvedValue(mockExistingLink);
      vi.mocked(mockRepository.recordScan).mockResolvedValue(undefined);

      await service.recordScan({
        shortCode: 'ABC12345',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        country: 'US',
      });

      expect(mockRepository.recordScan).toHaveBeenCalledWith(
        expect.objectContaining({
          shortCode: 'ABC12345',
          deviceType: DeviceType.MOBILE,
          country: 'US',
        })
      );
    });

    it('should detect browser from user agent', async () => {
      vi.mocked(mockRepository.findByShortCode).mockResolvedValue(mockExistingLink);
      vi.mocked(mockRepository.recordScan).mockResolvedValue(undefined);

      await service.recordScan({
        shortCode: 'ABC12345',
        userAgent: 'Mozilla/5.0 Chrome/91.0',
      });

      expect(mockRepository.recordScan).toHaveBeenCalledWith(
        expect.objectContaining({
          browser: 'Chrome',
        })
      );
    });

    it('should not throw for unknown short code (silent fail for analytics)', async () => {
      vi.mocked(mockRepository.findByShortCode).mockResolvedValue(null);

      // Should not throw, just log warning
      await expect(service.recordScan({
        shortCode: 'UNKNOWN',
      })).resolves.toBeUndefined();

      expect(mockRepository.recordScan).not.toHaveBeenCalled();
    });

    it('should handle missing user agent gracefully', async () => {
      vi.mocked(mockRepository.findByShortCode).mockResolvedValue(mockExistingLink);
      vi.mocked(mockRepository.recordScan).mockResolvedValue(undefined);

      await service.recordScan({
        shortCode: 'ABC12345',
      });

      expect(mockRepository.recordScan).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceType: DeviceType.UNKNOWN,
          browser: null,
          userAgent: null,
        })
      );
    });

    it('should include referrer when provided', async () => {
      vi.mocked(mockRepository.findByShortCode).mockResolvedValue(mockExistingLink);
      vi.mocked(mockRepository.recordScan).mockResolvedValue(undefined);

      await service.recordScan({
        shortCode: 'ABC12345',
        referrer: 'https://google.com',
      });

      expect(mockRepository.recordScan).toHaveBeenCalledWith(
        expect.objectContaining({
          referrer: 'https://google.com',
        })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getScanAnalytics() Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getScanAnalytics()', () => {
    it('should return analytics for existing batch link', async () => {
      vi.mocked(mockRepository.findByBatchId).mockResolvedValue(mockExistingLink);
      const mockAnalytics = {
        shortCode: 'ABC12345',
        batchId: 'batch-456',
        totalScans: 100,
        uniqueCountries: 5,
        scansByCountry: [{ country: 'US', count: 50 }],
        scansByDevice: [{ device: DeviceType.MOBILE, count: 80 }],
        scansByDay: [{ date: '2025-01-15', count: 10 }],
        last30DaysScans: 100,
        lastScanAt: FIXED_DATE,
      };
      vi.mocked(mockRepository.getAnalytics).mockResolvedValue(mockAnalytics);

      const result = await service.getScanAnalytics('batch-456');

      expect(result).toEqual(mockAnalytics);
      expect(mockRepository.getAnalytics).toHaveBeenCalledWith('ABC12345', 30);
    });

    it('should return null when no public link exists', async () => {
      vi.mocked(mockRepository.findByBatchId).mockResolvedValue(null);

      const result = await service.getScanAnalytics('batch-without-link');

      expect(result).toBeNull();
      expect(mockRepository.getAnalytics).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getBatchTraceability() Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getBatchTraceability()', () => {
    it('should return null for invalid short code', async () => {
      vi.mocked(mockRepository.findByShortCode).mockResolvedValue(null);

      const result = await service.getBatchTraceability('INVALID');

      expect(result).toBeNull();
    });

    it('should return null for inactive link', async () => {
      const inactiveLink = { ...mockExistingLink, isActive: false };
      vi.mocked(mockRepository.findByShortCode).mockResolvedValue(inactiveLink);

      const result = await service.getBatchTraceability('ABC12345');

      expect(result).toBeNull();
    });

    it('should increment view count on valid request', async () => {
      vi.mocked(mockRepository.findByShortCode).mockResolvedValue(mockExistingLink);
      vi.mocked(mockPrisma.batch.findUnique).mockResolvedValue(mockBatch);
      vi.mocked(mockRepository.incrementViewCount).mockResolvedValue(undefined);

      await service.getBatchTraceability('ABC12345');

      expect(mockRepository.incrementViewCount).toHaveBeenCalledWith('ABC12345');
    });

    it('should return null when batch not found', async () => {
      vi.mocked(mockRepository.findByShortCode).mockResolvedValue(mockExistingLink);
      vi.mocked(mockPrisma.batch.findUnique).mockResolvedValue(null);

      const result = await service.getBatchTraceability('ABC12345');

      expect(result).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getFarmerProfile() Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getFarmerProfile()', () => {
    const mockProducer = {
      id: 'producer-123',
      businessName: 'Rancho Los Aguacates',
      municipality: 'Uruapan',
      state: 'Michoacán',
      cropTypes: ['HASS', 'BERRIES'],
      user: { name: 'Juan García' },
      batches: [
        { status: 'APPROVED', qualityCertificates: [{ hashOnChain: '0x123' }] },
        { status: 'PENDING', qualityCertificates: [] },
      ],
      certifications: [
        { name: 'USDA Organic', issuedBy: 'USDA', expiresAt: new Date('2026-01-01') },
      ],
      organicCertificates: [
        { certificateNumber: 'USDA Organic', issuedBy: 'USDA', validTo: new Date('2026-01-01') },
      ],
      fields: [],
    };

    it('should return farmer profile by ID', async () => {
      vi.mocked(mockPrisma.producer.findFirst).mockResolvedValue(mockProducer);

      const result = await service.getFarmerProfile('producer-123');

      expect(result).not.toBeNull();
      expect(result?.displayName).toBe('Rancho Los Aguacates');
      expect(result?.region).toBe('Uruapan, Michoacán');
      expect(result?.country).toBe('Mexico');
    });

    it('should return null when producer not found', async () => {
      vi.mocked(mockPrisma.producer.findFirst).mockResolvedValue(null);

      const result = await service.getFarmerProfile('nonexistent');

      expect(result).toBeNull();
    });

    it('should calculate blockchain verified lots correctly', async () => {
      vi.mocked(mockPrisma.producer.findFirst).mockResolvedValue(mockProducer);

      const result = await service.getFarmerProfile('producer-123');

      expect(result?.stats.totalLotsExported).toBe(2);
      expect(result?.stats.blockchainVerifiedLots).toBe(1);
    });

    it('should generate slug from business name', async () => {
      vi.mocked(mockPrisma.producer.findFirst).mockResolvedValue(mockProducer);

      const result = await service.getFarmerProfile('producer-123');

      expect(result?.slug).toBe('rancho-los-aguacates');
    });

    it('should include certifications', async () => {
      vi.mocked(mockPrisma.producer.findFirst).mockResolvedValue(mockProducer);

      const result = await service.getFarmerProfile('producer-123');

      expect(result?.certifications).toHaveLength(1);
      expect(result?.certifications[0].name).toBe('USDA Organic');
    });

    it('should include main crops', async () => {
      vi.mocked(mockPrisma.producer.findFirst).mockResolvedValue(mockProducer);

      const result = await service.getFarmerProfile('producer-123');

      expect(result?.mainCrops).toEqual(['HASS', 'BERRIES']);
    });
  });
});
