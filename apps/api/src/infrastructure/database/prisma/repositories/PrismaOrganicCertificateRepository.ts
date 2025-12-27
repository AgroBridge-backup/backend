/**
 * Prisma OrganicCertificate Repository Implementation
 * Implements IOrganicCertificateRepository using Prisma ORM
 */

import {
  PrismaClient,
  OrganicCertificateStatus as PrismaStatus,
} from "@prisma/client";
import {
  IOrganicCertificateRepository,
  CreateOrganicCertificateData,
  UpdateOrganicCertificateData,
  OrganicCertificateListResult,
  CreateVerificationLogData,
  OrganicCertificateWithDetails,
} from "../../../../domain/repositories/IOrganicCertificateRepository.js";
import {
  OrganicCertificate,
  OrganicCertificateStatus,
  CertificateFilter,
  CertificateVerification,
} from "../../../../domain/entities/OrganicCertificate.js";

export class PrismaOrganicCertificateRepository
  implements IOrganicCertificateRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Map Prisma certificate to domain entity
   */
  private mapToDomain(prismaCert: any): OrganicCertificate {
    return {
      id: prismaCert.id,
      certificateNumber: prismaCert.certificateNumber,
      farmerId: prismaCert.farmerId,
      exportCompanyId: prismaCert.exportCompanyId,
      fieldIds: prismaCert.fieldIds,
      cropType: prismaCert.cropType,
      variety: prismaCert.variety,
      harvestDate: prismaCert.harvestDate,
      estimatedWeight: prismaCert.estimatedWeight
        ? Number(prismaCert.estimatedWeight)
        : null,
      certificationStandard: prismaCert.certificationStandard,
      validFrom: prismaCert.validFrom,
      validTo: prismaCert.validTo,
      status: prismaCert.status as OrganicCertificateStatus,
      submittedAt: prismaCert.submittedAt,
      reviewedBy: prismaCert.reviewedBy,
      reviewedAt: prismaCert.reviewedAt,
      rejectionReason: prismaCert.rejectionReason,
      pdfUrl: prismaCert.pdfUrl,
      qrCodeUrl: prismaCert.qrCodeUrl,
      qrCodeShortUrl: prismaCert.qrCodeShortUrl,
      contentHash: prismaCert.contentHash,
      blockchainTxHash: prismaCert.blockchainTxHash,
      blockchainNetwork: prismaCert.blockchainNetwork,
      blockchainTimestamp: prismaCert.blockchainTimestamp,
      ipfsHash: prismaCert.ipfsHash,
      payloadSnapshot: prismaCert.payloadSnapshot,
      viewCount: prismaCert.viewCount,
      lastViewedAt: prismaCert.lastViewedAt,
      createdAt: prismaCert.createdAt,
      updatedAt: prismaCert.updatedAt,
    };
  }

  /**
   * Map to domain with details
   */
  private mapToDomainWithDetails(
    prismaCert: any,
  ): OrganicCertificateWithDetails {
    return {
      ...this.mapToDomain(prismaCert),
      farmer: {
        id: prismaCert.farmer.id,
        businessName: prismaCert.farmer.businessName,
        municipality: prismaCert.farmer.municipality,
        state: prismaCert.farmer.state,
      },
      exportCompany: {
        id: prismaCert.exportCompany.id,
        name: prismaCert.exportCompany.name,
        country: prismaCert.exportCompany.country,
        logoUrl: prismaCert.exportCompany.logoUrl,
      },
    };
  }

  /**
   * Map verification to domain
   */
  private mapVerificationToDomain(
    prismaVerification: any,
  ): CertificateVerification {
    return {
      id: prismaVerification.id,
      certificateId: prismaVerification.certificateId,
      verifierType: prismaVerification.verifierType,
      country: prismaVerification.country,
      deviceType: prismaVerification.deviceType,
      referrer: prismaVerification.referrer,
      verifiedAt: prismaVerification.verifiedAt,
    };
  }

  async create(
    data: CreateOrganicCertificateData,
  ): Promise<OrganicCertificate> {
    const certificate = await this.prisma.organicCertificate.create({
      data: {
        id: data.id,
        certificateNumber: data.certificateNumber,
        farmerId: data.farmerId,
        exportCompanyId: data.exportCompanyId,
        fieldIds: data.fieldIds,
        cropType: data.cropType,
        variety: data.variety,
        harvestDate: data.harvestDate,
        estimatedWeight: data.estimatedWeight,
        certificationStandard: data.certificationStandard as any,
        validFrom: data.validFrom,
        validTo: data.validTo,
        status: (data.status || OrganicCertificateStatus.DRAFT) as PrismaStatus,
        payloadSnapshot: data.payloadSnapshot,
        contentHash: data.contentHash,
      },
    });
    return this.mapToDomain(certificate);
  }

  async findById(id: string): Promise<OrganicCertificate | null> {
    const certificate = await this.prisma.organicCertificate.findUnique({
      where: { id },
    });
    return certificate ? this.mapToDomain(certificate) : null;
  }

  async findByCertificateNumber(
    certificateNumber: string,
  ): Promise<OrganicCertificate | null> {
    const certificate = await this.prisma.organicCertificate.findUnique({
      where: { certificateNumber },
    });
    return certificate ? this.mapToDomain(certificate) : null;
  }

  async update(
    id: string,
    data: UpdateOrganicCertificateData,
  ): Promise<OrganicCertificate> {
    const certificate = await this.prisma.organicCertificate.update({
      where: { id },
      data: {
        ...(data.status !== undefined && {
          status: data.status as PrismaStatus,
        }),
        ...(data.submittedAt !== undefined && {
          submittedAt: data.submittedAt,
        }),
        ...(data.reviewedBy !== undefined && { reviewedBy: data.reviewedBy }),
        ...(data.reviewedAt !== undefined && { reviewedAt: data.reviewedAt }),
        ...(data.rejectionReason !== undefined && {
          rejectionReason: data.rejectionReason,
        }),
        ...(data.pdfUrl !== undefined && { pdfUrl: data.pdfUrl }),
        ...(data.qrCodeUrl !== undefined && { qrCodeUrl: data.qrCodeUrl }),
        ...(data.qrCodeShortUrl !== undefined && {
          qrCodeShortUrl: data.qrCodeShortUrl,
        }),
        ...(data.contentHash !== undefined && {
          contentHash: data.contentHash,
        }),
        ...(data.blockchainTxHash !== undefined && {
          blockchainTxHash: data.blockchainTxHash,
        }),
        ...(data.blockchainNetwork !== undefined && {
          blockchainNetwork: data.blockchainNetwork,
        }),
        ...(data.blockchainTimestamp !== undefined && {
          blockchainTimestamp: data.blockchainTimestamp,
        }),
        ...(data.ipfsHash !== undefined && { ipfsHash: data.ipfsHash }),
        ...(data.payloadSnapshot !== undefined && {
          payloadSnapshot: data.payloadSnapshot,
        }),
      },
    });
    return this.mapToDomain(certificate);
  }

  async list(filter: CertificateFilter): Promise<OrganicCertificateListResult> {
    const where: any = {};

    if (filter.farmerId) where.farmerId = filter.farmerId;
    if (filter.exportCompanyId) where.exportCompanyId = filter.exportCompanyId;
    if (filter.status) where.status = filter.status as PrismaStatus;
    if (filter.cropType) where.cropType = filter.cropType;
    if (filter.certificationStandard)
      where.certificationStandard = filter.certificationStandard;
    if (filter.fromDate || filter.toDate) {
      where.createdAt = {};
      if (filter.fromDate) where.createdAt.gte = filter.fromDate;
      if (filter.toDate) where.createdAt.lte = filter.toDate;
    }

    const [certificates, total] = await Promise.all([
      this.prisma.organicCertificate.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: filter.limit || 50,
        skip: filter.offset || 0,
      }),
      this.prisma.organicCertificate.count({ where }),
    ]);

    return {
      certificates: certificates.map((c) => this.mapToDomain(c)),
      total,
    };
  }

  async listByFarmer(
    farmerId: string,
    filter?: Omit<CertificateFilter, "farmerId">,
  ): Promise<OrganicCertificateListResult> {
    return this.list({ ...filter, farmerId });
  }

  async listByExportCompany(
    exportCompanyId: string,
    filter?: Omit<CertificateFilter, "exportCompanyId">,
  ): Promise<OrganicCertificateListResult> {
    return this.list({ ...filter, exportCompanyId });
  }

  async findByIdWithDetails(
    id: string,
  ): Promise<OrganicCertificateWithDetails | null> {
    const certificate = await this.prisma.organicCertificate.findUnique({
      where: { id },
      include: {
        farmer: {
          select: {
            id: true,
            businessName: true,
            municipality: true,
            state: true,
          },
        },
        exportCompany: {
          select: {
            id: true,
            name: true,
            country: true,
            logoUrl: true,
          },
        },
      },
    });
    return certificate ? this.mapToDomainWithDetails(certificate) : null;
  }

  async findByCertificateNumberWithDetails(
    certificateNumber: string,
  ): Promise<OrganicCertificateWithDetails | null> {
    const certificate = await this.prisma.organicCertificate.findUnique({
      where: { certificateNumber },
      include: {
        farmer: {
          select: {
            id: true,
            businessName: true,
            municipality: true,
            state: true,
          },
        },
        exportCompany: {
          select: {
            id: true,
            name: true,
            country: true,
            logoUrl: true,
          },
        },
      },
    });
    return certificate ? this.mapToDomainWithDetails(certificate) : null;
  }

  async hasPendingCertificateForFields(
    farmerId: string,
    fieldIds: string[],
  ): Promise<boolean> {
    // Check for existing certificates that are not completed (APPROVED/REJECTED/REVOKED)
    const pendingStatuses = [
      OrganicCertificateStatus.DRAFT,
      OrganicCertificateStatus.PROCESSING,
      OrganicCertificateStatus.PENDING_REVIEW,
    ];

    const existingCertificate = await this.prisma.organicCertificate.findFirst({
      where: {
        farmerId,
        status: { in: pendingStatuses as PrismaStatus[] },
        fieldIds: { hasSome: fieldIds },
      },
    });

    return !!existingCertificate;
  }

  async getNextSequenceNumber(year: number): Promise<number> {
    // Count certificates for the given year
    const count = await this.prisma.organicCertificate.count({
      where: {
        certificateNumber: {
          startsWith: `AGB-MX-${year}-`,
        },
      },
    });
    return count + 1;
  }

  async incrementViewCount(id: string): Promise<void> {
    await this.prisma.organicCertificate.update({
      where: { id },
      data: {
        viewCount: { increment: 1 },
        lastViewedAt: new Date(),
      },
    });
  }

  async logVerification(
    data: CreateVerificationLogData,
  ): Promise<CertificateVerification> {
    const verification =
      await this.prisma.organicCertificateVerification.create({
        data: {
          certificateId: data.certificateId,
          verifierType: data.verifierType,
          country: data.country,
          deviceType: data.deviceType,
          referrer: data.referrer,
        },
      });
    return this.mapVerificationToDomain(verification);
  }

  async getVerificationCount(certificateId: string): Promise<number> {
    return this.prisma.organicCertificateVerification.count({
      where: { certificateId },
    });
  }

  async getLastVerificationDate(certificateId: string): Promise<Date | null> {
    const verification =
      await this.prisma.organicCertificateVerification.findFirst({
        where: { certificateId },
        orderBy: { verifiedAt: "desc" },
        select: { verifiedAt: true },
      });
    return verification?.verifiedAt || null;
  }

  async countByStatus(status: OrganicCertificateStatus): Promise<number> {
    return this.prisma.organicCertificate.count({
      where: { status: status as PrismaStatus },
    });
  }

  async countByFarmer(farmerId: string): Promise<number> {
    return this.prisma.organicCertificate.count({
      where: { farmerId },
    });
  }

  async countByExportCompany(exportCompanyId: string): Promise<number> {
    return this.prisma.organicCertificate.count({
      where: { exportCompanyId },
    });
  }

  async getPendingReviewForExportCompany(
    exportCompanyId: string,
  ): Promise<OrganicCertificate[]> {
    const certificates = await this.prisma.organicCertificate.findMany({
      where: {
        exportCompanyId,
        status: OrganicCertificateStatus.PENDING_REVIEW as PrismaStatus,
      },
      orderBy: { submittedAt: "asc" },
    });
    return certificates.map((c) => this.mapToDomain(c));
  }

  async getBlockchainFailedCertificates(): Promise<OrganicCertificate[]> {
    const certificates = await this.prisma.organicCertificate.findMany({
      where: {
        status: OrganicCertificateStatus.BLOCKCHAIN_FAILED as PrismaStatus,
      },
      orderBy: { createdAt: "asc" },
    });
    return certificates.map((c) => this.mapToDomain(c));
  }
}
