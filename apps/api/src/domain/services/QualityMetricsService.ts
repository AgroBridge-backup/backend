/**
 * Quality Metrics Service
 *
 * Handles Brix/pH quality verification for harvest batches.
 * Provides instant quality grading vs traditional 3-day lab tests.
 *
 * @module QualityMetricsService
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError.js';
import logger from '../../shared/utils/logger.js';
import {
  CropType,
  QualityGradeType,
  COLD_CHAIN_THRESHOLDS,
  calculateQualityGrade,
  gradeBrixLevel,
  gradePhLevel,
  estimateMarketPrice,
} from '../entities/SmartColdChain.js';

// ════════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════════

export interface RecordQualityInput {
  exportCompanyId: string;
  fieldId?: string;
  batchId?: string;
  harvestDate: Date;
  cropType: CropType;
  sampleSize?: number;

  // Required quality metrics
  brixLevel: number;
  phLevel: number;

  // Optional physical attributes
  firmness?: number;
  color?: string;
  diameter?: number;
  weight?: number;

  // Defects
  defectCount?: number;
  defectTypes?: string[];

  // Measurement info
  measurementDevice?: string;
  measurementMethod?: string;
  notes?: string;
}

export interface LabVerificationInput {
  metricsId: string;
  verifiedBy: string;
  labReportUrl?: string;
}

export interface QualityStats {
  totalMeasurements: number;
  premiumCount: number;
  exportCount: number;
  domesticCount: number;
  rejectCount: number;
  avgBrixLevel: number | null;
  avgPhLevel: number | null;
  exportEligibilityRate: number;
  labVerifiedCount: number;
}

// ════════════════════════════════════════════════════════════════════════════════
// SERVICE
// ════════════════════════════════════════════════════════════════════════════════

export class QualityMetricsService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Record quality metrics for a harvest
   */
  async recordQuality(input: RecordQualityInput) {
    const thresholds = COLD_CHAIN_THRESHOLDS[input.cropType];

    if (!thresholds) {
      throw new AppError(`Unknown crop type: ${input.cropType}`, 400);
    }

    // Calculate grades
    const brixGrade = gradeBrixLevel(input.cropType, input.brixLevel);
    const phGrade = gradePhLevel(input.cropType, input.phLevel);

    // Check compliance
    const brixCompliant = input.brixLevel >= thresholds.brixMin && input.brixLevel <= thresholds.brixMax;
    const phCompliant = input.phLevel >= thresholds.phMin && input.phLevel <= thresholds.phMax;

    // Calculate overall quality
    const overallQuality = calculateQualityGrade(input.cropType, input.brixLevel, input.phLevel);

    // Determine export eligibility
    const exportEligible = overallQuality === QualityGradeType.PREMIUM || overallQuality === QualityGradeType.EXPORT;

    // Calculate defect percentage
    const defectPercentage = input.sampleSize && input.defectCount
      ? (input.defectCount / input.sampleSize) * 100
      : null;

    // Adjust quality if defects are high
    let finalQuality = overallQuality;
    if (defectPercentage !== null && defectPercentage > 10) {
      // Downgrade by one level if defects > 10%
      if (finalQuality === QualityGradeType.PREMIUM) {
        finalQuality = QualityGradeType.EXPORT;
      } else if (finalQuality === QualityGradeType.EXPORT) {
        finalQuality = QualityGradeType.DOMESTIC;
      } else if (finalQuality === QualityGradeType.DOMESTIC) {
        finalQuality = QualityGradeType.REJECT;
      }
    }

    // Estimate market price
    const marketPrice = estimateMarketPrice(input.cropType, finalQuality);

    // Create record
    const metrics = await this.prisma.harvestQualityMetrics.create({
      data: {
        exportCompanyId: input.exportCompanyId,
        fieldId: input.fieldId,
        batchId: input.batchId,
        harvestDate: input.harvestDate,
        cropType: input.cropType,
        sampleSize: input.sampleSize,
        brixLevel: input.brixLevel,
        brixGrade,
        brixCompliant,
        phLevel: input.phLevel,
        phGrade,
        phCompliant,
        firmness: input.firmness,
        color: input.color,
        diameter: input.diameter,
        weight: input.weight,
        defectCount: input.defectCount || 0,
        defectTypes: input.defectTypes || [],
        defectPercentage,
        overallQuality: finalQuality as any,
        exportEligible: finalQuality === QualityGradeType.PREMIUM || finalQuality === QualityGradeType.EXPORT,
        marketPrice,
        measurementDevice: input.measurementDevice,
        measurementMethod: input.measurementMethod,
        notes: input.notes,
      },
    });

    logger.info('[QualityMetrics] Quality recorded', {
      metricsId: metrics.id,
      cropType: input.cropType,
      brixLevel: input.brixLevel,
      phLevel: input.phLevel,
      overallQuality: finalQuality,
      exportEligible,
    });

    return {
      ...metrics,
      thresholds: {
        brix: { min: thresholds.brixMin, max: thresholds.brixMax, premium: thresholds.brixPremium },
        ph: { min: thresholds.phMin, max: thresholds.phMax },
      },
    };
  }

  /**
   * Get quality metrics by ID
   */
  async getMetrics(id: string) {
    const metrics = await this.prisma.harvestQualityMetrics.findUnique({
      where: { id },
      include: {
        exportCompany: { select: { id: true, name: true } },
      },
    });

    if (!metrics) {
      throw new AppError('Quality metrics not found', 404);
    }

    return metrics;
  }

  /**
   * List quality metrics for an export company
   */
  async listMetrics(exportCompanyId: string, options?: {
    fieldId?: string;
    batchId?: string;
    cropType?: string;
    overallQuality?: string;
    exportEligible?: boolean;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: Prisma.HarvestQualityMetricsWhereInput = { exportCompanyId };

    if (options?.fieldId) where.fieldId = options.fieldId;
    if (options?.batchId) where.batchId = options.batchId;
    if (options?.cropType) where.cropType = options.cropType as any;
    if (options?.overallQuality) where.overallQuality = options.overallQuality as any;
    if (options?.exportEligible !== undefined) where.exportEligible = options.exportEligible;

    if (options?.startDate || options?.endDate) {
      where.harvestDate = {};
      if (options.startDate) where.harvestDate.gte = options.startDate;
      if (options.endDate) where.harvestDate.lte = options.endDate;
    }

    const [metrics, total] = await Promise.all([
      this.prisma.harvestQualityMetrics.findMany({
        where,
        take: options?.limit || 50,
        skip: options?.offset || 0,
        orderBy: { harvestDate: 'desc' },
      }),
      this.prisma.harvestQualityMetrics.count({ where }),
    ]);

    return { metrics, total };
  }

  /**
   * Verify quality metrics with lab report
   */
  async verifyWithLab(input: LabVerificationInput) {
    const metrics = await this.prisma.harvestQualityMetrics.findUnique({
      where: { id: input.metricsId },
    });

    if (!metrics) {
      throw new AppError('Quality metrics not found', 404);
    }

    if (metrics.labVerified) {
      throw new AppError('Quality metrics already verified', 400);
    }

    const updated = await this.prisma.harvestQualityMetrics.update({
      where: { id: input.metricsId },
      data: {
        labVerified: true,
        labReportUrl: input.labReportUrl,
        verifiedBy: input.verifiedBy,
        verifiedAt: new Date(),
      },
    });

    logger.info('[QualityMetrics] Lab verification recorded', {
      metricsId: input.metricsId,
      verifiedBy: input.verifiedBy,
    });

    return updated;
  }

  /**
   * Get quality statistics for an export company
   */
  async getStats(exportCompanyId: string, options?: {
    startDate?: Date;
    endDate?: Date;
    cropType?: string;
  }): Promise<QualityStats> {
    const where: Prisma.HarvestQualityMetricsWhereInput = { exportCompanyId };

    if (options?.cropType) where.cropType = options.cropType as any;

    if (options?.startDate || options?.endDate) {
      where.harvestDate = {};
      if (options.startDate) where.harvestDate.gte = options.startDate;
      if (options.endDate) where.harvestDate.lte = options.endDate;
    }

    const [
      totalMeasurements,
      premiumCount,
      exportCount,
      domesticCount,
      rejectCount,
      avgMetrics,
      labVerifiedCount,
    ] = await Promise.all([
      this.prisma.harvestQualityMetrics.count({ where }),
      this.prisma.harvestQualityMetrics.count({ where: { ...where, overallQuality: 'PREMIUM' } }),
      this.prisma.harvestQualityMetrics.count({ where: { ...where, overallQuality: 'EXPORT' } }),
      this.prisma.harvestQualityMetrics.count({ where: { ...where, overallQuality: 'DOMESTIC' } }),
      this.prisma.harvestQualityMetrics.count({ where: { ...where, overallQuality: 'REJECT' } }),
      this.prisma.harvestQualityMetrics.aggregate({
        where,
        _avg: { brixLevel: true, phLevel: true },
      }),
      this.prisma.harvestQualityMetrics.count({ where: { ...where, labVerified: true } }),
    ]);

    const exportEligibilityRate = totalMeasurements > 0
      ? ((premiumCount + exportCount) / totalMeasurements) * 100
      : 0;

    return {
      totalMeasurements,
      premiumCount,
      exportCount,
      domesticCount,
      rejectCount,
      avgBrixLevel: avgMetrics._avg.brixLevel ? Number(avgMetrics._avg.brixLevel) : null,
      avgPhLevel: avgMetrics._avg.phLevel ? Number(avgMetrics._avg.phLevel) : null,
      exportEligibilityRate: Math.round(exportEligibilityRate * 10) / 10,
      labVerifiedCount,
    };
  }

  /**
   * Get quality thresholds for a crop type
   */
  getThresholds(cropType: CropType) {
    const thresholds = COLD_CHAIN_THRESHOLDS[cropType];

    if (!thresholds) {
      throw new AppError(`Unknown crop type: ${cropType}`, 400);
    }

    return {
      cropType,
      brix: {
        min: thresholds.brixMin,
        max: thresholds.brixMax,
        premium: thresholds.brixPremium,
      },
      ph: {
        min: thresholds.phMin,
        max: thresholds.phMax,
      },
      coldChain: {
        minTemperature: thresholds.minTemp,
        maxTemperature: thresholds.maxTemp,
        targetHumidity: thresholds.targetHumidity,
        maxTransitHours: thresholds.maxTransitHours,
        shelfLifeDays: thresholds.shelfLifeDays,
      },
    };
  }

  /**
   * Get all crop thresholds
   */
  getAllThresholds() {
    return Object.entries(COLD_CHAIN_THRESHOLDS).map(([cropType, thresholds]) => ({
      cropType,
      brix: {
        min: thresholds.brixMin,
        max: thresholds.brixMax,
        premium: thresholds.brixPremium,
      },
      ph: {
        min: thresholds.phMin,
        max: thresholds.phMax,
      },
      coldChain: {
        minTemperature: thresholds.minTemp,
        maxTemperature: thresholds.maxTemp,
        targetHumidity: thresholds.targetHumidity,
        maxTransitHours: thresholds.maxTransitHours,
        shelfLifeDays: thresholds.shelfLifeDays,
      },
    }));
  }

  /**
   * Analyze quality trend for a field or batch
   */
  async analyzeQualityTrend(options: {
    exportCompanyId: string;
    fieldId?: string;
    batchId?: string;
    cropType?: string;
    months?: number;
  }) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - (options.months || 6));

    const where: Prisma.HarvestQualityMetricsWhereInput = {
      exportCompanyId: options.exportCompanyId,
      harvestDate: { gte: startDate, lte: endDate },
    };

    if (options.fieldId) where.fieldId = options.fieldId;
    if (options.batchId) where.batchId = options.batchId;
    if (options.cropType) where.cropType = options.cropType as any;

    const metrics = await this.prisma.harvestQualityMetrics.findMany({
      where,
      orderBy: { harvestDate: 'asc' },
    });

    // Group by month
    const monthlyData: Record<string, {
      month: string;
      count: number;
      avgBrix: number;
      avgPh: number;
      exportEligibleCount: number;
    }> = {};

    metrics.forEach(m => {
      const month = m.harvestDate.toISOString().slice(0, 7);
      if (!monthlyData[month]) {
        monthlyData[month] = {
          month,
          count: 0,
          avgBrix: 0,
          avgPh: 0,
          exportEligibleCount: 0,
        };
      }
      monthlyData[month].count++;
      monthlyData[month].avgBrix += Number(m.brixLevel);
      monthlyData[month].avgPh += Number(m.phLevel);
      if (m.exportEligible) {
        monthlyData[month].exportEligibleCount++;
      }
    });

    // Calculate averages
    const trend = Object.values(monthlyData).map(m => ({
      month: m.month,
      count: m.count,
      avgBrix: Math.round((m.avgBrix / m.count) * 100) / 100,
      avgPh: Math.round((m.avgPh / m.count) * 100) / 100,
      exportEligibilityRate: Math.round((m.exportEligibleCount / m.count) * 1000) / 10,
    }));

    // Calculate trend direction
    let brixTrend: 'IMPROVING' | 'STABLE' | 'DECLINING' = 'STABLE';
    let exportTrend: 'IMPROVING' | 'STABLE' | 'DECLINING' = 'STABLE';

    if (trend.length >= 2) {
      const firstHalf = trend.slice(0, Math.floor(trend.length / 2));
      const secondHalf = trend.slice(Math.floor(trend.length / 2));

      const firstHalfBrix = firstHalf.reduce((sum, m) => sum + m.avgBrix, 0) / firstHalf.length;
      const secondHalfBrix = secondHalf.reduce((sum, m) => sum + m.avgBrix, 0) / secondHalf.length;

      if (secondHalfBrix > firstHalfBrix + 0.5) brixTrend = 'IMPROVING';
      else if (secondHalfBrix < firstHalfBrix - 0.5) brixTrend = 'DECLINING';

      const firstHalfExport = firstHalf.reduce((sum, m) => sum + m.exportEligibilityRate, 0) / firstHalf.length;
      const secondHalfExport = secondHalf.reduce((sum, m) => sum + m.exportEligibilityRate, 0) / secondHalf.length;

      if (secondHalfExport > firstHalfExport + 5) exportTrend = 'IMPROVING';
      else if (secondHalfExport < firstHalfExport - 5) exportTrend = 'DECLINING';
    }

    return {
      monthlyData: trend,
      trends: {
        brix: brixTrend,
        exportEligibility: exportTrend,
      },
      summary: {
        totalMeasurements: metrics.length,
        avgBrix: metrics.length > 0
          ? Math.round((metrics.reduce((sum, m) => sum + Number(m.brixLevel), 0) / metrics.length) * 100) / 100
          : null,
        avgPh: metrics.length > 0
          ? Math.round((metrics.reduce((sum, m) => sum + Number(m.phLevel), 0) / metrics.length) * 100) / 100
          : null,
        overallExportRate: metrics.length > 0
          ? Math.round((metrics.filter(m => m.exportEligible).length / metrics.length) * 1000) / 10
          : 0,
      },
    };
  }
}
