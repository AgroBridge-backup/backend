/**
 * Farmer Storytelling & Consumer Traceability
 * Prisma Repository Implementation
 *
 * Note: This uses inline table creation since Prisma schema migration
 * may not be immediately available. Uses raw SQL for new tables.
 */

import { PrismaClient } from '@prisma/client';
import { IPublicTraceabilityRepository } from '../../../../domain/repositories/IPublicTraceabilityRepository.js';
import {
  PublicTraceabilityLink,
  CreatePublicLinkInput,
  QrScanEvent,
  ScanAnalytics,
  DeviceType,
} from '../../../../domain/entities/PublicTraceability.js';
import logger from '../../../../shared/utils/logger.js';

export class PrismaPublicTraceabilityRepository implements IPublicTraceabilityRepository {
  private initialized = false;

  constructor(private prisma: PrismaClient) {}

  /**
   * Ensure tables exist (idempotent)
   */
  private async ensureTablesExist(): Promise<void> {
    if (this.initialized) return;

    try {
      // Create PublicTraceabilityLink table if not exists
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "PublicTraceabilityLink" (
          "id" TEXT PRIMARY KEY,
          "batchId" TEXT NOT NULL,
          "shortCode" TEXT UNIQUE NOT NULL,
          "publicUrl" TEXT NOT NULL,
          "qrImageUrl" TEXT,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "viewCount" INTEGER NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "expiresAt" TIMESTAMP(3)
        )
      `);

      // Create index on batchId
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "PublicTraceabilityLink_batchId_idx"
        ON "PublicTraceabilityLink"("batchId")
      `);

      // Create QrScanEvent table if not exists
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "QrScanEvent" (
          "id" TEXT PRIMARY KEY,
          "shortCode" TEXT NOT NULL,
          "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "country" TEXT,
          "city" TEXT,
          "deviceType" TEXT NOT NULL DEFAULT 'UNKNOWN',
          "browser" TEXT,
          "referrer" TEXT,
          "userAgent" TEXT
        )
      `);

      // Create index on shortCode and timestamp
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "QrScanEvent_shortCode_timestamp_idx"
        ON "QrScanEvent"("shortCode", "timestamp" DESC)
      `);

      this.initialized = true;
      logger.info('PublicTraceability tables initialized');
    } catch (error) {
      // Tables might already exist, that's fine
      this.initialized = true;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC TRACEABILITY LINKS
  // ═══════════════════════════════════════════════════════════════════════════

  async findByShortCode(shortCode: string): Promise<PublicTraceabilityLink | null> {
    await this.ensureTablesExist();

    const results = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "PublicTraceabilityLink" WHERE "shortCode" = $1 LIMIT 1
    `, shortCode);

    return results[0] ? this.mapToLink(results[0]) : null;
  }

  async findByBatchId(batchId: string): Promise<PublicTraceabilityLink | null> {
    await this.ensureTablesExist();

    const results = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "PublicTraceabilityLink" WHERE "batchId" = $1 LIMIT 1
    `, batchId);

    return results[0] ? this.mapToLink(results[0]) : null;
  }

  async create(
    input: CreatePublicLinkInput & { shortCode: string; publicUrl: string }
  ): Promise<PublicTraceabilityLink> {
    await this.ensureTablesExist();

    const id = crypto.randomUUID();
    const now = new Date();

    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "PublicTraceabilityLink"
      ("id", "batchId", "shortCode", "publicUrl", "isActive", "viewCount", "createdAt", "updatedAt", "expiresAt")
      VALUES ($1, $2, $3, $4, true, 0, $5, $5, $6)
    `, id, input.batchId, input.shortCode, input.publicUrl, now, input.expiresAt || null);

    return {
      id,
      batchId: input.batchId,
      shortCode: input.shortCode,
      publicUrl: input.publicUrl,
      qrImageUrl: null,
      isActive: true,
      viewCount: 0,
      createdAt: now,
      updatedAt: now,
      expiresAt: input.expiresAt || null,
    };
  }

  async update(id: string, data: Partial<PublicTraceabilityLink>): Promise<PublicTraceabilityLink> {
    await this.ensureTablesExist();

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.qrImageUrl !== undefined) {
      updates.push(`"qrImageUrl" = $${paramIndex++}`);
      values.push(data.qrImageUrl);
    }
    if (data.isActive !== undefined) {
      updates.push(`"isActive" = $${paramIndex++}`);
      values.push(data.isActive);
    }

    updates.push(`"updatedAt" = $${paramIndex++}`);
    values.push(new Date());

    values.push(id);

    await this.prisma.$executeRawUnsafe(`
      UPDATE "PublicTraceabilityLink"
      SET ${updates.join(', ')}
      WHERE "id" = $${paramIndex}
    `, ...values);

    const result = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "PublicTraceabilityLink" WHERE "id" = $1
    `, id);

    return this.mapToLink(result[0]);
  }

  async incrementViewCount(shortCode: string): Promise<void> {
    await this.ensureTablesExist();

    await this.prisma.$executeRawUnsafe(`
      UPDATE "PublicTraceabilityLink"
      SET "viewCount" = "viewCount" + 1, "updatedAt" = $1
      WHERE "shortCode" = $2
    `, new Date(), shortCode);
  }

  async deactivate(id: string): Promise<void> {
    await this.ensureTablesExist();

    await this.prisma.$executeRawUnsafe(`
      UPDATE "PublicTraceabilityLink"
      SET "isActive" = false, "updatedAt" = $1
      WHERE "id" = $2
    `, new Date(), id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QR SCAN EVENTS
  // ═══════════════════════════════════════════════════════════════════════════

  async recordScan(input: QrScanEvent): Promise<QrScanEvent> {
    await this.ensureTablesExist();

    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "QrScanEvent"
      ("id", "shortCode", "timestamp", "country", "city", "deviceType", "browser", "referrer", "userAgent")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `,
      input.id,
      input.shortCode,
      input.timestamp,
      input.country,
      input.city,
      input.deviceType,
      input.browser,
      input.referrer,
      input.userAgent
    );

    return input;
  }

  async getAnalytics(shortCode: string, days: number = 30): Promise<ScanAnalytics> {
    await this.ensureTablesExist();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Get link info
    const link = await this.findByShortCode(shortCode);

    // Total scans
    const totalResult = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT COUNT(*)::int as count FROM "QrScanEvent" WHERE "shortCode" = $1
    `, shortCode);
    const totalScans = totalResult[0]?.count || 0;

    // Scans in last N days
    const recentResult = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT COUNT(*)::int as count FROM "QrScanEvent"
      WHERE "shortCode" = $1 AND "timestamp" >= $2
    `, shortCode, cutoffDate);
    const last30DaysScans = recentResult[0]?.count || 0;

    // Scans by country
    const countryResults = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT "country", COUNT(*)::int as count
      FROM "QrScanEvent"
      WHERE "shortCode" = $1 AND "country" IS NOT NULL
      GROUP BY "country"
      ORDER BY count DESC
      LIMIT 10
    `, shortCode);

    // Scans by device
    const deviceResults = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT "deviceType", COUNT(*)::int as count
      FROM "QrScanEvent"
      WHERE "shortCode" = $1
      GROUP BY "deviceType"
    `, shortCode);

    // Scans by day (last 30 days)
    const dailyResults = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT DATE("timestamp") as date, COUNT(*)::int as count
      FROM "QrScanEvent"
      WHERE "shortCode" = $1 AND "timestamp" >= $2
      GROUP BY DATE("timestamp")
      ORDER BY date DESC
    `, shortCode, cutoffDate);

    // Last scan
    const lastScanResult = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT "timestamp" FROM "QrScanEvent"
      WHERE "shortCode" = $1
      ORDER BY "timestamp" DESC
      LIMIT 1
    `, shortCode);

    return {
      shortCode,
      batchId: link?.batchId || '',
      totalScans,
      uniqueCountries: countryResults.length,
      scansByCountry: countryResults.map(r => ({
        country: r.country,
        count: r.count,
      })),
      scansByDevice: deviceResults.map(r => ({
        device: r.deviceType as DeviceType,
        count: r.count,
      })),
      scansByDay: dailyResults.map(r => ({
        date: r.date.toISOString().split('T')[0],
        count: r.count,
      })),
      last30DaysScans,
      lastScanAt: lastScanResult[0]?.timestamp || null,
    };
  }

  async getRecentScans(shortCode: string, limit: number = 10): Promise<QrScanEvent[]> {
    await this.ensureTablesExist();

    const results = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "QrScanEvent"
      WHERE "shortCode" = $1
      ORDER BY "timestamp" DESC
      LIMIT $2
    `, shortCode, limit);

    return results.map(r => ({
      id: r.id,
      shortCode: r.shortCode,
      timestamp: r.timestamp,
      country: r.country,
      city: r.city,
      deviceType: r.deviceType as DeviceType,
      browser: r.browser,
      referrer: r.referrer,
      userAgent: r.userAgent,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private mapToLink(row: any): PublicTraceabilityLink {
    return {
      id: row.id,
      batchId: row.batchId,
      shortCode: row.shortCode,
      publicUrl: row.publicUrl,
      qrImageUrl: row.qrImageUrl,
      isActive: row.isActive,
      viewCount: row.viewCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      expiresAt: row.expiresAt,
    };
  }
}

import crypto from 'crypto';
