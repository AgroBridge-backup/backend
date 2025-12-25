/**
 * Satellite Analysis Repository Interface
 *
 * Data access layer for satellite compliance analysis records.
 */

import {
  SatelliteComplianceReport,
  SatelliteComplianceStatus,
  SatelliteAnalysisStats,
  SatelliteCropType,
} from '../entities/SatelliteAnalysis.js';

/**
 * Create satellite analysis input
 */
export interface CreateSatelliteAnalysisInput {
  id: string;
  organicFieldId: string;
  analysisStartDate: Date;
  analysisEndDate: Date;
  analysisYears: number;
  cropType: SatelliteCropType;
  complianceStatus: SatelliteComplianceStatus;
  requestedBy: string;
  expiresAt: Date;
}

/**
 * Update satellite analysis input
 */
export interface UpdateSatelliteAnalysisInput {
  complianceStatus?: SatelliteComplianceStatus;
  overallConfidence?: number;
  totalDataPoints?: number;
  validDataPoints?: number;
  dataCoveragePercent?: number;
  ndviHistory?: object[];
  detectedViolations?: object[];
  violationCount?: number;
  highSeverityCount?: number;
  reportPdfUrl?: string;
  chartImageUrl?: string;
  rawDataUrl?: string;
  processingTimeMs?: number;
  sentinelApiCalls?: number;
}

/**
 * Filter for listing satellite analyses
 */
export interface SatelliteAnalysisFilter {
  organicFieldId?: string;
  complianceStatus?: SatelliteComplianceStatus;
  cropType?: SatelliteCropType;
  createdAfter?: Date;
  createdBefore?: Date;
  requestedBy?: string;
  limit?: number;
  offset?: number;
}

/**
 * Satellite Analysis Repository Interface
 */
export interface ISatelliteAnalysisRepository {
  /**
   * Create new satellite analysis record
   */
  create(input: CreateSatelliteAnalysisInput): Promise<SatelliteComplianceReport>;

  /**
   * Find analysis by ID
   */
  findById(id: string): Promise<SatelliteComplianceReport | null>;

  /**
   * Find latest analysis for a field
   */
  findLatestByField(organicFieldId: string): Promise<SatelliteComplianceReport | null>;

  /**
   * Update analysis record
   */
  update(id: string, input: UpdateSatelliteAnalysisInput): Promise<SatelliteComplianceReport>;

  /**
   * List analyses for a field
   */
  listByField(organicFieldId: string, limit?: number): Promise<SatelliteComplianceReport[]>;

  /**
   * List analyses with filters
   */
  list(filter: SatelliteAnalysisFilter): Promise<{
    analyses: SatelliteComplianceReport[];
    total: number;
  }>;

  /**
   * Delete analysis (admin only)
   */
  delete(id: string): Promise<void>;

  /**
   * Get statistics for dashboard
   */
  getStats(exportCompanyId?: string): Promise<SatelliteAnalysisStats>;

  /**
   * Count analyses by status
   */
  countByStatus(status: SatelliteComplianceStatus): Promise<number>;

  /**
   * Count API calls this month (for quota tracking)
   */
  countApiCallsThisMonth(): Promise<number>;

  /**
   * Get fields needing re-analysis (older than X days)
   */
  getFieldsNeedingReanalysis(olderThanDays: number): Promise<string[]>;
}
