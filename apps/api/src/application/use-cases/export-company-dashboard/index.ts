/**
 * Export Company Dashboard Use Cases
 * Application layer for B2B admin portal operations
 */

import { PrismaClient } from "@prisma/client";
import {
  ExportCompanyDashboardService,
  DateRange,
  Pagination,
  FarmerFilter,
  ReviewCertificateInput,
  DashboardStats,
  CertificateAnalytics,
  PaginatedResponse,
  FarmerWithStats,
  BulkInviteResult,
  BillingUsage,
  InvoiceSummary,
  BulkReviewResult,
} from "../../../domain/services/ExportCompanyDashboardService.js";

// ════════════════════════════════════════════════════════════════════════════════
// DASHBOARD ANALYTICS USE CASES
// ════════════════════════════════════════════════════════════════════════════════

export class GetDashboardStatsUseCase {
  private service: ExportCompanyDashboardService;

  constructor(prisma: PrismaClient) {
    this.service = new ExportCompanyDashboardService(prisma);
  }

  async execute(
    companyId: string,
    dateRange?: DateRange,
  ): Promise<DashboardStats> {
    return this.service.getDashboardStats(companyId, dateRange);
  }
}

export class GetCertificateAnalyticsUseCase {
  private service: ExportCompanyDashboardService;

  constructor(prisma: PrismaClient) {
    this.service = new ExportCompanyDashboardService(prisma);
  }

  async execute(
    companyId: string,
    dateRange: DateRange,
  ): Promise<CertificateAnalytics> {
    return this.service.getCertificateAnalytics(companyId, dateRange);
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// CERTIFICATE REVIEW USE CASES
// ════════════════════════════════════════════════════════════════════════════════

export class GetPendingCertificatesUseCase {
  private service: ExportCompanyDashboardService;

  constructor(prisma: PrismaClient) {
    this.service = new ExportCompanyDashboardService(prisma);
  }

  async execute(
    companyId: string,
    pagination: Pagination,
  ): Promise<PaginatedResponse<any>> {
    return this.service.getPendingCertificates(companyId, pagination);
  }
}

export class ReviewCertificateUseCase {
  private service: ExportCompanyDashboardService;

  constructor(prisma: PrismaClient) {
    this.service = new ExportCompanyDashboardService(prisma);
  }

  async execute(input: ReviewCertificateInput, companyId: string) {
    return this.service.reviewCertificate(input, companyId);
  }
}

export class BulkApproveCertificatesUseCase {
  private service: ExportCompanyDashboardService;

  constructor(prisma: PrismaClient) {
    this.service = new ExportCompanyDashboardService(prisma);
  }

  async execute(
    certificateIds: string[],
    reviewerId: string,
    companyId: string,
  ): Promise<BulkReviewResult> {
    return this.service.bulkApproveCertificates(
      certificateIds,
      reviewerId,
      companyId,
    );
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// FARMER MANAGEMENT USE CASES
// ════════════════════════════════════════════════════════════════════════════════

export class ListCompanyFarmersUseCase {
  private service: ExportCompanyDashboardService;

  constructor(prisma: PrismaClient) {
    this.service = new ExportCompanyDashboardService(prisma);
  }

  async execute(
    companyId: string,
    filter: FarmerFilter,
  ): Promise<PaginatedResponse<FarmerWithStats>> {
    return this.service.listCompanyFarmers(companyId, filter);
  }
}

export class GetFarmerDetailsUseCase {
  private service: ExportCompanyDashboardService;

  constructor(prisma: PrismaClient) {
    this.service = new ExportCompanyDashboardService(prisma);
  }

  async execute(farmerId: string, companyId: string): Promise<FarmerWithStats> {
    return this.service.getFarmerDetails(farmerId, companyId);
  }
}

export class InviteFarmersBulkUseCase {
  private service: ExportCompanyDashboardService;

  constructor(prisma: PrismaClient) {
    this.service = new ExportCompanyDashboardService(prisma);
  }

  async execute(
    companyId: string,
    farmersData: Array<{ email: string; name?: string }>,
  ): Promise<BulkInviteResult> {
    return this.service.inviteFarmersBulk(companyId, farmersData);
  }
}

export class GetInvitationStatsUseCase {
  private service: ExportCompanyDashboardService;

  constructor(prisma: PrismaClient) {
    this.service = new ExportCompanyDashboardService(prisma);
  }

  async execute(companyId: string) {
    return this.service.getInvitationStats(companyId);
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// BILLING USE CASES
// ════════════════════════════════════════════════════════════════════════════════

export class GetCurrentUsageUseCase {
  private service: ExportCompanyDashboardService;

  constructor(prisma: PrismaClient) {
    this.service = new ExportCompanyDashboardService(prisma);
  }

  async execute(companyId: string): Promise<BillingUsage> {
    return this.service.getCurrentUsage(companyId);
  }
}

export class GenerateInvoiceUseCase {
  private service: ExportCompanyDashboardService;

  constructor(prisma: PrismaClient) {
    this.service = new ExportCompanyDashboardService(prisma);
  }

  async execute(
    companyId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<InvoiceSummary> {
    return this.service.generateInvoice(companyId, periodStart, periodEnd);
  }
}

export class GetInvoiceHistoryUseCase {
  private service: ExportCompanyDashboardService;

  constructor(prisma: PrismaClient) {
    this.service = new ExportCompanyDashboardService(prisma);
  }

  async execute(companyId: string): Promise<InvoiceSummary[]> {
    return this.service.getInvoiceHistory(companyId);
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// COMPANY SETTINGS USE CASES
// ════════════════════════════════════════════════════════════════════════════════

export class GetCompanyProfileUseCase {
  private service: ExportCompanyDashboardService;

  constructor(prisma: PrismaClient) {
    this.service = new ExportCompanyDashboardService(prisma);
  }

  async execute(companyId: string) {
    return this.service.getCompanyProfile(companyId);
  }
}

export class UpdateCompanyProfileUseCase {
  private service: ExportCompanyDashboardService;

  constructor(prisma: PrismaClient) {
    this.service = new ExportCompanyDashboardService(prisma);
  }

  async execute(
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
    return this.service.updateCompanyProfile(companyId, updates);
  }
}

export class UpdateBrandingSettingsUseCase {
  private service: ExportCompanyDashboardService;

  constructor(prisma: PrismaClient) {
    this.service = new ExportCompanyDashboardService(prisma);
  }

  async execute(
    companyId: string,
    branding: { logoUrl?: string; primaryColor?: string },
  ) {
    return this.service.updateBrandingSettings(companyId, branding);
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// AGGREGATE EXPORTS
// ════════════════════════════════════════════════════════════════════════════════

export {
  DateRange,
  Pagination,
  FarmerFilter,
  DashboardStats,
  CertificateAnalytics,
  PaginatedResponse,
  FarmerWithStats,
  BulkInviteResult,
  BillingUsage,
  InvoiceSummary,
  BulkReviewResult,
} from "../../../domain/services/ExportCompanyDashboardService.js";
