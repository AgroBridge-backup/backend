/**
 * Satellite Analysis Domain Service
 *
 * Business logic for satellite-based organic compliance verification.
 * Processes NDVI data to detect synthetic fertilizer usage and generate compliance reports.
 *
 * @module SatelliteAnalysisService
 */

import { v4 as uuidv4 } from "uuid";
import { subYears, addDays, differenceInDays, format } from "date-fns";
import { PrismaClient } from "@prisma/client";
import type { SatelliteComplianceStatus as PrismaSatelliteStatus } from "@prisma/client";
import { AppError } from "../../shared/errors/AppError.js";
import logger from "../../shared/utils/logger.js";
import { SentinelHubService } from "../../infrastructure/services/SentinelHubService.js";
import {
  SatelliteAnalysisRequest,
  SatelliteComplianceReport,
  SatelliteComplianceStatus,
  SatelliteCropType,
  NDVIDataPoint,
  ViolationFlag,
  ViolationType,
  ViolationSeverity,
  SatelliteAnalysisStats,
  VIOLATION_DETECTION_RULES,
  CROP_NDVI_BASELINES,
  SENTINEL_HUB_LIMITS,
  calculateAnalysisConfidence,
  determineComplianceStatus,
  estimateCostSavings,
} from "../entities/SatelliteAnalysis.js";
import { GeoJsonPolygon } from "../entities/FieldImagery.js";

/**
 * Satellite Analysis Domain Service
 */
export class SatelliteAnalysisService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly sentinelHub: SentinelHubService,
  ) {}

  /**
   * Run full 3-year organic compliance check for a field
   * USDA/EU Requirement: No synthetic fertilizers/pesticides for 36 months
   *
   * @param request - Field analysis request
   * @returns Compliance report with NDVI history and violations
   */
  async analyzeFieldCompliance(
    request: SatelliteAnalysisRequest,
  ): Promise<SatelliteComplianceReport> {
    const startTime = Date.now();
    const analysisId = uuidv4();

    logger.info("[SatelliteAnalysis] Starting compliance analysis", {
      analysisId,
      fieldId: request.organicFieldId,
      years: request.analysisYears,
    });

    // 1. Validate field exists and get GPS coordinates
    const field = await this.prisma.organicField.findUnique({
      where: { id: request.organicFieldId },
      include: {
        producer: {
          select: { id: true, businessName: true },
        },
      },
    });

    if (!field) {
      throw new AppError(
        `Organic field ${request.organicFieldId} not found`,
        404,
      );
    }

    // Parse GeoJSON boundary
    let gpsCoordinates: GeoJsonPolygon;
    try {
      gpsCoordinates = JSON.parse(field.boundaryGeoJson) as GeoJsonPolygon;
    } catch {
      throw new AppError("Invalid field boundary GeoJSON", 400);
    }

    // 2. Calculate date range
    const endDate = new Date();
    const startDate = subYears(endDate, request.analysisYears || 3);
    const expectedDataPoints = Math.ceil(
      differenceInDays(endDate, startDate) / 30,
    );

    // 3. Create analysis record (status: PROCESSING)
    const expiresAt = addDays(new Date(), 90); // 90 days retention

    await this.prisma.satelliteAnalysis.create({
      data: {
        id: analysisId,
        organicFieldId: request.organicFieldId,
        analysisStartDate: startDate,
        analysisEndDate: endDate,
        analysisYears: request.analysisYears || 3,
        cropType: request.cropType,
        complianceStatus: "PROCESSING" as PrismaSatelliteStatus,
        requestedBy: request.requestedBy,
        expiresAt,
        totalDataPoints: 0,
        validDataPoints: 0,
        dataCoveragePercent: 0,
        overallConfidence: 0,
        ndviHistory: [],
        detectedViolations: [],
        violationCount: 0,
        highSeverityCount: 0,
        processingTimeMs: 0,
        sentinelApiCalls: 0,
      },
    });

    try {
      // 4. Fetch NDVI time series from Sentinel-2
      const ndviData = await this.sentinelHub.getNDVITimeSeries(
        gpsCoordinates,
        startDate,
        endDate,
        request.cropType,
        request.intervalDays || 30,
        request.maxCloudCoverage || 50,
      );

      // 5. Filter out cloudy days (>50% cloud coverage)
      const validData = ndviData.filter((d) => d.cloudCoverage < 50);

      // 6. Detect violations (synthetic fertilizer patterns)
      const violations = this.detectViolations(validData, request.cropType);

      // 7. Calculate compliance status
      const complianceStatus = determineComplianceStatus(
        violations,
        validData.length,
        expectedDataPoints,
      );

      // 8. Calculate confidence
      const avgCloudCoverage =
        validData.length > 0
          ? validData.reduce((sum, d) => sum + d.cloudCoverage, 0) /
            validData.length
          : 100;

      const overallConfidence = calculateAnalysisConfidence(
        validData.length,
        expectedDataPoints,
        violations,
        avgCloudCoverage,
      );

      // 9. Calculate coverage percentage
      const dataCoveragePercent = (validData.length / expectedDataPoints) * 100;

      // 10. Get API call count
      const sentinelApiCalls = this.sentinelHub.getRequestCount();

      // 11. Calculate processing time
      const processingTimeMs = Date.now() - startTime;

      // 12. Update analysis record with results
      const updatedAnalysis = await this.prisma.satelliteAnalysis.update({
        where: { id: analysisId },
        data: {
          complianceStatus: this.mapStatusToPrisma(complianceStatus),
          overallConfidence,
          totalDataPoints: ndviData.length,
          validDataPoints: validData.length,
          dataCoveragePercent,
          ndviHistory: validData as object[],
          detectedViolations: violations as object[],
          violationCount: violations.length,
          highSeverityCount: violations.filter(
            (v) => v.severity === ViolationSeverity.HIGH,
          ).length,
          processingTimeMs,
          sentinelApiCalls,
        },
      });

      logger.info("[SatelliteAnalysis] Analysis completed", {
        analysisId,
        fieldId: request.organicFieldId,
        status: complianceStatus,
        violations: violations.length,
        dataPoints: validData.length,
        processingTimeMs,
      });

      return this.mapToComplianceReport(updatedAnalysis);
    } catch (error) {
      // Mark analysis as FAILED
      const processingTimeMs = Date.now() - startTime;

      await this.prisma.satelliteAnalysis.update({
        where: { id: analysisId },
        data: {
          complianceStatus: "FAILED" as PrismaSatelliteStatus,
          processingTimeMs,
        },
      });

      logger.error("[SatelliteAnalysis] Analysis failed", {
        analysisId,
        fieldId: request.organicFieldId,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      throw new AppError(
        `Satellite analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        500,
      );
    }
  }

  /**
   * Detect organic violations from NDVI patterns
   *
   * Detection Rules:
   * - Synthetic Fertilizer: NDVI spike >0.25 within 30 days
   * - Pesticide Application: NDVI drop >0.15 followed by quick recovery
   * - Land Clearing: NDVI drop >0.40 sustained for 60+ days
   */
  private detectViolations(
    ndviData: NDVIDataPoint[],
    cropType: SatelliteCropType,
  ): ViolationFlag[] {
    const violations: ViolationFlag[] = [];
    const baseline = CROP_NDVI_BASELINES[cropType];
    const rules = VIOLATION_DETECTION_RULES;

    for (let i = 1; i < ndviData.length; i++) {
      const current = ndviData[i];
      const previous = ndviData[i - 1];
      const delta = current.ndviAverage - previous.ndviAverage;

      // Rule 1: Synthetic fertilizer detection (NDVI spike)
      if (delta > baseline.syntheticThreshold) {
        const severity =
          delta > 0.35 ? ViolationSeverity.HIGH : ViolationSeverity.MEDIUM;

        violations.push({
          id: uuidv4(),
          date: current.date,
          type: ViolationType.SYNTHETIC_FERTILIZER,
          ndviDelta: Number(delta.toFixed(4)),
          severity,
          confidence: current.confidence,
          description: `${rules.syntheticFertilizer.description} Incremento NDVI de ${(delta * 100).toFixed(1)}% en 30 días.`,
          descriptionEn: `${rules.syntheticFertilizer.descriptionEn} NDVI increased by ${(delta * 100).toFixed(1)}% in 30 days.`,
          affectedAreaPercent: 100, // Full field analysis
        });
      }

      // Rule 2: Pesticide application (drop followed by quick recovery)
      if (
        delta < rules.pesticide.ndviDropThreshold &&
        i < ndviData.length - 1
      ) {
        const nextDelta = ndviData[i + 1].ndviAverage - current.ndviAverage;

        if (nextDelta > rules.pesticide.recoveryThreshold) {
          violations.push({
            id: uuidv4(),
            date: current.date,
            type: ViolationType.PESTICIDE_APPLICATION,
            ndviDelta: Number(delta.toFixed(4)),
            severity: ViolationSeverity.MEDIUM,
            confidence: current.confidence * 0.8, // Lower confidence for this pattern
            description: `${rules.pesticide.description} Caída NDVI de ${Math.abs(delta * 100).toFixed(1)}% con recuperación rápida.`,
            descriptionEn: `${rules.pesticide.descriptionEn} NDVI dropped ${Math.abs(delta * 100).toFixed(1)}% with quick recovery.`,
            affectedAreaPercent: 100,
          });
        }
      }

      // Rule 3: Land clearing (major drop)
      if (delta < rules.landClearing.ndviDropThreshold) {
        violations.push({
          id: uuidv4(),
          date: current.date,
          type: ViolationType.LAND_CLEARING,
          ndviDelta: Number(delta.toFixed(4)),
          severity: ViolationSeverity.HIGH,
          confidence: current.confidence,
          description: `${rules.landClearing.description} Caída NDVI de ${Math.abs(delta * 100).toFixed(1)}%.`,
          descriptionEn: `${rules.landClearing.descriptionEn} NDVI dropped ${Math.abs(delta * 100).toFixed(1)}%.`,
          affectedAreaPercent: 100,
        });
      }
    }

    return violations;
  }

  /**
   * Get existing analysis by ID
   */
  async getAnalysis(id: string): Promise<SatelliteComplianceReport | null> {
    const analysis = await this.prisma.satelliteAnalysis.findUnique({
      where: { id },
    });

    if (!analysis) {
      return null;
    }

    return this.mapToComplianceReport(analysis);
  }

  /**
   * Get latest analysis for a field
   */
  async getLatestAnalysis(
    organicFieldId: string,
  ): Promise<SatelliteComplianceReport | null> {
    const analysis = await this.prisma.satelliteAnalysis.findFirst({
      where: { organicFieldId },
      orderBy: { createdAt: "desc" },
    });

    if (!analysis) {
      return null;
    }

    return this.mapToComplianceReport(analysis);
  }

  /**
   * List analyses for a field
   */
  async listFieldAnalyses(
    organicFieldId: string,
    limit: number = 10,
  ): Promise<SatelliteComplianceReport[]> {
    const analyses = await this.prisma.satelliteAnalysis.findMany({
      where: { organicFieldId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return analyses.map((a: any) => this.mapToComplianceReport(a));
  }

  /**
   * Get satellite analysis statistics for dashboard
   */
  async getStats(): Promise<SatelliteAnalysisStats> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Count analyses this month
    const [
      analysesThisMonth,
      eligibleCount,
      ineligibleCount,
      needsReviewCount,
      apiCallsThisMonth,
    ] = await Promise.all([
      this.prisma.satelliteAnalysis.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
      this.prisma.satelliteAnalysis.count({
        where: {
          createdAt: { gte: startOfMonth },
          complianceStatus: "ELIGIBLE",
        },
      }),
      this.prisma.satelliteAnalysis.count({
        where: {
          createdAt: { gte: startOfMonth },
          complianceStatus: "INELIGIBLE",
        },
      }),
      this.prisma.satelliteAnalysis.count({
        where: {
          createdAt: { gte: startOfMonth },
          complianceStatus: "NEEDS_REVIEW",
        },
      }),
      this.prisma.satelliteAnalysis.aggregate({
        where: { createdAt: { gte: startOfMonth } },
        _sum: { sentinelApiCalls: true },
      }),
    ]);

    // Get average processing time
    const avgProcessing = await this.prisma.satelliteAnalysis.aggregate({
      where: { createdAt: { gte: startOfMonth } },
      _avg: { processingTimeMs: true },
    });

    const totalApiCalls = apiCallsThisMonth._sum.sentinelApiCalls || 0;
    const quotaUsedPercent =
      (totalApiCalls / SENTINEL_HUB_LIMITS.monthlyProcessingUnits) * 100;

    const costSavings = estimateCostSavings(analysesThisMonth);

    return {
      thisMonth: {
        analysesRun: analysesThisMonth,
        sentinelApiCalls: totalApiCalls,
        quotaUsedPercent: Number(quotaUsedPercent.toFixed(1)),
        avgProcessingTimeMs: Math.round(
          avgProcessing._avg.processingTimeMs || 0,
        ),
        eligibleFields: eligibleCount,
        ineligibleFields: ineligibleCount,
        needsReviewFields: needsReviewCount,
      },
      costSavings,
    };
  }

  /**
   * Check if Sentinel Hub is properly configured
   */
  async checkConfiguration(): Promise<{
    configured: boolean;
    connected: boolean;
    message: string;
  }> {
    const configured = this.sentinelHub.isConfigured();

    if (!configured) {
      return {
        configured: false,
        connected: false,
        message:
          "Sentinel Hub credentials not configured. Set SENTINEL_HUB_CLIENT_ID and SENTINEL_HUB_CLIENT_SECRET environment variables.",
      };
    }

    const connectionTest = await this.sentinelHub.testConnection();

    return {
      configured: true,
      connected: connectionTest.success,
      message: connectionTest.message,
    };
  }

  /**
   * Map domain status to Prisma enum
   */
  private mapStatusToPrisma(
    status: SatelliteComplianceStatus,
  ): PrismaSatelliteStatus {
    const mapping: Record<SatelliteComplianceStatus, PrismaSatelliteStatus> = {
      [SatelliteComplianceStatus.PROCESSING]: "PROCESSING",
      [SatelliteComplianceStatus.ELIGIBLE]: "ELIGIBLE",
      [SatelliteComplianceStatus.INELIGIBLE]: "INELIGIBLE",
      [SatelliteComplianceStatus.NEEDS_REVIEW]: "NEEDS_REVIEW",
      [SatelliteComplianceStatus.FAILED]: "FAILED",
    };
    return mapping[status];
  }

  /**
   * Map Prisma model to domain model
   */
  private mapToComplianceReport(analysis: any): SatelliteComplianceReport {
    const violations = (analysis.detectedViolations || []) as ViolationFlag[];

    return {
      id: analysis.id,
      organicFieldId: analysis.organicFieldId,
      analysisStartDate: analysis.analysisStartDate,
      analysisEndDate: analysis.analysisEndDate,
      analysisYears: analysis.analysisYears,
      cropType: analysis.cropType as SatelliteCropType,
      totalDataPoints: analysis.totalDataPoints,
      validDataPoints: analysis.validDataPoints,
      dataCoveragePercent: Number(analysis.dataCoveragePercent) || 0,
      ndviHistory: (analysis.ndviHistory || []) as NDVIDataPoint[],
      complianceStatus: analysis.complianceStatus as SatelliteComplianceStatus,
      overallConfidence: Number(analysis.overallConfidence) || 0,
      detectedViolations: violations,
      violationCount: analysis.violationCount,
      highSeverityCount: analysis.highSeverityCount,
      reportPdfUrl: analysis.reportPdfUrl,
      chartImageUrl: analysis.chartImageUrl,
      rawDataUrl: analysis.rawDataUrl,
      processingTimeMs: analysis.processingTimeMs,
      sentinelApiCalls: analysis.sentinelApiCalls,
      createdAt: analysis.createdAt,
      expiresAt: analysis.expiresAt,
      requestedBy: analysis.requestedBy,
    };
  }
}
