/**
 * ExportCompanyDashboard Domain Service
 * Business logic for B2B admin portal - comprehensive dashboard analytics
 * Primary customer: Export companies managing farmer suppliers
 */

import { PrismaClient, Prisma } from "@prisma/client";
import { AppError } from "../../shared/errors/AppError.js";
import logger from "../../shared/utils/logger.js";

// ════════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ════════════════════════════════════════════════════════════════════════════════

export interface DateRange {
  start: Date;
  end: Date;
}

export interface Pagination {
  page: number;
  limit: number;
  sortBy?: string;
  order?: "asc" | "desc";
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DashboardStats {
  period: DateRange;
  farmers: {
    total: number;
    active: number;
    inactive: number;
    newThisMonth: number;
    pendingInvitations: number;
  };
  certificates: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    revoked: number;
    generatedThisMonth: number;
    avgReviewTimeHours: number;
  };
  fields: {
    total: number;
    totalHectares: number;
    byCropType: Record<string, number>;
    byStatus: Record<string, number>;
  };
  inspections: {
    thisMonth: number;
    avgPerFarmer: number;
    photosUploaded: number;
    organicInputsTracked: number;
  };
  billing: {
    tier: string;
    monthlyFee: number;
    certificatesIncluded: number;
    certificatesGenerated: number;
    overageCount: number;
    overageFees: number;
    projectedTotal: number;
  };
  topFarmers: Array<{
    farmerId: string;
    farmerName: string;
    certificatesGenerated: number;
    totalHectares: number;
    lastActivityAt: Date | null;
  }>;
  recentCertificates: Array<{
    certificateId: string;
    certificateNumber: string;
    farmerName: string;
    cropType: string;
    status: string;
    createdAt: Date;
  }>;
}

export interface CertificateAnalytics {
  certificatesByDate: Array<{
    date: string;
    count: number;
    approved: number;
    rejected: number;
  }>;
  byCropType: Record<
    string,
    {
      count: number;
      approvalRate: number;
      avgReviewTimeHours: number;
    }
  >;
  byStandard: Record<string, number>;
  rejectionReasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
  reviewMetrics: {
    avgTimeToApproveHours: number;
    avgTimeToRejectHours: number;
    pendingOver24h: number;
    pendingOver72h: number;
  };
}

export interface FarmerFilter {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface FarmerWithStats {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  enrolledAt: Date;
  fieldsCount: number;
  totalHectares: number;
  certificatesCount: number;
  pendingCertificates: number;
  inspectionsThisMonth: number;
  lastActivityAt: Date | null;
}

export interface BulkInviteResult {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ email: string; reason: string }>;
  invitations: Array<{ id: string; email: string; inviteToken: string }>;
}

export interface BillingUsage {
  period: DateRange;
  tier: string;
  baseFee: number;
  certificatesIncluded: number;
  certificatesGenerated: number;
  overages: number;
  overageFee: number;
  overageFees: number;
  projectedTotal: number;
  daysRemaining: number;
}

export interface InvoiceSummary {
  id: string;
  invoiceNumber: string;
  periodStart: Date;
  periodEnd: Date;
  baseFee: number;
  certificateCount: number;
  overageCerts: number;
  overageFees: number;
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  dueDate: Date;
  paidAt: Date | null;
}

export interface ReviewCertificateInput {
  certificateId: string;
  action: "approve" | "reject";
  reviewerId: string;
  reason?: string;
}

export interface BulkReviewResult {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ certificateId: string; reason: string }>;
}

// ════════════════════════════════════════════════════════════════════════════════
// ERROR CLASSES
// ════════════════════════════════════════════════════════════════════════════════

export class ExportCompanyNotFoundError extends AppError {
  constructor(companyId: string) {
    super("Export company not found: " + companyId, 404);
    this.name = "ExportCompanyNotFoundError";
  }
}

export class FarmerLimitExceededError extends AppError {
  constructor(
    maxFarmers: number,
    currentCount: number,
    attemptedToAdd: number,
  ) {
    super(
      "Farmer limit exceeded. Max: " +
        maxFarmers +
        ", Current: " +
        currentCount +
        ", Attempted to add: " +
        attemptedToAdd,
      400,
    );
    this.name = "FarmerLimitExceededError";
  }
}

export class CertificateNotFoundError extends AppError {
  constructor(certificateId: string) {
    super("Certificate not found: " + certificateId, 404);
    this.name = "CertificateNotFoundError";
  }
}

export class InvalidBillingPeriodError extends AppError {
  constructor(message: string) {
    super(message, 400);
    this.name = "InvalidBillingPeriodError";
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// SERVICE IMPLEMENTATION
// ════════════════════════════════════════════════════════════════════════════════

export class ExportCompanyDashboardService {
  constructor(private prisma: PrismaClient) {}

  // ──────────────────────────────────────────────────────────────────────────────
  // DASHBOARD ANALYTICS
  // ──────────────────────────────────────────────────────────────────────────────

  /**
   * Get comprehensive dashboard statistics
   */
  async getDashboardStats(
    companyId: string,
    dateRange?: DateRange,
  ): Promise<DashboardStats> {
    logger.info("Fetching dashboard stats", { companyId });

    // Verify company exists
    const company = await this.prisma.exportCompany.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new ExportCompanyNotFoundError(companyId);
    }

    const now = new Date();
    const range = dateRange || {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: now,
    };

    // Execute queries in parallel for performance
    const [
      farmerStats,
      certificateStats,
      fieldStats,
      inspectionStats,
      topFarmers,
      recentCertificates,
      pendingInvitations,
    ] = await Promise.all([
      this.getFarmerStats(companyId, range),
      this.getCertificateStats(companyId, range),
      this.getFieldStats(companyId),
      this.getInspectionStats(companyId, range),
      this.getTopFarmers(companyId, 5),
      this.getRecentCertificates(companyId, 10),
      this.prisma.farmerInvitation.count({
        where: { exportCompanyId: companyId, status: "PENDING" },
      }),
    ]);

    // Calculate billing
    const billing = await this.calculateBillingPreview(companyId, range);

    return {
      period: range,
      farmers: {
        ...farmerStats,
        pendingInvitations,
      },
      certificates: certificateStats,
      fields: fieldStats,
      inspections: inspectionStats,
      billing: {
        tier: company.tier,
        monthlyFee: Number(company.monthlyFee),
        ...billing,
      },
      topFarmers,
      recentCertificates,
    };
  }

  /**
   * Get farmer statistics
   */
  private async getFarmerStats(companyId: string, range: DateRange) {
    const producers = await this.prisma.producer.findMany({
      where: { exportCompanyId: companyId },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true } },
      },
    });

    const total = producers.length;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const active = producers.filter((p) => p.updatedAt >= thirtyDaysAgo).length;
    const inactive = total - active;
    const newThisMonth = producers.filter(
      (p) => p.createdAt >= range.start && p.createdAt <= range.end,
    ).length;

    return { total, active, inactive, newThisMonth };
  }

  /**
   * Get certificate statistics
   */
  private async getCertificateStats(companyId: string, range: DateRange) {
    const certificates = await this.prisma.organicCertificate.findMany({
      where: { exportCompanyId: companyId },
      select: {
        id: true,
        status: true,
        createdAt: true,
        reviewedAt: true,
      },
    });

    const total = certificates.length;
    const statusCounts = certificates.reduce(
      (acc, c) => {
        acc[c.status] = (acc[c.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const generatedThisMonth = certificates.filter(
      (c) => c.createdAt >= range.start && c.createdAt <= range.end,
    ).length;

    // Calculate average review time
    const reviewedCerts = certificates.filter(
      (c) =>
        c.reviewedAt && (c.status === "APPROVED" || c.status === "REJECTED"),
    );
    const avgReviewTimeHours =
      reviewedCerts.length > 0
        ? reviewedCerts.reduce((sum, c) => {
            const reviewTimeMs =
              c.reviewedAt!.getTime() - c.createdAt.getTime();
            return sum + reviewTimeMs / (1000 * 60 * 60);
          }, 0) / reviewedCerts.length
        : 0;

    return {
      total,
      pending: statusCounts["PENDING_REVIEW"] || 0,
      approved: statusCounts["APPROVED"] || 0,
      rejected: statusCounts["REJECTED"] || 0,
      revoked: statusCounts["REVOKED"] || 0,
      generatedThisMonth,
      avgReviewTimeHours: Math.round(avgReviewTimeHours * 10) / 10,
    };
  }

  /**
   * Get field statistics
   */
  private async getFieldStats(companyId: string) {
    const fields = await this.prisma.organicField.findMany({
      where: {
        producer: { exportCompanyId: companyId },
      },
      select: {
        id: true,
        areaHectares: true,
        cropType: true,
        certificationStatus: true,
      },
    });

    const total = fields.length;
    const totalHectares = fields.reduce(
      (sum, f) => sum + Number(f.areaHectares),
      0,
    );

    const byCropType = fields.reduce(
      (acc, f) => {
        acc[f.cropType] = (acc[f.cropType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const byStatus = fields.reduce(
      (acc, f) => {
        acc[f.certificationStatus] = (acc[f.certificationStatus] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      total,
      totalHectares: Math.round(totalHectares * 100) / 100,
      byCropType,
      byStatus,
    };
  }

  /**
   * Get inspection statistics
   */
  private async getInspectionStats(companyId: string, range: DateRange) {
    const inspections = await this.prisma.fieldInspection.findMany({
      where: {
        field: { producer: { exportCompanyId: companyId } },
        inspectionDate: { gte: range.start, lte: range.end },
      },
      include: {
        photos: true,
        organicInputs: true,
      },
    });

    const thisMonth = inspections.length;
    const photosUploaded = inspections.reduce(
      (sum, i) => sum + i.photos.length,
      0,
    );
    const organicInputsTracked = inspections.reduce(
      (sum, i) => sum + i.organicInputs.length,
      0,
    );

    // Get farmer count for average
    const farmerCount = await this.prisma.producer.count({
      where: { exportCompanyId: companyId },
    });

    const avgPerFarmer =
      farmerCount > 0 ? Math.round((thisMonth / farmerCount) * 10) / 10 : 0;

    return { thisMonth, avgPerFarmer, photosUploaded, organicInputsTracked };
  }

  /**
   * Get top performing farmers
   */
  private async getTopFarmers(companyId: string, limit: number) {
    const farmers = await this.prisma.producer.findMany({
      where: { exportCompanyId: companyId },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        organicFields: { select: { areaHectares: true } },
        _count: { select: { organicCertificates: true } },
      },
      orderBy: { organicCertificates: { _count: "desc" } },
      take: limit,
    });

    return farmers.map((f) => ({
      farmerId: f.id,
      farmerName: f.user
        ? (f.user.firstName + " " + f.user.lastName).trim()
        : f.businessName || "Unknown",
      certificatesGenerated: f._count.organicCertificates,
      totalHectares: f.organicFields.reduce(
        (sum: number, field: { areaHectares: any }) =>
          sum + Number(field.areaHectares),
        0,
      ),
      lastActivityAt: f.updatedAt,
    }));
  }

  /**
   * Get recent certificates
   */
  private async getRecentCertificates(companyId: string, limit: number) {
    const certificates = await this.prisma.organicCertificate.findMany({
      where: { exportCompanyId: companyId },
      include: {
        farmer: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return certificates.map((c) => ({
      certificateId: c.id,
      certificateNumber: c.certificateNumber,
      farmerName: c.farmer?.user
        ? (c.farmer.user.firstName + " " + c.farmer.user.lastName).trim()
        : c.farmer?.businessName || "Unknown",
      cropType: c.cropType,
      status: c.status,
      createdAt: c.createdAt,
    }));
  }

  /**
   * Calculate billing preview for current month
   */
  private async calculateBillingPreview(companyId: string, range: DateRange) {
    const company = await this.prisma.exportCompany.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new ExportCompanyNotFoundError(companyId);
    }

    const certificatesGenerated = await this.prisma.organicCertificate.count({
      where: {
        exportCompanyId: companyId,
        createdAt: { gte: range.start, lte: range.end },
      },
    });

    const certificatesIncluded = company.certsIncluded;
    const overageCount =
      certificatesIncluded === -1
        ? 0
        : Math.max(0, certificatesGenerated - certificatesIncluded);
    const overageFees = overageCount * Number(company.certificateFee);
    const projectedTotal = Number(company.monthlyFee) + overageFees;

    return {
      certificatesIncluded:
        certificatesIncluded === -1 ? 999999 : certificatesIncluded,
      certificatesGenerated,
      overageCount,
      overageFees,
      projectedTotal,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // CERTIFICATE ANALYTICS
  // ──────────────────────────────────────────────────────────────────────────────

  /**
   * Get detailed certificate analytics
   */
  async getCertificateAnalytics(
    companyId: string,
    range: DateRange,
  ): Promise<CertificateAnalytics> {
    const certificates = await this.prisma.organicCertificate.findMany({
      where: {
        exportCompanyId: companyId,
        createdAt: { gte: range.start, lte: range.end },
      },
      select: {
        id: true,
        status: true,
        cropType: true,
        certificationStandard: true,
        createdAt: true,
        reviewedAt: true,
        rejectionReason: true,
      },
    });

    // Group by date
    const byDateMap = new Map<
      string,
      { count: number; approved: number; rejected: number }
    >();
    certificates.forEach((c) => {
      const dateKey = c.createdAt.toISOString().split("T")[0];
      const existing = byDateMap.get(dateKey) || {
        count: 0,
        approved: 0,
        rejected: 0,
      };
      existing.count++;
      if (c.status === "APPROVED") existing.approved++;
      if (c.status === "REJECTED") existing.rejected++;
      byDateMap.set(dateKey, existing);
    });

    const certificatesByDate = Array.from(byDateMap.entries())
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Group by crop type
    const byCropType: Record<
      string,
      { count: number; approvalRate: number; avgReviewTimeHours: number }
    > = {};
    const cropGroups = new Map<string, typeof certificates>();
    certificates.forEach((c) => {
      const group = cropGroups.get(c.cropType) || [];
      group.push(c);
      cropGroups.set(c.cropType, group);
    });

    cropGroups.forEach((certs, cropType) => {
      const approved = certs.filter((c) => c.status === "APPROVED").length;
      const reviewed = certs.filter((c) => c.reviewedAt).length;
      const reviewTimes = certs
        .filter((c) => c.reviewedAt)
        .map(
          (c) =>
            (c.reviewedAt!.getTime() - c.createdAt.getTime()) /
            (1000 * 60 * 60),
        );

      byCropType[cropType] = {
        count: certs.length,
        approvalRate:
          reviewed > 0 ? Math.round((approved / reviewed) * 100) : 0,
        avgReviewTimeHours:
          reviewTimes.length > 0
            ? Math.round(
                (reviewTimes.reduce((a, b) => a + b, 0) / reviewTimes.length) *
                  10,
              ) / 10
            : 0,
      };
    });

    // Group by standard
    const byStandard: Record<string, number> = {};
    certificates.forEach((c) => {
      byStandard[c.certificationStandard] =
        (byStandard[c.certificationStandard] || 0) + 1;
    });

    // Rejection reasons
    const rejectedCerts = certificates.filter(
      (c) => c.status === "REJECTED" && c.rejectionReason,
    );
    const reasonCounts = new Map<string, number>();
    rejectedCerts.forEach((c) => {
      const reason = c.rejectionReason || "Unknown";
      reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
    });

    const rejectionReasons = Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({
        reason,
        count,
        percentage:
          rejectedCerts.length > 0
            ? Math.round((count / rejectedCerts.length) * 100)
            : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Review metrics
    const now = new Date();
    const pendingCerts = certificates.filter(
      (c) => c.status === "PENDING_REVIEW",
    );
    const pendingOver24h = pendingCerts.filter(
      (c) => now.getTime() - c.createdAt.getTime() > 24 * 60 * 60 * 1000,
    ).length;
    const pendingOver72h = pendingCerts.filter(
      (c) => now.getTime() - c.createdAt.getTime() > 72 * 60 * 60 * 1000,
    ).length;

    const approvedCerts = certificates.filter(
      (c) => c.status === "APPROVED" && c.reviewedAt,
    );
    const rejectedCertsWithTime = certificates.filter(
      (c) => c.status === "REJECTED" && c.reviewedAt,
    );

    const avgTimeToApproveHours =
      approvedCerts.length > 0
        ? Math.round(
            (approvedCerts.reduce(
              (sum, c) =>
                sum + (c.reviewedAt!.getTime() - c.createdAt.getTime()),
              0,
            ) /
              approvedCerts.length /
              (1000 * 60 * 60)) *
              10,
          ) / 10
        : 0;

    const avgTimeToRejectHours =
      rejectedCertsWithTime.length > 0
        ? Math.round(
            (rejectedCertsWithTime.reduce(
              (sum, c) =>
                sum + (c.reviewedAt!.getTime() - c.createdAt.getTime()),
              0,
            ) /
              rejectedCertsWithTime.length /
              (1000 * 60 * 60)) *
              10,
          ) / 10
        : 0;

    return {
      certificatesByDate,
      byCropType,
      byStandard,
      rejectionReasons,
      reviewMetrics: {
        avgTimeToApproveHours,
        avgTimeToRejectHours,
        pendingOver24h,
        pendingOver72h,
      },
    };
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // CERTIFICATE REVIEW
  // ──────────────────────────────────────────────────────────────────────────────

  /**
   * Get pending certificates for review
   */
  async getPendingCertificates(
    companyId: string,
    pagination: Pagination,
  ): Promise<PaginatedResponse<any>> {
    const { page, limit, sortBy = "createdAt", order = "desc" } = pagination;
    const skip = (page - 1) * limit;

    const [certificates, total] = await Promise.all([
      this.prisma.organicCertificate.findMany({
        where: {
          exportCompanyId: companyId,
          status: "PENDING_REVIEW",
        },
        include: {
          farmer: {
            include: {
              user: {
                select: { firstName: true, lastName: true, email: true },
              },
            },
          },
        },
        orderBy: { [sortBy]: order },
        skip,
        take: limit,
      }),
      this.prisma.organicCertificate.count({
        where: {
          exportCompanyId: companyId,
          status: "PENDING_REVIEW",
        },
      }),
    ]);

    return {
      data: certificates,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Review a certificate (approve/reject)
   */
  async reviewCertificate(input: ReviewCertificateInput, companyId: string) {
    const certificate = await this.prisma.organicCertificate.findUnique({
      where: { id: input.certificateId },
    });

    if (!certificate) {
      throw new CertificateNotFoundError(input.certificateId);
    }

    if (certificate.exportCompanyId !== companyId) {
      throw new AppError("Not authorized to review this certificate", 403);
    }

    if (certificate.status !== "PENDING_REVIEW") {
      throw new AppError("Certificate is not pending review", 400);
    }

    const updateData: Prisma.OrganicCertificateUpdateInput = {
      status: input.action === "approve" ? "APPROVED" : "REJECTED",
      reviewedAt: new Date(),
      reviewedBy: input.reviewerId,
    };

    if (input.action === "reject" && input.reason) {
      updateData.rejectionReason = input.reason;
    }

    const updated = await this.prisma.organicCertificate.update({
      where: { id: input.certificateId },
      data: updateData,
    });

    logger.info("Certificate reviewed", {
      certificateId: input.certificateId,
      action: input.action,
      reviewerId: input.reviewerId,
    });

    return updated;
  }

  /**
   * Bulk approve certificates
   */
  async bulkApproveCertificates(
    certificateIds: string[],
    reviewerId: string,
    companyId: string,
  ): Promise<BulkReviewResult> {
    const result: BulkReviewResult = {
      total: certificateIds.length,
      success: 0,
      failed: 0,
      errors: [],
    };

    for (const certificateId of certificateIds) {
      try {
        await this.reviewCertificate(
          { certificateId, action: "approve", reviewerId },
          companyId,
        );
        result.success++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({ certificateId, reason: error.message });
      }
    }

    return result;
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // FARMER MANAGEMENT
  // ──────────────────────────────────────────────────────────────────────────────

  /**
   * List company farmers with filtering
   */
  async listCompanyFarmers(
    companyId: string,
    filter: FarmerFilter,
  ): Promise<PaginatedResponse<FarmerWithStats>> {
    const { status, search, page = 1, limit = 20 } = filter;
    const skip = (page - 1) * limit;

    const where: Prisma.ProducerWhereInput = {
      exportCompanyId: companyId,
    };

    if (search) {
      where.OR = [
        { businessName: { contains: search, mode: "insensitive" } },
        { user: { firstName: { contains: search, mode: "insensitive" } } },
        { user: { lastName: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [farmers, total] = await Promise.all([
      this.prisma.producer.findMany({
        where,
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          organicFields: { select: { areaHectares: true } },
          organicCertificates: { select: { id: true, status: true } },
          _count: {
            select: {
              organicFields: true,
              organicCertificates: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.producer.count({ where }),
    ]);

    const data: FarmerWithStats[] = farmers.map((f) => ({
      id: f.id,
      name: f.user
        ? (f.user.firstName + " " + f.user.lastName).trim()
        : f.businessName,
      email: f.user?.email || "",
      phone: null,
      status: "ACTIVE", // Derived from activity
      enrolledAt: f.createdAt,
      fieldsCount: f._count.organicFields,
      totalHectares: f.organicFields.reduce(
        (sum: number, field: { areaHectares: any }) =>
          sum + Number(field.areaHectares),
        0,
      ),
      certificatesCount: f._count.organicCertificates,
      pendingCertificates: f.organicCertificates.filter(
        (c: { status: string }) => c.status === "PENDING_REVIEW",
      ).length,
      inspectionsThisMonth: 0, // Would need separate query
      lastActivityAt: f.updatedAt,
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get farmer details with full statistics
   */
  async getFarmerDetails(
    farmerId: string,
    companyId: string,
  ): Promise<FarmerWithStats> {
    const farmer = await this.prisma.producer.findFirst({
      where: { id: farmerId, exportCompanyId: companyId },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        organicFields: true,
        organicCertificates: true,
      },
    });

    if (!farmer) {
      throw new AppError("Farmer not found or not in your company", 404);
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const inspectionsThisMonth = await this.prisma.fieldInspection.count({
      where: {
        field: { producerId: farmerId },
        inspectionDate: { gte: monthStart },
      },
    });

    return {
      id: farmer.id,
      name: farmer.user
        ? (farmer.user.firstName + " " + farmer.user.lastName).trim()
        : farmer.businessName,
      email: farmer.user?.email || "",
      phone: null,
      status: "ACTIVE",
      enrolledAt: farmer.createdAt,
      fieldsCount: farmer.organicFields.length,
      totalHectares: farmer.organicFields.reduce(
        (sum: number, f: { areaHectares: any }) => sum + Number(f.areaHectares),
        0,
      ),
      certificatesCount: farmer.organicCertificates.length,
      pendingCertificates: farmer.organicCertificates.filter(
        (c: { status: string }) => c.status === "PENDING_REVIEW",
      ).length,
      inspectionsThisMonth,
      lastActivityAt: farmer.updatedAt,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // BULK FARMER INVITATIONS
  // ──────────────────────────────────────────────────────────────────────────────

  /**
   * Bulk invite farmers
   */
  async inviteFarmersBulk(
    companyId: string,
    farmersData: Array<{ email: string; name?: string }>,
  ): Promise<BulkInviteResult> {
    logger.info("Processing bulk farmer invitations", {
      companyId,
      count: farmersData.length,
    });

    const company = await this.prisma.exportCompany.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new ExportCompanyNotFoundError(companyId);
    }

    // Check farmer limits
    const currentFarmerCount = await this.prisma.producer.count({
      where: { exportCompanyId: companyId },
    });

    const maxFarmers =
      company.farmersIncluded === -1 ? 999999 : company.farmersIncluded;

    if (currentFarmerCount + farmersData.length > maxFarmers) {
      throw new FarmerLimitExceededError(
        maxFarmers,
        currentFarmerCount,
        farmersData.length,
      );
    }

    const result: BulkInviteResult = {
      total: farmersData.length,
      success: 0,
      failed: 0,
      errors: [],
      invitations: [],
    };

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    for (const farmerData of farmersData) {
      try {
        // Validate email
        if (!this.isValidEmail(farmerData.email)) {
          result.failed++;
          result.errors.push({
            email: farmerData.email,
            reason: "Invalid email format",
          });
          continue;
        }

        // Check for existing invitation
        const existing = await this.prisma.farmerInvitation.findFirst({
          where: {
            exportCompanyId: companyId,
            email: farmerData.email.toLowerCase(),
            status: "PENDING",
          },
        });

        if (existing) {
          result.failed++;
          result.errors.push({
            email: farmerData.email,
            reason: "Invitation already pending",
          });
          continue;
        }

        // Create invitation
        const invitation = await this.prisma.farmerInvitation.create({
          data: {
            exportCompanyId: companyId,
            email: farmerData.email.toLowerCase(),
            farmerName: farmerData.name,
            status: "PENDING",
            expiresAt,
          },
        });

        result.success++;
        result.invitations.push({
          id: invitation.id,
          email: invitation.email,
          inviteToken: invitation.inviteToken,
        });
      } catch (error: any) {
        result.failed++;
        result.errors.push({ email: farmerData.email, reason: error.message });
      }
    }

    logger.info("Bulk invitation completed", {
      companyId,
      total: result.total,
      success: result.success,
      failed: result.failed,
    });

    return result;
  }

  /**
   * Get invitation statistics
   */
  async getInvitationStats(companyId: string) {
    const [pending, accepted, expired, cancelled] = await Promise.all([
      this.prisma.farmerInvitation.count({
        where: { exportCompanyId: companyId, status: "PENDING" },
      }),
      this.prisma.farmerInvitation.count({
        where: { exportCompanyId: companyId, status: "ACCEPTED" },
      }),
      this.prisma.farmerInvitation.count({
        where: { exportCompanyId: companyId, status: "EXPIRED" },
      }),
      this.prisma.farmerInvitation.count({
        where: { exportCompanyId: companyId, status: "CANCELLED" },
      }),
    ]);

    const recentInvitations = await this.prisma.farmerInvitation.findMany({
      where: { exportCompanyId: companyId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return {
      pending,
      accepted,
      expired,
      cancelled,
      total: pending + accepted + expired + cancelled,
      recentInvitations,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // BILLING & INVOICING
  // ──────────────────────────────────────────────────────────────────────────────

  /**
   * Get current billing usage
   */
  async getCurrentUsage(companyId: string): Promise<BillingUsage> {
    const company = await this.prisma.exportCompany.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new ExportCompanyNotFoundError(companyId);
    }

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const certificatesGenerated = await this.prisma.organicCertificate.count({
      where: {
        exportCompanyId: companyId,
        createdAt: { gte: periodStart, lte: now },
      },
    });

    const certificatesIncluded =
      company.certsIncluded === -1 ? 999999 : company.certsIncluded;
    const overages = Math.max(0, certificatesGenerated - certificatesIncluded);
    const overageFee = Number(company.certificateFee);
    const overageFees = overages * overageFee;
    const baseFee = Number(company.monthlyFee);
    const projectedTotal = baseFee + overageFees;

    const daysRemaining = Math.ceil(
      (periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      period: { start: periodStart, end: periodEnd },
      tier: company.tier,
      baseFee,
      certificatesIncluded,
      certificatesGenerated,
      overages,
      overageFee,
      overageFees,
      projectedTotal,
      daysRemaining,
    };
  }

  /**
   * Generate invoice for billing period
   */
  async generateInvoice(
    companyId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<InvoiceSummary> {
    const company = await this.prisma.exportCompany.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new ExportCompanyNotFoundError(companyId);
    }

    if (periodStart >= periodEnd) {
      throw new InvalidBillingPeriodError(
        "Period start must be before period end",
      );
    }

    // Count certificates in period
    const certificateCount = await this.prisma.organicCertificate.count({
      where: {
        exportCompanyId: companyId,
        createdAt: { gte: periodStart, lte: periodEnd },
      },
    });

    // Count farmers
    const farmerCount = await this.prisma.producer.count({
      where: { exportCompanyId: companyId },
    });

    // Calculate fees
    const baseFee = Number(company.monthlyFee);
    const certsIncluded =
      company.certsIncluded === -1 ? 999999 : company.certsIncluded;
    const overageCerts = Math.max(0, certificateCount - certsIncluded);
    const overageFees = overageCerts * Number(company.certificateFee);
    const subtotal = baseFee + overageFees;
    const tax = subtotal * 0.16; // 16% IVA
    const total = subtotal + tax;

    // Generate invoice number
    const year = periodEnd.getFullYear();
    const invoiceCount = await this.prisma.exportCompanyInvoice.count({
      where: { invoiceNumber: { startsWith: "INV-" + year } },
    });
    const invoiceNumber =
      "INV-" + year + "-" + String(invoiceCount + 1).padStart(6, "0");

    // Due date: 15 days after period end
    const dueDate = new Date(periodEnd);
    dueDate.setDate(dueDate.getDate() + 15);

    // Create invoice
    const invoice = await this.prisma.exportCompanyInvoice.create({
      data: {
        exportCompanyId: companyId,
        invoiceNumber,
        periodStart,
        periodEnd,
        baseFee,
        farmerCount,
        certificateCount,
        overageCerts,
        overageFees,
        subtotal,
        tax,
        total,
        status: "DRAFT",
        dueDate,
      },
    });

    logger.info("Invoice generated", {
      invoiceId: invoice.id,
      invoiceNumber,
      total,
    });

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      baseFee: Number(invoice.baseFee),
      certificateCount: invoice.certificateCount,
      overageCerts: invoice.overageCerts,
      overageFees: Number(invoice.overageFees),
      subtotal: Number(invoice.subtotal),
      tax: Number(invoice.tax),
      total: Number(invoice.total),
      status: invoice.status,
      dueDate: invoice.dueDate,
      paidAt: invoice.paidAt,
    };
  }

  /**
   * Get invoice history
   */
  async getInvoiceHistory(companyId: string): Promise<InvoiceSummary[]> {
    const invoices = await this.prisma.exportCompanyInvoice.findMany({
      where: { exportCompanyId: companyId },
      orderBy: { createdAt: "desc" },
    });

    return invoices.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      periodStart: i.periodStart,
      periodEnd: i.periodEnd,
      baseFee: Number(i.baseFee),
      certificateCount: i.certificateCount,
      overageCerts: i.overageCerts,
      overageFees: Number(i.overageFees),
      subtotal: Number(i.subtotal),
      tax: Number(i.tax),
      total: Number(i.total),
      status: i.status,
      dueDate: i.dueDate,
      paidAt: i.paidAt,
    }));
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // COMPANY SETTINGS
  // ──────────────────────────────────────────────────────────────────────────────

  /**
   * Get company profile
   */
  async getCompanyProfile(companyId: string) {
    const company = await this.prisma.exportCompany.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new ExportCompanyNotFoundError(companyId);
    }

    return company;
  }

  /**
   * Update company profile
   */
  async updateCompanyProfile(
    companyId: string,
    updates: {
      name?: string;
      phone?: string;
      address?: string;
      contactName?: string;
      contactEmail?: string;
      contactPhone?: string;
    },
  ) {
    const company = await this.prisma.exportCompany.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new ExportCompanyNotFoundError(companyId);
    }

    return this.prisma.exportCompany.update({
      where: { id: companyId },
      data: updates,
    });
  }

  /**
   * Update branding settings
   */
  async updateBrandingSettings(
    companyId: string,
    branding: { logoUrl?: string; primaryColor?: string },
  ) {
    const company = await this.prisma.exportCompany.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new ExportCompanyNotFoundError(companyId);
    }

    return this.prisma.exportCompany.update({
      where: { id: companyId },
      data: branding,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ──────────────────────────────────────────────────────────────────────────────

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
