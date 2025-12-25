import logger from '../../../../shared/utils/logger.js';
export class PrismaPublicTraceabilityRepository {
    prisma;
    initialized = false;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async ensureTablesExist() {
        if (this.initialized)
            return;
        try {
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
            await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "PublicTraceabilityLink_batchId_idx"
        ON "PublicTraceabilityLink"("batchId")
      `);
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
            await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "QrScanEvent_shortCode_timestamp_idx"
        ON "QrScanEvent"("shortCode", "timestamp" DESC)
      `);
            this.initialized = true;
            logger.info('PublicTraceability tables initialized');
        }
        catch (error) {
            this.initialized = true;
        }
    }
    async findByShortCode(shortCode) {
        await this.ensureTablesExist();
        const results = await this.prisma.$queryRawUnsafe(`
      SELECT * FROM "PublicTraceabilityLink" WHERE "shortCode" = $1 LIMIT 1
    `, shortCode);
        return results[0] ? this.mapToLink(results[0]) : null;
    }
    async findByBatchId(batchId) {
        await this.ensureTablesExist();
        const results = await this.prisma.$queryRawUnsafe(`
      SELECT * FROM "PublicTraceabilityLink" WHERE "batchId" = $1 LIMIT 1
    `, batchId);
        return results[0] ? this.mapToLink(results[0]) : null;
    }
    async create(input) {
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
    async update(id, data) {
        await this.ensureTablesExist();
        const updates = [];
        const values = [];
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
        const result = await this.prisma.$queryRawUnsafe(`
      SELECT * FROM "PublicTraceabilityLink" WHERE "id" = $1
    `, id);
        return this.mapToLink(result[0]);
    }
    async incrementViewCount(shortCode) {
        await this.ensureTablesExist();
        await this.prisma.$executeRawUnsafe(`
      UPDATE "PublicTraceabilityLink"
      SET "viewCount" = "viewCount" + 1, "updatedAt" = $1
      WHERE "shortCode" = $2
    `, new Date(), shortCode);
    }
    async deactivate(id) {
        await this.ensureTablesExist();
        await this.prisma.$executeRawUnsafe(`
      UPDATE "PublicTraceabilityLink"
      SET "isActive" = false, "updatedAt" = $1
      WHERE "id" = $2
    `, new Date(), id);
    }
    async recordScan(input) {
        await this.ensureTablesExist();
        await this.prisma.$executeRawUnsafe(`
      INSERT INTO "QrScanEvent"
      ("id", "shortCode", "timestamp", "country", "city", "deviceType", "browser", "referrer", "userAgent")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, input.id, input.shortCode, input.timestamp, input.country, input.city, input.deviceType, input.browser, input.referrer, input.userAgent);
        return input;
    }
    async getAnalytics(shortCode, days = 30) {
        await this.ensureTablesExist();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const link = await this.findByShortCode(shortCode);
        const totalResult = await this.prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int as count FROM "QrScanEvent" WHERE "shortCode" = $1
    `, shortCode);
        const totalScans = totalResult[0]?.count || 0;
        const recentResult = await this.prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int as count FROM "QrScanEvent"
      WHERE "shortCode" = $1 AND "timestamp" >= $2
    `, shortCode, cutoffDate);
        const last30DaysScans = recentResult[0]?.count || 0;
        const countryResults = await this.prisma.$queryRawUnsafe(`
      SELECT "country", COUNT(*)::int as count
      FROM "QrScanEvent"
      WHERE "shortCode" = $1 AND "country" IS NOT NULL
      GROUP BY "country"
      ORDER BY count DESC
      LIMIT 10
    `, shortCode);
        const deviceResults = await this.prisma.$queryRawUnsafe(`
      SELECT "deviceType", COUNT(*)::int as count
      FROM "QrScanEvent"
      WHERE "shortCode" = $1
      GROUP BY "deviceType"
    `, shortCode);
        const dailyResults = await this.prisma.$queryRawUnsafe(`
      SELECT DATE("timestamp") as date, COUNT(*)::int as count
      FROM "QrScanEvent"
      WHERE "shortCode" = $1 AND "timestamp" >= $2
      GROUP BY DATE("timestamp")
      ORDER BY date DESC
    `, shortCode, cutoffDate);
        const lastScanResult = await this.prisma.$queryRawUnsafe(`
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
                device: r.deviceType,
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
    async getRecentScans(shortCode, limit = 10) {
        await this.ensureTablesExist();
        const results = await this.prisma.$queryRawUnsafe(`
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
            deviceType: r.deviceType,
            browser: r.browser,
            referrer: r.referrer,
            userAgent: r.userAgent,
        }));
    }
    mapToLink(row) {
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
