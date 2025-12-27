/**
 * OrganicCertificateService
 * Core domain service for organic certificate generation and management
 * Revenue-critical: $5-20/certificate + SaaS subscription
 */

import { createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { PrismaClient } from "@prisma/client";
import {
  IOrganicCertificateRepository,
  OrganicCertificateWithDetails,
} from "../repositories/IOrganicCertificateRepository.js";
import { IOrganicFieldRepository } from "../repositories/IOrganicFieldRepository.js";
import { IFieldInspectionRepository } from "../repositories/IFieldInspectionRepository.js";
import {
  OrganicCertificate,
  OrganicCertificateStatus,
  CertificateGenerationRequest,
  AggregatedFieldData,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  PublicCertificateData,
  BlockchainProof,
  PdfTemplateData,
  CertificateIpfsMetadata,
  QrCodeContent,
  CertificateFilter,
  ViewData,
  CERTIFICATE_REQUIREMENTS,
  BLOCKCHAIN_EXPLORERS,
  CERTIFICATION_DISPLAY_NAMES,
  IPFS_GATEWAYS,
} from "../entities/OrganicCertificate.js";
import { PdfGenerator } from "../../infrastructure/pdf/PdfGenerator.js";
import { IpfsService } from "../../infrastructure/ipfs/IPFSService.js";
import { BlockchainService } from "./BlockchainService.js";
import { AppError } from "../../shared/errors/AppError.js";
import logger from "../../shared/utils/logger.js";

/**
 * Custom error types
 */
export class InsufficientInspectionDataError extends Error {
  statusCode = 400;
  code = "INSUFFICIENT_INSPECTION_DATA";

  constructor(public errors: ValidationError[]) {
    super("Cannot generate certificate: insufficient inspection data");
    this.name = "InsufficientInspectionDataError";
  }
}

export class CertificateNotFoundError extends Error {
  statusCode = 404;
  code = "CERTIFICATE_NOT_FOUND";

  constructor(identifier: string) {
    super("Certificate not found: " + identifier);
    this.name = "CertificateNotFoundError";
  }
}

export class BlockchainAnchoringError extends Error {
  statusCode = 500;
  code = "BLOCKCHAIN_ANCHORING_FAILED";

  constructor(
    public originalError: Error,
    public retryable: boolean,
  ) {
    super("Failed to anchor certificate to blockchain");
    this.name = "BlockchainAnchoringError";
  }
}

export class PdfGenerationError extends Error {
  statusCode = 500;
  code = "PDF_GENERATION_FAILED";

  constructor(public reason: string) {
    super("PDF generation failed: " + reason);
    this.name = "PdfGenerationError";
  }
}

/**
 * Service dependencies
 */
export interface OrganicCertificateServiceDeps {
  prisma: PrismaClient;
  certificateRepository: IOrganicCertificateRepository;
  fieldRepository: IOrganicFieldRepository;
  inspectionRepository: IFieldInspectionRepository;
  pdfGenerator: PdfGenerator;
  ipfsService?: IpfsService;
  blockchainService?: BlockchainService;
  storageUploader?: (
    key: string,
    buffer: Buffer,
    contentType: string,
  ) => Promise<string>;
}

/**
 * OrganicCertificateService
 */
export class OrganicCertificateService {
  private readonly prisma: PrismaClient;
  private readonly certificateRepository: IOrganicCertificateRepository;
  private readonly fieldRepository: IOrganicFieldRepository;
  private readonly inspectionRepository: IFieldInspectionRepository;
  private readonly pdfGenerator: PdfGenerator;
  private readonly ipfsService?: IpfsService;
  private readonly blockchainService?: BlockchainService;
  private readonly storageUploader?: (
    key: string,
    buffer: Buffer,
    contentType: string,
  ) => Promise<string>;

  private readonly MAX_BLOCKCHAIN_RETRIES = 3;
  private readonly BLOCKCHAIN_RETRY_DELAY_MS = 5000;

  constructor(deps: OrganicCertificateServiceDeps) {
    this.prisma = deps.prisma;
    this.certificateRepository = deps.certificateRepository;
    this.fieldRepository = deps.fieldRepository;
    this.inspectionRepository = deps.inspectionRepository;
    this.pdfGenerator = deps.pdfGenerator;
    this.ipfsService = deps.ipfsService;
    this.blockchainService = deps.blockchainService;
    this.storageUploader = deps.storageUploader;
  }

  /**
   * Generate a new organic certificate
   */
  async generateCertificate(
    request: CertificateGenerationRequest,
  ): Promise<OrganicCertificate> {
    const startTime = Date.now();

    logger.info("Certificate generation started", {
      farmerId: request.farmerId,
      fieldIds: request.fieldIds,
      cropType: request.cropType,
      certificationStandard: request.certificationStandard,
    });

    try {
      // STEP 1: Get farmer and export company info
      const farmer = await this.prisma.producer.findUnique({
        where: { id: request.farmerId },
        include: { exportCompany: true },
      });

      if (!farmer) {
        throw new AppError("Farmer not found", 404);
      }

      if (!farmer.exportCompanyId || !farmer.exportCompany) {
        throw new AppError(
          "Farmer is not associated with an export company",
          400,
        );
      }

      // STEP 2: Verify all fields belong to farmer
      for (const fieldId of request.fieldIds) {
        const field = await this.fieldRepository.findById(fieldId);
        if (!field) {
          throw new AppError("Field not found: " + fieldId, 404);
        }
        if (field.producerId !== request.farmerId) {
          throw new AppError(
            "Field " + fieldId + " does not belong to farmer",
            403,
          );
        }
      }

      // STEP 3: Check for pending certificates
      const hasPending =
        await this.certificateRepository.hasPendingCertificateForFields(
          request.farmerId,
          request.fieldIds,
        );
      if (hasPending) {
        throw new AppError(
          "Farmer already has a pending certificate for these fields",
          409,
        );
      }

      // STEP 4: Aggregate field inspection data
      const dateRange = {
        startDate: new Date(
          Date.now() -
            CERTIFICATE_REQUIREMENTS.inspectionWindowDays * 24 * 60 * 60 * 1000,
        ),
        endDate: new Date(),
      };
      const fieldData = await this.aggregateFieldData(
        request.fieldIds,
        dateRange,
      );

      // STEP 5: Validate inspection requirements
      const validation = await this.validateInspectionRequirements(
        request.fieldIds,
        fieldData,
      );
      if (!validation.isValid) {
        throw new InsufficientInspectionDataError(validation.errors);
      }

      // STEP 6: Generate unique certificate number
      const certificateNumber = await this.generateUniqueCertificateNumber();

      // STEP 7: Compute content hash for blockchain
      const payloadSnapshot = this.buildPayloadSnapshot(
        request,
        fieldData,
        certificateNumber,
      );
      const contentHash = this.computeHash(payloadSnapshot);

      // STEP 8: Create certificate record (status: PROCESSING)
      const validFrom = new Date();
      const validTo = new Date();
      validTo.setDate(
        validTo.getDate() + CERTIFICATE_REQUIREMENTS.certificateValidityDays,
      );

      const certificate = await this.certificateRepository.create({
        certificateNumber,
        farmerId: request.farmerId,
        exportCompanyId: farmer.exportCompanyId,
        fieldIds: request.fieldIds,
        cropType: request.cropType as string,
        harvestDate: request.harvestDate,
        certificationStandard: request.certificationStandard as string,
        validFrom,
        validTo,
        status: OrganicCertificateStatus.PROCESSING,
        payloadSnapshot,
        contentHash,
      });

      logger.info("Certificate record created", {
        certificateId: certificate.id,
        certificateNumber,
        status: "PROCESSING",
      });

      // STEP 9: Generate PDF (async but awaited)
      await this.generateAndStorePdf(certificate, fieldData, farmer);

      // STEP 10: Anchor to blockchain (with retry)
      await this.anchorToBlockchainWithRetry(certificate.id, contentHash);

      // STEP 11: Upload to IPFS (non-blocking)
      this.uploadToIpfsAsync(certificate, fieldData, farmer).catch((err) => {
        logger.warn("IPFS upload failed (non-blocking)", {
          certificateId: certificate.id,
          error: err.message,
        });
      });

      // STEP 12: Update status to PENDING_REVIEW
      const updatedCertificate = await this.certificateRepository.update(
        certificate.id,
        {
          status: OrganicCertificateStatus.PENDING_REVIEW,
          submittedAt: new Date(),
        },
      );

      const duration = Date.now() - startTime;
      logger.info("Certificate generation completed", {
        certificateId: certificate.id,
        certificateNumber,
        status: "PENDING_REVIEW",
        duration,
      });

      return updatedCertificate;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error("Certificate generation failed", {
        farmerId: request.farmerId,
        error: error.message,
        duration,
      });
      throw error;
    }
  }

  /**
   * Get certificate by ID
   */
  async getCertificate(certificateId: string): Promise<OrganicCertificate> {
    const certificate =
      await this.certificateRepository.findById(certificateId);
    if (!certificate) {
      throw new CertificateNotFoundError(certificateId);
    }
    return certificate;
  }

  /**
   * Get certificate with full details
   */
  async getCertificateWithDetails(
    certificateId: string,
  ): Promise<OrganicCertificateWithDetails> {
    const certificate =
      await this.certificateRepository.findByIdWithDetails(certificateId);
    if (!certificate) {
      throw new CertificateNotFoundError(certificateId);
    }
    return certificate;
  }

  /**
   * List certificates with filtering
   */
  async listCertificates(filter: CertificateFilter): Promise<{
    certificates: OrganicCertificate[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const result = await this.certificateRepository.list(filter);
    return {
      certificates: result.certificates,
      total: result.total,
      limit: filter.limit || 50,
      offset: filter.offset || 0,
    };
  }

  /**
   * Approve certificate (export company admin)
   */
  async approveCertificate(
    certificateId: string,
    reviewerId: string,
  ): Promise<OrganicCertificate> {
    const certificate = await this.getCertificate(certificateId);

    if (certificate.status !== OrganicCertificateStatus.PENDING_REVIEW) {
      throw new AppError(
        "Cannot approve certificate with status: " + certificate.status,
        400,
      );
    }

    const updatedCertificate = await this.certificateRepository.update(
      certificateId,
      {
        status: OrganicCertificateStatus.APPROVED,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      },
    );

    logger.info("Certificate approved", {
      certificateId,
      certificateNumber: certificate.certificateNumber,
      reviewerId,
    });

    return updatedCertificate;
  }

  /**
   * Reject certificate (export company admin)
   */
  async rejectCertificate(
    certificateId: string,
    reviewerId: string,
    reason: string,
  ): Promise<OrganicCertificate> {
    const certificate = await this.getCertificate(certificateId);

    if (certificate.status !== OrganicCertificateStatus.PENDING_REVIEW) {
      throw new AppError(
        "Cannot reject certificate with status: " + certificate.status,
        400,
      );
    }

    const updatedCertificate = await this.certificateRepository.update(
      certificateId,
      {
        status: OrganicCertificateStatus.REJECTED,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        rejectionReason: reason,
      },
    );

    logger.info("Certificate rejected", {
      certificateId,
      certificateNumber: certificate.certificateNumber,
      reviewerId,
      reason,
    });

    return updatedCertificate;
  }

  /**
   * Revoke certificate (fraud detected)
   */
  async revokeCertificate(
    certificateId: string,
    reason: string,
  ): Promise<OrganicCertificate> {
    const certificate = await this.getCertificate(certificateId);

    if (certificate.status !== OrganicCertificateStatus.APPROVED) {
      throw new AppError(
        "Cannot revoke certificate with status: " + certificate.status,
        400,
      );
    }

    const updatedCertificate = await this.certificateRepository.update(
      certificateId,
      {
        status: OrganicCertificateStatus.REVOKED,
        rejectionReason: reason,
      },
    );

    logger.warn("Certificate revoked", {
      certificateId,
      certificateNumber: certificate.certificateNumber,
      reason,
    });

    return updatedCertificate;
  }

  /**
   * Verify certificate by certificate number (public API)
   */
  async verifyCertificateByCertNumber(
    certificateNumber: string,
    viewData?: ViewData,
  ): Promise<PublicCertificateData> {
    const certificate =
      await this.certificateRepository.findByCertificateNumberWithDetails(
        certificateNumber,
      );

    if (!certificate) {
      throw new CertificateNotFoundError(certificateNumber);
    }

    // Log verification
    if (viewData) {
      await this.certificateRepository.logVerification({
        certificateId: certificate.id,
        verifierType: "UNKNOWN",
        country: viewData.country,
        deviceType: viewData.deviceType,
        referrer: viewData.referrer,
      });
    }

    // Increment view count
    await this.certificateRepository.incrementViewCount(certificate.id);

    // Get verification stats
    const [verificationCount, lastVerified] = await Promise.all([
      this.certificateRepository.getVerificationCount(certificate.id),
      this.certificateRepository.getLastVerificationDate(certificate.id),
    ]);

    // Calculate total hectares
    let totalHectares = 0;
    for (const fieldId of certificate.fieldIds) {
      const field = await this.fieldRepository.findById(fieldId);
      if (field) {
        totalHectares += field.areaHectares;
      }
    }

    const publicData: PublicCertificateData = {
      valid: certificate.status === OrganicCertificateStatus.APPROVED,
      certificateNumber: certificate.certificateNumber,
      status: certificate.status,
      farmInfo: {
        farmerName: certificate.farmer.businessName,
        location:
          certificate.farmer.municipality + ", " + certificate.farmer.state,
        totalHectares,
        cropType: certificate.cropType,
      },
      certification: {
        standard:
          CERTIFICATION_DISPLAY_NAMES[certificate.certificationStandard] ||
          certificate.certificationStandard,
        harvestDate: certificate.harvestDate,
        issuedDate: certificate.validFrom,
        expiryDate: certificate.validTo,
      },
      blockchain: certificate.blockchainTxHash
        ? {
            network: certificate.blockchainNetwork || "POLYGON",
            txHash: certificate.blockchainTxHash,
            timestamp: certificate.blockchainTimestamp || certificate.createdAt,
            explorerUrl: this.getExplorerUrl(
              certificate.blockchainNetwork || "POLYGON",
              certificate.blockchainTxHash,
            ),
            verified: true,
          }
        : null,
      ipfs: certificate.ipfsHash
        ? {
            cid: certificate.ipfsHash,
            gatewayUrl: IPFS_GATEWAYS.pinata + certificate.ipfsHash,
          }
        : null,
      exportCompany: {
        name: certificate.exportCompany.name,
        country: certificate.exportCompany.country,
      },
      verificationStats: {
        totalVerifications: verificationCount,
        lastVerified,
      },
    };

    return publicData;
  }

  /**
   * Get blockchain proof for certificate
   */
  async verifyBlockchainProof(
    certificateNumber: string,
  ): Promise<BlockchainProof> {
    const certificate =
      await this.certificateRepository.findByCertificateNumber(
        certificateNumber,
      );

    if (!certificate) {
      throw new CertificateNotFoundError(certificateNumber);
    }

    if (!certificate.blockchainTxHash) {
      throw new AppError("Certificate not anchored to blockchain", 400);
    }

    // Verify transaction exists on blockchain (if service available)
    let isValid = true;
    if (this.blockchainService) {
      try {
        const history = await this.blockchainService.getBatchHistoryFromChain(
          certificate.certificateNumber,
        );
        isValid = history.length > 0;
      } catch {
        isValid = true;
      }
    }

    return {
      certificateNumber: certificate.certificateNumber,
      txHash: certificate.blockchainTxHash,
      network: certificate.blockchainNetwork || "POLYGON",
      timestamp: certificate.blockchainTimestamp || certificate.createdAt,
      explorerUrl: this.getExplorerUrl(
        certificate.blockchainNetwork || "POLYGON",
        certificate.blockchainTxHash,
      ),
      isValid,
      contentHash: certificate.contentHash || "",
    };
  }

  /**
   * Aggregate field inspection data for certificate generation
   */
  async aggregateFieldData(
    fieldIds: string[],
    dateRange: { startDate: Date; endDate: Date },
  ): Promise<AggregatedFieldData> {
    const fields: AggregatedFieldData["fields"] = [];
    const allInspections: AggregatedFieldData["inspections"] = [];
    const allOrganicInputs: AggregatedFieldData["organicInputs"] = [];
    const allPhotos: AggregatedFieldData["photos"] = [];
    const allActivities: AggregatedFieldData["activities"] = [];

    for (const fieldId of fieldIds) {
      const field = await this.fieldRepository.findById(fieldId);
      if (!field) continue;

      fields.push({
        id: field.id,
        name: field.name,
        hectares: field.areaHectares,
        cropType: field.cropType,
        certificationStatus: field.certificationStatus,
        gpsCoordinates: {
          centerLat: field.centerLat,
          centerLng: field.centerLng,
          boundaryGeoJson: field.boundaryGeoJson,
        },
      });

      const inspectionResult = await this.inspectionRepository.listByField(
        fieldId,
        {
          fromDate: dateRange.startDate,
          toDate: dateRange.endDate,
          limit: 100,
        },
      );

      for (const inspection of inspectionResult.inspections) {
        const details = await this.inspectionRepository.findByIdWithDetails(
          inspection.id,
        );
        if (!details) continue;

        allInspections.push({
          id: inspection.id,
          fieldId: inspection.fieldId,
          inspectorName: inspection.inspectorName,
          inspectionDate: inspection.inspectionDate,
          inspectionType: inspection.inspectionType,
          isVerified: inspection.isVerified,
          gpsVerified: inspection.gpsVerified,
          photosCount: details.photos.length,
          organicInputsCount: details.organicInputs.length,
          activitiesCount: details.activities.length,
        });

        for (const photo of details.photos) {
          allPhotos.push({
            id: photo.id,
            inspectionId: photo.inspectionId,
            imageUrl: photo.imageUrl,
            thumbnailUrl: photo.thumbnailUrl,
            capturedAt: photo.capturedAt,
            gpsLocation:
              photo.latitude && photo.longitude
                ? { lat: photo.latitude, lng: photo.longitude }
                : null,
            withinFieldBoundary: photo.withinFieldBoundary,
            caption: photo.caption,
          });
        }

        for (const input of details.organicInputs) {
          allOrganicInputs.push({
            id: input.id,
            productName: input.productName,
            inputType: input.inputType,
            isOmriListed: input.isOmriListed,
            isOrganicApproved: input.isOrganicApproved,
            verificationStatus: input.verificationStatus,
            supplier: input.supplier,
          });
        }

        for (const activity of details.activities) {
          allActivities.push({
            id: activity.id,
            activityType: activity.activityType,
            activityDate: activity.activityDate,
            description: activity.description,
          });
        }
      }
    }

    const totalHectares = fields.reduce((sum, f) => sum + f.hectares, 0);
    const verifiedInspections = allInspections.filter(
      (i) => i.isVerified,
    ).length;
    const verifiedOrganicInputs = allOrganicInputs.filter(
      (i) => i.verificationStatus === "VERIFIED",
    ).length;

    return {
      fields,
      inspections: allInspections,
      organicInputs: allOrganicInputs,
      photos: allPhotos,
      activities: allActivities,
      summary: {
        totalFields: fields.length,
        totalHectares,
        totalInspections: allInspections.length,
        verifiedInspections,
        totalPhotos: allPhotos.length,
        totalOrganicInputs: allOrganicInputs.length,
        verifiedOrganicInputs,
        totalActivities: allActivities.length,
        dateRange: { start: dateRange.startDate, end: dateRange.endDate },
      },
    };
  }

  /**
   * Validate inspection requirements for certificate generation
   */
  async validateInspectionRequirements(
    fieldIds: string[],
    fieldData?: AggregatedFieldData,
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const data =
      fieldData ||
      (await this.aggregateFieldData(fieldIds, {
        startDate: new Date(
          Date.now() -
            CERTIFICATE_REQUIREMENTS.inspectionWindowDays * 24 * 60 * 60 * 1000,
        ),
        endDate: new Date(),
      }));

    if (
      data.summary.totalInspections < CERTIFICATE_REQUIREMENTS.minInspections
    ) {
      errors.push({
        code: "INSUFFICIENT_INSPECTIONS",
        field: "inspections",
        message:
          "Minimum " +
          CERTIFICATE_REQUIREMENTS.minInspections +
          " inspections required in last " +
          CERTIFICATE_REQUIREMENTS.inspectionWindowDays +
          " days",
        required: CERTIFICATE_REQUIREMENTS.minInspections,
        actual: data.summary.totalInspections,
      });
    }

    if (data.summary.totalPhotos < CERTIFICATE_REQUIREMENTS.minPhotos) {
      errors.push({
        code: "INSUFFICIENT_PHOTOS",
        field: "photos",
        message:
          "Minimum " +
          CERTIFICATE_REQUIREMENTS.minPhotos +
          " photos required across all inspections",
        required: CERTIFICATE_REQUIREMENTS.minPhotos,
        actual: data.summary.totalPhotos,
      });
    }

    if (
      data.summary.totalOrganicInputs <
      CERTIFICATE_REQUIREMENTS.minOrganicInputs
    ) {
      errors.push({
        code: "INSUFFICIENT_ORGANIC_INPUTS",
        field: "organicInputs",
        message:
          "Minimum " +
          CERTIFICATE_REQUIREMENTS.minOrganicInputs +
          " organic inputs required",
        required: CERTIFICATE_REQUIREMENTS.minOrganicInputs,
        actual: data.summary.totalOrganicInputs,
      });
    }

    if (data.summary.verifiedInspections < data.summary.totalInspections) {
      warnings.push({
        code: "UNVERIFIED_INSPECTIONS",
        field: "inspections",
        message:
          data.summary.totalInspections -
          data.summary.verifiedInspections +
          " inspections are not yet verified",
      });
    }

    if (data.summary.verifiedOrganicInputs < data.summary.totalOrganicInputs) {
      warnings.push({
        code: "UNVERIFIED_ORGANIC_INPUTS",
        field: "organicInputs",
        message:
          data.summary.totalOrganicInputs -
          data.summary.verifiedOrganicInputs +
          " organic inputs are not yet verified",
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Generate unique certificate number
   */
  async generateUniqueCertificateNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const sequence =
      await this.certificateRepository.getNextSequenceNumber(year);
    const paddedSequence = sequence.toString().padStart(6, "0");
    return "AGB-MX-" + year + "-" + paddedSequence;
  }

  /**
   * Generate and store PDF
   */
  private async generateAndStorePdf(
    certificate: OrganicCertificate,
    fieldData: AggregatedFieldData,
    farmer: any,
  ): Promise<void> {
    try {
      const qrContent: QrCodeContent = {
        certificateNumber: certificate.certificateNumber,
        verificationUrl:
          "https://verify.agrobridge.io/" + certificate.certificateNumber,
        issuedDate: certificate.validFrom.toISOString(),
        farmer: farmer.businessName,
        cropType: certificate.cropType,
        blockchainTxHash: certificate.blockchainTxHash,
      };

      const qrCodeDataUrl = await this.pdfGenerator.generateQrCode(qrContent);

      const pdfData: PdfTemplateData = {
        certificateNumber: certificate.certificateNumber,
        issuedDate: certificate.validFrom,
        expiryDate: certificate.validTo,
        qrCodeDataUrl,
        farmer: {
          name: farmer.businessName,
          location: farmer.municipality + ", " + farmer.state,
          totalHectares: fieldData.summary.totalHectares,
        },
        certificationStandard: certificate.certificationStandard,
        cropType: certificate.cropType,
        harvestDate: certificate.harvestDate,
        inspectionSummary: {
          totalInspections: fieldData.summary.totalInspections,
          dateRange: fieldData.summary.dateRange,
          photosCount: fieldData.summary.totalPhotos,
          organicInputsCount: fieldData.summary.totalOrganicInputs,
          activitiesCount: fieldData.summary.totalActivities,
        },
        blockchain: {
          network: certificate.blockchainNetwork || "Polygon",
          txHash: certificate.blockchainTxHash || "pending",
          timestamp: certificate.blockchainTimestamp || new Date(),
          explorerUrl: certificate.blockchainTxHash
            ? this.getExplorerUrl(
                certificate.blockchainNetwork || "POLYGON",
                certificate.blockchainTxHash,
              )
            : "",
        },
        exportCompany: {
          name: farmer.exportCompany?.name || "AgroBridge",
        },
        samplePhotos: fieldData.photos.slice(0, 4).map((p) => ({
          url: p.imageUrl,
          caption: p.caption,
          timestamp: p.capturedAt,
          gpsLocation: p.gpsLocation,
        })),
      };

      const pdfBuffer = await this.pdfGenerator.generateCertificatePdf(pdfData);

      let pdfUrl = "";
      if (this.storageUploader) {
        pdfUrl = await this.storageUploader(
          "certificates/" + certificate.certificateNumber + ".pdf",
          pdfBuffer,
          "application/pdf",
        );
      }

      if (pdfUrl) {
        await this.certificateRepository.update(certificate.id, {
          pdfUrl,
          qrCodeUrl: qrCodeDataUrl,
        });
      }

      logger.info("PDF generation completed", {
        certificateId: certificate.id,
        pdfSize: pdfBuffer.length,
        pdfUrl,
      });
    } catch (error: any) {
      logger.error("PDF generation failed", {
        certificateId: certificate.id,
        error: error.message,
      });
      throw new PdfGenerationError(error.message);
    }
  }

  /**
   * Anchor certificate to blockchain with retry
   */
  private async anchorToBlockchainWithRetry(
    certificateId: string,
    contentHash: string,
  ): Promise<string | null> {
    if (!this.blockchainService) {
      logger.warn("Blockchain service not configured, skipping anchoring", {
        certificateId,
      });
      return null;
    }

    const certificate =
      await this.certificateRepository.findById(certificateId);
    if (!certificate) {
      throw new CertificateNotFoundError(certificateId);
    }

    for (let attempt = 1; attempt <= this.MAX_BLOCKCHAIN_RETRIES; attempt++) {
      try {
        const result = await this.blockchainService.registerEventOnChain({
          eventType: "ORGANIC_CERTIFICATE",
          batchId: certificate.certificateNumber,
          latitude: 0,
          longitude: 0,
          ipfsHash: contentHash,
        });

        await this.certificateRepository.update(certificateId, {
          blockchainTxHash: result.txHash,
          blockchainNetwork: "POLYGON",
          blockchainTimestamp: new Date(),
        });

        logger.info("Certificate anchored to blockchain", {
          certificateId,
          txHash: result.txHash,
          attempt,
        });
        return result.txHash;
      } catch (error: any) {
        logger.warn("Blockchain anchoring attempt failed", {
          certificateId,
          attempt,
          error: error.message,
        });

        if (attempt === this.MAX_BLOCKCHAIN_RETRIES) {
          await this.certificateRepository.update(certificateId, {
            status: OrganicCertificateStatus.BLOCKCHAIN_FAILED,
          });
          throw new BlockchainAnchoringError(error, false);
        }

        await this.sleep(
          this.BLOCKCHAIN_RETRY_DELAY_MS * Math.pow(2, attempt - 1),
        );
      }
    }

    return null;
  }

  /**
   * Upload to IPFS (async, non-blocking)
   */
  private async uploadToIpfsAsync(
    certificate: OrganicCertificate,
    fieldData: AggregatedFieldData,
    farmer: any,
  ): Promise<void> {
    if (!this.ipfsService?.isConfigured()) {
      return;
    }

    try {
      const metadata: CertificateIpfsMetadata = {
        version: "1.0.0",
        certificateNumber: certificate.certificateNumber,
        issuedDate: certificate.validFrom.toISOString(),
        expiryDate: certificate.validTo.toISOString(),
        farmer: {
          id: farmer.id,
          name: farmer.businessName,
          location: farmer.municipality + ", " + farmer.state,
        },
        fields: fieldData.fields.map((f) => ({
          id: f.id,
          name: f.name,
          hectares: f.hectares,
          cropType: f.cropType,
          gpsCoordinates: {
            centerLat: f.gpsCoordinates.centerLat,
            centerLng: f.gpsCoordinates.centerLng,
          },
        })),
        inspections: fieldData.inspections.map((i) => ({
          id: i.id,
          date: i.inspectionDate.toISOString(),
          photosCount: i.photosCount,
          organicInputsCount: i.organicInputsCount,
          verified: i.isVerified,
        })),
        organicInputs: fieldData.organicInputs.map((i) => ({
          name: i.productName,
          type: i.inputType,
          supplier: i.supplier,
          verified: i.verificationStatus === "VERIFIED",
        })),
        photos: fieldData.photos.slice(0, 10).map((p) => ({
          url: p.imageUrl,
          timestamp: p.capturedAt.toISOString(),
          gpsLocation: p.gpsLocation,
        })),
        blockchain: {
          txHash: certificate.blockchainTxHash || "",
          network: certificate.blockchainNetwork || "POLYGON",
          timestamp: (
            certificate.blockchainTimestamp || new Date()
          ).toISOString(),
        },
        certificationStandard: certificate.certificationStandard,
        cropType: certificate.cropType,
        harvestDate: certificate.harvestDate?.toISOString(),
      };

      const ipfsHash = await this.ipfsService.uploadCertificateMetadata(
        certificate.certificateNumber,
        metadata,
      );

      if (ipfsHash) {
        await this.certificateRepository.update(certificate.id, { ipfsHash });
        logger.info("Certificate metadata uploaded to IPFS", {
          certificateId: certificate.id,
          ipfsHash,
        });
      }
    } catch (error: any) {
      logger.error("IPFS upload failed", {
        certificateId: certificate.id,
        error: error.message,
      });
    }
  }

  /**
   * Build payload snapshot for hashing
   */
  private buildPayloadSnapshot(
    request: CertificateGenerationRequest,
    fieldData: AggregatedFieldData,
    certificateNumber: string,
  ): string {
    const payload = {
      version: "1.0.0",
      certificateNumber,
      farmerId: request.farmerId,
      fieldIds: request.fieldIds,
      cropType: request.cropType,
      certificationStandard: request.certificationStandard,
      harvestDate: request.harvestDate?.toISOString(),
      summary: {
        totalFields: fieldData.summary.totalFields,
        totalHectares: fieldData.summary.totalHectares,
        totalInspections: fieldData.summary.totalInspections,
        totalPhotos: fieldData.summary.totalPhotos,
        totalOrganicInputs: fieldData.summary.totalOrganicInputs,
      },
      timestamp: new Date().toISOString(),
    };
    return JSON.stringify(payload);
  }

  /**
   * Compute SHA-256 hash
   */
  private computeHash(data: string): string {
    return createHash("sha256").update(data).digest("hex");
  }

  /**
   * Get blockchain explorer URL
   */
  private getExplorerUrl(network: string, txHash: string): string {
    const baseUrl =
      BLOCKCHAIN_EXPLORERS[network.toUpperCase()] ||
      BLOCKCHAIN_EXPLORERS.POLYGON;
    return baseUrl + txHash;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
