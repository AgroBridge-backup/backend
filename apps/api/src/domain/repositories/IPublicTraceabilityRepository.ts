/**
 * Farmer Storytelling & Consumer Traceability
 * Repository Interface for Public Traceability Links & Scan Events
 */

import {
  PublicTraceabilityLink,
  CreatePublicLinkInput,
  QrScanEvent,
  RecordScanInput,
  ScanAnalytics,
} from "../entities/PublicTraceability.js";

export interface IPublicTraceabilityRepository {
  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC TRACEABILITY LINKS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Find link by short code
   */
  findByShortCode(shortCode: string): Promise<PublicTraceabilityLink | null>;

  /**
   * Find link by batch ID
   */
  findByBatchId(batchId: string): Promise<PublicTraceabilityLink | null>;

  /**
   * Create a new public link
   */
  create(
    input: CreatePublicLinkInput & { shortCode: string; publicUrl: string },
  ): Promise<PublicTraceabilityLink>;

  /**
   * Update link (e.g., set QR image URL)
   */
  update(
    id: string,
    data: Partial<PublicTraceabilityLink>,
  ): Promise<PublicTraceabilityLink>;

  /**
   * Increment view count
   */
  incrementViewCount(shortCode: string): Promise<void>;

  /**
   * Deactivate a link
   */
  deactivate(id: string): Promise<void>;

  // ═══════════════════════════════════════════════════════════════════════════
  // QR SCAN EVENTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Record a scan event
   */
  recordScan(input: QrScanEvent): Promise<QrScanEvent>;

  /**
   * Get scan analytics for a batch
   */
  getAnalytics(shortCode: string, days?: number): Promise<ScanAnalytics>;

  /**
   * Get recent scans for a batch
   */
  getRecentScans(shortCode: string, limit?: number): Promise<QrScanEvent[]>;
}
