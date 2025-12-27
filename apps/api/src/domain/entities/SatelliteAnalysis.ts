/**
 * Satellite Compliance Analysis Domain Entity
 *
 * Used for USDA/EU 3-year organic compliance verification via NDVI analysis.
 * Detects synthetic fertilizer patterns with 90%+ confidence using Sentinel-2 satellite data.
 *
 * @module SatelliteAnalysis
 */

import { ImagerySource, ImageryType } from "./FieldImagery.js";

/**
 * Compliance status for satellite analysis
 */
export enum SatelliteComplianceStatus {
  PROCESSING = "PROCESSING", // Analysis in progress
  ELIGIBLE = "ELIGIBLE", // No violations detected - eligible for organic certification
  INELIGIBLE = "INELIGIBLE", // Clear violations detected (synthetic fertilizer)
  NEEDS_REVIEW = "NEEDS_REVIEW", // Borderline cases requiring human review
  FAILED = "FAILED", // Technical error during analysis
}

/**
 * Violation types detected by satellite analysis
 */
export enum ViolationType {
  SYNTHETIC_FERTILIZER = "SYNTHETIC_FERTILIZER", // NDVI spike >0.25 in 30 days
  PESTICIDE_APPLICATION = "PESTICIDE_APPLICATION", // NDVI drop followed by quick recovery
  LAND_CLEARING = "LAND_CLEARING", // NDVI drop >0.40 sustained
}

/**
 * Severity levels for detected violations
 */
export enum ViolationSeverity {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
}

/**
 * Supported crop types for satellite analysis
 * Each has specific NDVI seasonal patterns
 */
export enum SatelliteCropType {
  AVOCADO = "AVOCADO",
  BLUEBERRY = "BLUEBERRY",
  STRAWBERRY = "STRAWBERRY",
  RASPBERRY = "RASPBERRY",
  BLACKBERRY = "BLACKBERRY",
  COFFEE = "COFFEE",
  CACAO = "CACAO",
}

/**
 * Single NDVI data point from satellite imagery
 */
export interface NDVIDataPoint {
  date: string; // ISO 8601: "2023-03-15"
  ndviAverage: number; // 0.0 to 1.0 (vegetation health)
  ndviStdDev: number; // Standard deviation within field
  ndviMin: number; // Minimum NDVI in field
  ndviMax: number; // Maximum NDVI in field
  cloudCoverage: number; // 0-100%
  syntheticFertilizerDetected: boolean;
  confidence: number; // 0-1 analysis confidence
  anomalyScore: number; // 0-100 (higher = more suspicious)
  source: ImagerySource; // Sentinel-2, Landsat-8, etc.
}

/**
 * Violation flag detected during analysis
 */
export interface ViolationFlag {
  id: string;
  date: string; // When violation was detected
  type: ViolationType;
  ndviDelta: number; // Delta from baseline/previous
  severity: ViolationSeverity;
  confidence: number; // 0-1
  description: string; // Human-readable (Spanish for farmers)
  descriptionEn: string; // English for export companies
  affectedAreaPercent: number; // Percentage of field affected
  gpsLocation?: {
    // Center of affected area
    latitude: number;
    longitude: number;
  };
}

/**
 * Main satellite analysis request
 */
export interface SatelliteAnalysisRequest {
  organicFieldId: string;
  analysisYears: number; // Default: 3 (USDA requirement)
  cropType: SatelliteCropType;
  requestedBy: string; // User ID
  intervalDays?: number; // Data point frequency (default: 30)
  maxCloudCoverage?: number; // Filter threshold (default: 50%)
}

/**
 * Satellite compliance report - full analysis result
 */
export interface SatelliteComplianceReport {
  id: string;
  organicFieldId: string;

  // Analysis parameters
  analysisStartDate: Date;
  analysisEndDate: Date;
  analysisYears: number;
  cropType: SatelliteCropType;

  // Data coverage
  totalDataPoints: number; // All collected data points
  validDataPoints: number; // Excluding cloudy days
  dataCoveragePercent: number; // Percentage of expected data points collected

  // NDVI time series
  ndviHistory: NDVIDataPoint[];

  // Compliance assessment
  complianceStatus: SatelliteComplianceStatus;
  overallConfidence: number; // 0-1

  // Violations
  detectedViolations: ViolationFlag[];
  violationCount: number;
  highSeverityCount: number;

  // Report artifacts (S3 URLs)
  reportPdfUrl?: string;
  chartImageUrl?: string;
  rawDataUrl?: string; // JSON export for auditors

  // Performance metrics
  processingTimeMs: number;
  sentinelApiCalls: number;

  // Timestamps
  createdAt: Date;
  expiresAt: Date; // 90 days retention
  requestedBy: string;
}

/**
 * Satellite analysis statistics for dashboard
 */
export interface SatelliteAnalysisStats {
  thisMonth: {
    analysesRun: number;
    sentinelApiCalls: number;
    quotaUsedPercent: number; // 0-100 (free tier: 1000 PU/month)
    avgProcessingTimeMs: number;
    eligibleFields: number;
    ineligibleFields: number;
    needsReviewFields: number;
  };
  costSavings: {
    soilTestsAvoided: number; // Number of $200-500 soil tests avoided
    estimatedSavingsUSD: number; // Total estimated savings
  };
}

/**
 * Crop-specific NDVI baseline values for detection
 * Used to calibrate synthetic fertilizer detection thresholds
 */
export const CROP_NDVI_BASELINES: Record<
  SatelliteCropType,
  {
    peakMonths: number[]; // Months with peak NDVI (0-11)
    lowMonths: number[]; // Months with low NDVI
    healthyNdviMin: number; // Minimum healthy NDVI
    healthyNdviMax: number; // Maximum healthy NDVI
    syntheticThreshold: number; // Delta indicating synthetic fertilizer
  }
> = {
  [SatelliteCropType.AVOCADO]: {
    peakMonths: [4, 5, 6, 7], // May-August (growing season)
    lowMonths: [10, 11, 0], // November-January (harvest)
    healthyNdviMin: 0.45,
    healthyNdviMax: 0.85,
    syntheticThreshold: 0.25,
  },
  [SatelliteCropType.BLUEBERRY]: {
    peakMonths: [5, 6, 7],
    lowMonths: [11, 0, 1],
    healthyNdviMin: 0.4,
    healthyNdviMax: 0.75,
    syntheticThreshold: 0.22,
  },
  [SatelliteCropType.STRAWBERRY]: {
    peakMonths: [3, 4, 5],
    lowMonths: [8, 9],
    healthyNdviMin: 0.35,
    healthyNdviMax: 0.7,
    syntheticThreshold: 0.2,
  },
  [SatelliteCropType.RASPBERRY]: {
    peakMonths: [5, 6, 7],
    lowMonths: [11, 0, 1],
    healthyNdviMin: 0.4,
    healthyNdviMax: 0.75,
    syntheticThreshold: 0.22,
  },
  [SatelliteCropType.BLACKBERRY]: {
    peakMonths: [5, 6, 7],
    lowMonths: [11, 0, 1],
    healthyNdviMin: 0.4,
    healthyNdviMax: 0.75,
    syntheticThreshold: 0.22,
  },
  [SatelliteCropType.COFFEE]: {
    peakMonths: [6, 7, 8, 9],
    lowMonths: [1, 2],
    healthyNdviMin: 0.5,
    healthyNdviMax: 0.8,
    syntheticThreshold: 0.2,
  },
  [SatelliteCropType.CACAO]: {
    peakMonths: [6, 7, 8, 9],
    lowMonths: [1, 2, 3],
    healthyNdviMin: 0.55,
    healthyNdviMax: 0.85,
    syntheticThreshold: 0.2,
  },
};

/**
 * Detection rules for organic violations
 */
export const VIOLATION_DETECTION_RULES = {
  // Rule 1: Synthetic fertilizer detection
  syntheticFertilizer: {
    ndviSpikeThreshold: 0.25, // Delta >0.25 in 30 days
    recoveryWindow: 30, // Days
    description: "Posible aplicación de fertilizante sintético detectada.",
    descriptionEn: "Possible synthetic fertilizer application detected.",
  },

  // Rule 2: Pesticide application detection
  pesticide: {
    ndviDropThreshold: -0.15, // Drop >15%
    recoveryThreshold: 0.1, // Quick recovery >10%
    recoveryWindowDays: 30,
    description: "Posible aplicación de pesticida detectada.",
    descriptionEn: "Possible pesticide application detected.",
  },

  // Rule 3: Land clearing detection
  landClearing: {
    ndviDropThreshold: -0.4, // Drop >40%
    sustainedDays: 60, // Must persist for 60+ days
    description: "Posible desmonte o cambio drástico de vegetación.",
    descriptionEn: "Possible land clearing or drastic vegetation change.",
  },
};

/**
 * Free tier limits for Sentinel Hub API
 */
export const SENTINEL_HUB_LIMITS = {
  monthlyProcessingUnits: 1000, // Free tier limit
  processingUnitsPerRequest: 0.5, // Approximate PU per NDVI request
  maxRequestsPerMonth: 2000, // 1000 / 0.5
  maxFieldsPerMonth: 200, // ~5 requests per field (3 years / 30 days)
};

/**
 * Calculate confidence score for satellite analysis
 */
export function calculateAnalysisConfidence(
  validDataPoints: number,
  expectedDataPoints: number,
  violations: ViolationFlag[],
  avgCloudCoverage: number,
): number {
  // Base confidence from data coverage
  const dataCoverage = Math.min(validDataPoints / expectedDataPoints, 1.0);
  let confidence = dataCoverage * 0.6; // 60% weight

  // Reduce confidence for violations (uncertainty)
  confidence -= violations.length * 0.02;

  // Reduce confidence for high cloud coverage
  confidence -= (avgCloudCoverage / 100) * 0.15;

  // Add base confidence for having enough data
  if (validDataPoints >= 24) {
    // At least 2 years of monthly data
    confidence += 0.25;
  }

  return Math.max(0.5, Math.min(1.0, confidence));
}

/**
 * Determine compliance status from violations
 */
export function determineComplianceStatus(
  violations: ViolationFlag[],
  validDataPoints: number,
  expectedDataPoints: number,
): SatelliteComplianceStatus {
  // Insufficient data
  if (validDataPoints < 24) {
    // Less than 2 years of monthly data
    return SatelliteComplianceStatus.NEEDS_REVIEW;
  }

  // High severity violations = automatic rejection
  const highSeverity = violations.filter(
    (v) => v.severity === ViolationSeverity.HIGH,
  );
  if (highSeverity.length > 0) {
    return SatelliteComplianceStatus.INELIGIBLE;
  }

  // Multiple medium severity violations = needs review
  const mediumSeverity = violations.filter(
    (v) => v.severity === ViolationSeverity.MEDIUM,
  );
  if (mediumSeverity.length >= 3) {
    return SatelliteComplianceStatus.NEEDS_REVIEW;
  }

  // Few violations = needs review
  if (violations.length > 0 && violations.length < 3) {
    return SatelliteComplianceStatus.NEEDS_REVIEW;
  }

  // No violations = eligible
  return SatelliteComplianceStatus.ELIGIBLE;
}

/**
 * Estimate cost savings from satellite analysis
 */
export function estimateCostSavings(analysesCount: number): {
  soilTestsAvoided: number;
  estimatedSavingsUSD: number;
} {
  const avgSoilTestCost = 350; // $200-500 average
  return {
    soilTestsAvoided: analysesCount,
    estimatedSavingsUSD: analysesCount * avgSoilTestCost,
  };
}
