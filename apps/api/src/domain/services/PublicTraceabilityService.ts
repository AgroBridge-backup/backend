/**
 * Farmer Storytelling & Consumer Traceability
 * Service for Public-Facing Traceability Data
 *
 * Aggregates Traceability 2.0 data into consumer-friendly formats
 * designed for 5-second comprehension on mobile devices.
 */

import { PrismaClient } from '@prisma/client';
import { IPublicTraceabilityRepository } from '../repositories/IPublicTraceabilityRepository.js';
import {
  PublicTraceabilityLink,
  PublicFarmerProfile,
  PublicBatchTraceability,
  QrScanEvent,
  ScanAnalytics,
  DeviceType,
  JourneyStage,
  KeyFact,
  VerificationBadge,
  TransitSummary,
  ColdChainSummary,
  SealStatus,
  FieldHealthSummary,
  CertificateSummary,
  generateShortCode,
  generateFarmerSlug,
  getCountryFlag,
  detectDeviceType,
  extractBrowser,
  getVarietyDisplayName,
  buildPublicUrl,
  buildFarmerUrl,
  getStageIcon,
  getHealthCategory,
} from '../entities/PublicTraceability.js';
import { AppError } from '../../shared/errors/AppError.js';
import logger from '../../shared/utils/logger.js';

export interface GenerateLinkResult {
  link: PublicTraceabilityLink;
  publicUrl: string;
  qrImageUrl: string | null;
  isNew: boolean;
}

export class PublicTraceabilityService {
  constructor(
    private prisma: PrismaClient,
    private linkRepository: IPublicTraceabilityRepository
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC LINK GENERATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate or retrieve a public link for a batch
   */
  async generatePublicLink(batchId: string): Promise<GenerateLinkResult> {
    // Check if link already exists
    const existing = await this.linkRepository.findByBatchId(batchId);
    if (existing && existing.isActive) {
      return {
        link: existing,
        publicUrl: existing.publicUrl,
        qrImageUrl: existing.qrImageUrl,
        isNew: false,
      };
    }

    // Verify batch exists
    const batch = await this.prisma.batch.findUnique({
      where: { id: batchId },
    });
    if (!batch) {
      throw new AppError('Batch not found', 404);
    }

    // Generate unique short code
    let shortCode = generateShortCode();
    let attempts = 0;
    while (await this.linkRepository.findByShortCode(shortCode)) {
      shortCode = generateShortCode();
      attempts++;
      if (attempts > 10) {
        throw new AppError('Failed to generate unique short code', 500);
      }
    }

    const publicUrl = buildPublicUrl(shortCode);

    const link = await this.linkRepository.create({
      batchId,
      shortCode,
      publicUrl,
      expiresAt: undefined, // No expiry by default
    });

    logger.info('Public traceability link generated', {
      batchId,
      shortCode,
      publicUrl,
    });

    return {
      link,
      publicUrl,
      qrImageUrl: null, // QR image generated separately
      isNew: true,
    };
  }

  /**
   * Update QR image URL for a link
   */
  async setQrImageUrl(shortCode: string, qrImageUrl: string): Promise<PublicTraceabilityLink> {
    const link = await this.linkRepository.findByShortCode(shortCode);
    if (!link) {
      throw new AppError('Link not found', 404);
    }

    return this.linkRepository.update(link.id, { qrImageUrl });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC FARMER PROFILE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get public farmer profile by ID or slug
   */
  async getFarmerProfile(idOrSlug: string): Promise<PublicFarmerProfile | null> {
    // Try to find by ID first, then by slug
    const producer = await this.prisma.producer.findFirst({
      where: {
        OR: [
          { id: idOrSlug },
          { businessName: { contains: idOrSlug, mode: 'insensitive' } },
        ],
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        batches: {
          include: {
            qualityCertificates: true,
          },
        },
        organicFields: {
          take: 1,
        },
        organicCertificates: true,
      },
    });

    if (!producer) {
      return null;
    }

    // Calculate stats
    const batches = (producer as any).batches || [];
    const totalLots = batches.length;
    const blockchainVerifiedLots = batches.filter(
      (b: any) => b.qualityCertificates?.some((c: any) => c.hashOnChain)
    ).length;

    // Get average NDVI from organic fields (simplified - no imagery in MVP)
    const averageHealthScore: number | null = null;

    // Get unique destination countries (simplified)
    const countriesExportedTo = ['US', 'CA', 'EU']; // Would need destination tracking

    const organicFields = (producer as any).organicFields || [];
    const field = organicFields[0];

    return {
      id: producer.id,
      slug: generateFarmerSlug(producer.businessName),
      displayName: producer.businessName,
      photoUrl: null, // Would need profile photo field
      region: `${producer.municipality}, ${producer.state}`,
      country: 'Mexico',
      countryFlag: getCountryFlag('MX'),
      story: null, // Would need bio/story field
      mainCrops: producer.cropTypes || [],
      yearsOfExperience: null, // Would need founding date field
      certifications: ((producer as any).organicCertificates || []).map((c: any) => ({
        name: c.certificateNumber || 'Organic Certificate',
        issuedBy: 'AgroBridge',
        validUntil: c.validTo,
        badgeUrl: null,
      })),
      stats: {
        totalLotsExported: totalLots,
        blockchainVerifiedLots,
        averageHealthScore,
        countriesExportedTo,
      },
      field: field
        ? {
            name: field.name,
            areaHectares: Number(field.areaHectares) || 0,
            currentCrop: field.currentCrop,
            centerLatitude: Number(field.centerLat) || 0,
            centerLongitude: Number(field.centerLng) || 0,
          }
        : undefined,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC BATCH TRACEABILITY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get full public batch traceability data by short code
   */
  async getBatchTraceability(shortCode: string): Promise<PublicBatchTraceability | null> {
    // Find the link and increment view count
    const link = await this.linkRepository.findByShortCode(shortCode);
    if (!link || !link.isActive) {
      return null;
    }

    await this.linkRepository.incrementViewCount(shortCode);

    // Fetch full batch with all Traceability 2.0 data
    const batch = await this.prisma.batch.findUnique({
      where: { id: link.batchId },
      include: {
        producer: {
          include: {
            organicFields: {
              take: 1,
            },
          },
        },
        verificationStages: {
          orderBy: { timestamp: 'asc' },
        },
        qualityCertificates: {
          orderBy: { issuedAt: 'desc' },
          take: 1,
        },
        transitSessions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            locations: {
              orderBy: { timestamp: 'desc' },
              take: 1,
            },
          },
        },
        temperatureReadings: {
          orderBy: { timestamp: 'desc' },
          take: 50, // For chart
        },
        nfcSeals: {
          include: {
            verifications: {
              orderBy: { verifiedAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!batch) {
      return null;
    }

    return this.buildPublicBatchResponse(batch, shortCode, link.publicUrl);
  }

  /**
   * Build the public batch response from raw data
   */
  private buildPublicBatchResponse(batch: any, shortCode: string, publicUrl: string): PublicBatchTraceability {
    const producer = batch.producer;

    // Product Info
    const product = {
      name: getVarietyDisplayName(batch.variety),
      variety: batch.variety,
      origin: `${producer.municipality}, ${producer.state}`,
      originFlag: getCountryFlag('MX'),
      harvestDate: batch.harvestDate,
      weightKg: Number(batch.weightKg),
      destinationCountry: null, // Would need destination field
    };

    // Farmer Preview
    const farmer = {
      id: producer.id,
      slug: generateFarmerSlug(producer.businessName),
      displayName: producer.businessName,
      photoUrl: null,
      region: `${producer.municipality}, ${producer.state}`,
    };

    // Key Facts (4 most important data points)
    const keyFacts = this.buildKeyFacts(batch);

    // Verification Badge
    const verificationBadge = this.buildVerificationBadge(batch);

    // Journey Timeline
    const journey = this.buildJourneyTimeline(batch.verificationStages);

    // Transit Summary
    const transit = this.buildTransitSummary(batch.transitSessions?.[0]);

    // Cold Chain Summary
    const coldChain = this.buildColdChainSummary(batch.temperatureReadings);

    // Seal Status
    const sealStatus = this.buildSealStatus(batch.nfcSeals);

    // Field Health
    const fieldHealth = this.buildFieldHealthSummary(producer.fields?.[0]);

    // Certificate Summary
    const certificate = this.buildCertificateSummary(batch.qualityCertificates?.[0]);

    // Share Info for SEO/Social
    const shareInfo = {
      title: `${product.name} from ${farmer.displayName} - ${product.origin}`,
      description: `Verified traceability: Harvest ${batch.harvestDate.toLocaleDateString()}, ${product.weightKg}kg. Scan to see the complete journey.`,
      imageUrl: fieldHealth?.thumbnailUrl || null,
      url: publicUrl,
    };

    return {
      shortCode,
      product,
      farmer,
      keyFacts,
      verificationBadge,
      journey,
      transit,
      coldChain,
      sealStatus,
      fieldHealth,
      certificate,
      shareInfo,
    };
  }

  /**
   * Build key facts for above-the-fold display
   */
  private buildKeyFacts(batch: any): KeyFact[] {
    const facts: KeyFact[] = [];

    // Harvest date
    facts.push({
      icon: '📅',
      label: 'Harvested',
      value: batch.harvestDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    });

    // Distance traveled (from transit)
    if (batch.transitSessions?.[0]) {
      const session = batch.transitSessions[0];
      facts.push({
        icon: '🚚',
        label: 'Distance',
        value: `${Math.round(session.distanceTraveledKm || 0)} km`,
      });
    }

    // Temperature (from cold chain)
    if (batch.temperatureReadings?.length > 0) {
      const temps = batch.temperatureReadings.map((r: any) => Number(r.value));
      const avg = temps.reduce((a: number, b: number) => a + b, 0) / temps.length;
      facts.push({
        icon: '🌡️',
        label: 'Temp Range',
        value: `${Math.min(...temps).toFixed(1)}–${Math.max(...temps).toFixed(1)}°C`,
      });
    }

    // Blockchain verified
    const hasBlockchain = batch.qualityCertificates?.some((c: any) => c.hashOnChain) ||
                          batch.stagesFinalizedHash;
    facts.push({
      icon: hasBlockchain ? '✅' : '⏳',
      label: 'Blockchain',
      value: hasBlockchain ? 'Verified' : 'Pending',
      highlight: hasBlockchain,
    });

    return facts;
  }

  /**
   * Build verification badge
   */
  private buildVerificationBadge(batch: any): VerificationBadge {
    const stages = batch.verificationStages || [];
    const approvedCount = stages.filter((s: any) => s.status === 'APPROVED').length;
    const totalStages = 5; // HARVEST, PACKING, COLD_CHAIN, EXPORT, DELIVERY

    const cert = batch.qualityCertificates?.[0];
    const hash = cert?.hashOnChain || batch.stagesFinalizedHash;

    if (approvedCount === totalStages && hash) {
      return {
        status: 'VERIFIED',
        label: 'Fully Verified by AgroBridge',
        blockchainHash: hash,
        blockchainUrl: hash ? `https://etherscan.io/tx/${hash}` : null,
      };
    } else if (approvedCount > 0) {
      return {
        status: 'PARTIAL',
        label: `${approvedCount}/${totalStages} Stages Verified`,
        blockchainHash: hash || null,
        blockchainUrl: null,
      };
    }

    return {
      status: 'PENDING',
      label: 'Verification in Progress',
      blockchainHash: null,
      blockchainUrl: null,
    };
  }

  /**
   * Build journey timeline from verification stages
   */
  private buildJourneyTimeline(stages: any[]): JourneyStage[] {
    const stageOrder = ['HARVEST', 'PACKING', 'COLD_CHAIN', 'EXPORT', 'DELIVERY'];
    const stageNames: Record<string, string> = {
      HARVEST: 'Harvest',
      PACKING: 'Packing',
      COLD_CHAIN: 'Cold Chain',
      EXPORT: 'Export',
      DELIVERY: 'Delivery',
    };

    const stageMap = new Map(stages.map((s: any) => [s.stageType, s]));

    return stageOrder.map((type, index) => {
      const stage = stageMap.get(type);
      const previousStage = index > 0 ? stageMap.get(stageOrder[index - 1]) : null;

      let status: 'COMPLETED' | 'CURRENT' | 'PENDING' | 'SKIPPED';
      if (stage?.status === 'APPROVED') {
        status = 'COMPLETED';
      } else if (stage?.status === 'PENDING' || stage?.status === 'FLAGGED') {
        status = 'CURRENT';
      } else if (previousStage?.status === 'APPROVED' && !stage) {
        status = 'CURRENT';
      } else {
        status = 'PENDING';
      }

      return {
        name: stageNames[type],
        status,
        date: stage?.timestamp || null,
        location: stage?.location || null,
        actor: stage?.actorRole || null, // Privacy: show role, not name
        icon: getStageIcon(type),
      };
    });
  }

  /**
   * Build transit summary
   */
  private buildTransitSummary(session: any): TransitSummary | null {
    if (!session) return null;

    const lastLocation = session.locations?.[0];

    return {
      status: session.status,
      originName: session.originName,
      destinationName: session.destinationName,
      currentLocation: lastLocation?.address || null,
      distanceTraveledKm: Number(session.distanceTraveledKm) || 0,
      totalDistanceKm: Number(session.totalDistanceKm) || 0,
      progressPercent: session.totalDistanceKm
        ? Math.round((Number(session.distanceTraveledKm) / Number(session.totalDistanceKm)) * 100)
        : 0,
      estimatedArrival: session.estimatedArrival,
      lastUpdate: lastLocation?.timestamp || session.updatedAt,
      mapPreviewUrl: null, // Would generate static map
    };
  }

  /**
   * Build cold chain summary
   */
  private buildColdChainSummary(readings: any[]): ColdChainSummary | null {
    if (!readings || readings.length === 0) return null;

    const values = readings.map((r: any) => Number(r.value));
    const outOfRange = readings.filter((r: any) => r.isOutOfRange);
    const thresholds = readings[0];

    return {
      isCompliant: outOfRange.length === 0,
      minTemp: Math.min(...values),
      maxTemp: Math.max(...values),
      avgTemp: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10,
      readingCount: readings.length,
      outOfRangeCount: outOfRange.length,
      thresholdMin: Number(thresholds.minThreshold) || 0,
      thresholdMax: Number(thresholds.maxThreshold) || 8,
      lastReading: readings[0]?.timestamp || null,
      chartData: readings
        .slice(0, 24) // Last 24 readings for chart
        .reverse()
        .map((r: any) => ({
          timestamp: r.timestamp.toISOString(),
          value: Number(r.value),
        })),
    };
  }

  /**
   * Build seal status
   */
  private buildSealStatus(seals: any[]): SealStatus | null {
    if (!seals || seals.length === 0) {
      return {
        status: 'NOT_APPLIED',
        label: 'No NFC seal applied',
        lastVerified: null,
        verificationCount: 0,
        integrityScore: 0,
      };
    }

    // Find primary seal (most recently attached)
    const seal = seals.reduce((latest: any, s: any) =>
      !latest || (s.attachedAt && s.attachedAt > latest.attachedAt) ? s : latest
    , null);

    const latestVerification = seal.verifications?.[0];

    let status: 'INTACT' | 'VERIFIED' | 'BROKEN';
    let label: string;

    if (seal.status === 'TAMPERED' || seal.tamperIndicator !== 'NONE') {
      status = 'BROKEN';
      label = 'Seal integrity compromised';
    } else if (latestVerification?.isValid) {
      status = 'VERIFIED';
      label = 'Seal verified & intact';
    } else {
      status = 'INTACT';
      label = 'Seal applied';
    }

    return {
      status,
      label,
      lastVerified: latestVerification?.verifiedAt || null,
      verificationCount: seal.verifications?.length || 0,
      integrityScore: seal.status === 'TAMPERED' ? 0 : 100,
    };
  }

  /**
   * Build field health summary
   */
  private buildFieldHealthSummary(field: any): FieldHealthSummary | null {
    if (!field || !field.imagery?.length) return null;

    const latestImagery = field.imagery[0];
    const healthScore = Number(latestImagery.healthScore) || 0;

    return {
      healthScore,
      healthCategory: getHealthCategory(healthScore),
      ndviValue: Number(latestImagery.ndviValue) || 0,
      lastCaptureDate: latestImagery.captureDate,
      thumbnailUrl: latestImagery.ndviUrl || latestImagery.rgbUrl || null,
      trend: 'STABLE', // Would calculate from historical data
    };
  }

  /**
   * Build certificate summary
   */
  private buildCertificateSummary(cert: any): CertificateSummary | null {
    if (!cert) return null;

    const now = new Date();
    const isValid = cert.validFrom <= now && cert.validTo >= now;

    return {
      grade: cert.grade,
      certifyingBody: cert.certifyingBody,
      validFrom: cert.validFrom,
      validTo: cert.validTo,
      isValid,
      pdfUrl: cert.pdfUrl,
      blockchainHash: cert.hashOnChain,
      blockchainUrl: cert.hashOnChain ? `https://etherscan.io/tx/${cert.hashOnChain}` : null,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCAN ANALYTICS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Record a QR scan event
   */
  async recordScan(input: {
    shortCode: string;
    userAgent?: string;
    referrer?: string;
    country?: string;
    city?: string;
  }): Promise<void> {
    const link = await this.linkRepository.findByShortCode(input.shortCode);
    if (!link) {
      logger.warn('Scan recorded for unknown short code', { shortCode: input.shortCode });
      return;
    }

    const event: QrScanEvent = {
      id: crypto.randomUUID(),
      shortCode: input.shortCode,
      timestamp: new Date(),
      country: input.country || null,
      city: input.city || null,
      deviceType: detectDeviceType(input.userAgent),
      browser: extractBrowser(input.userAgent),
      referrer: input.referrer || null,
      userAgent: input.userAgent || null,
    };

    await this.linkRepository.recordScan(event);

    logger.info('QR scan recorded', {
      shortCode: input.shortCode,
      country: event.country,
      deviceType: event.deviceType,
    });
  }

  /**
   * Get scan analytics for a batch
   */
  async getScanAnalytics(batchId: string): Promise<ScanAnalytics | null> {
    const link = await this.linkRepository.findByBatchId(batchId);
    if (!link) {
      return null;
    }

    return this.linkRepository.getAnalytics(link.shortCode, 30);
  }
}

// Import crypto for UUID generation
import crypto from 'crypto';
