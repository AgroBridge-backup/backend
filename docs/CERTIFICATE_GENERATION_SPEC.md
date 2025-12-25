# CERTIFICATE GENERATION SPECIFICATION

**Date**: 2025-12-24
**Version**: 1.0.0
**Priority**: P0 - Critical Path

---

## 1. OVERVIEW

The certificate generation flow is the core value proposition of AgroBridge's organic certification pivot. This document specifies the complete technical implementation for generating tamper-proof organic certificates with blockchain anchoring.

---

## 2. FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CERTIFICATE GENERATION FLOW                              │
└─────────────────────────────────────────────────────────────────────────────┘

 FARMER REQUEST
 ══════════════

 ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
 │   Farmer     │────▶│   Validate   │────▶│   Create     │
 │   Request    │     │   Eligibility│     │   Draft      │
 └──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       │ fieldIds           │ ≥4 inspections?    │ Generate cert #
       │ cropType           │ GPS verified?      │ Status: DRAFT
       │ harvestDate        │ Inputs verified?   │
       │                    │                    │
       ▼                    ▼                    ▼

 SYSTEM PROCESSING
 ═════════════════

 ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
 │   Aggregate  │────▶│   Build      │────▶│   Compute    │
 │   Data       │     │   Payload    │     │   Hash       │
 └──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       │ Inspections        │ JSON structure     │ SHA-256
       │ Photos             │ Farmer info        │ contentHash
       │ Inputs             │ Field data         │
       │ Activities         │ Inspection summary │
       │                    │                    │
       ▼                    ▼                    ▼

 ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
 │   Generate   │────▶│   Upload     │────▶│   Update     │
 │   PDF + QR   │     │   to S3      │     │   Record     │
 └──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       │ PDFKit             │ pdfUrl             │ Status: PENDING_REVIEW
       │ QR code            │ qrCodeUrl          │ Notify export company
       │                    │                    │
       ▼                    ▼                    ▼

 EXPORT COMPANY REVIEW
 ═════════════════════

 ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
 │   Admin      │────▶│   View       │────▶│   Approve/   │
 │   Dashboard  │     │   Details    │     │   Reject     │
 └──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       │ Pending list       │ Audit trail        │ APPROVED → anchor
       │                    │ Photos             │ REJECTED → feedback
       │                    │ GPS proof          │
       ▼                    ▼                    ▼

 BLOCKCHAIN ANCHORING (ON APPROVAL)
 ═══════════════════════════════════

 ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
 │   Anchor     │────▶│   Upload     │────▶│   Finalize   │
 │   Polygon    │     │   IPFS       │     │   Certificate│
 └──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       │ txHash             │ ipfsCid            │ Status: APPROVED
       │ blockNumber        │ gatewayUrl         │ Notify farmer
       │ timestamp          │                    │ Increment bill
       ▼                    ▼                    ▼
```

---

## 3. API SPECIFICATION

### 3.1 Request Certificate

**Endpoint**: `POST /api/v1/farmers/me/certificates/request`

**Authentication**: JWT (PRODUCER role)

**Request Body**:
```typescript
interface RequestCertificateInput {
  fieldIds: string[];                                    // Array of OrganicField IDs
  cropType: string;                                      // AVOCADO, BLUEBERRY, etc.
  variety?: string;                                      // HASS, etc.
  certificationStandard: 'ORGANIC_USDA' | 'ORGANIC_EU' | 'SENASICA';
  harvestDate?: string;                                  // ISO date
  estimatedWeight?: number;                              // kg
  notes?: string;                                        // Farmer notes
}
```

**Example Request**:
```json
{
  "fieldIds": ["clx123abc", "clx456def"],
  "cropType": "AVOCADO",
  "variety": "HASS",
  "certificationStandard": "ORGANIC_USDA",
  "harvestDate": "2025-02-15",
  "estimatedWeight": 25000,
  "notes": "Pre-harvest certification for US export"
}
```

**Success Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "certificate": {
      "id": "cert_clx789xyz",
      "certificateNumber": "AGB-MX-2025-001234",
      "status": "PENDING_REVIEW",
      "farmerId": "prod_abc123",
      "exportCompanyId": "exp_def456",
      "fieldIds": ["clx123abc", "clx456def"],
      "cropType": "AVOCADO",
      "variety": "HASS",
      "certificationStandard": "ORGANIC_USDA",
      "harvestDate": "2025-02-15T00:00:00Z",
      "estimatedWeight": 25000,
      "validFrom": "2025-01-15T00:00:00Z",
      "validTo": "2026-01-15T00:00:00Z",
      "pdfUrl": "https://s3.amazonaws.com/agrobridge-certs/cert_clx789xyz.pdf",
      "qrCodeUrl": "https://s3.amazonaws.com/agrobridge-qr/cert_clx789xyz.png",
      "contentHash": null,
      "blockchainTxHash": null,
      "ipfsHash": null,
      "createdAt": "2025-01-15T10:30:00Z"
    },
    "eligibility": {
      "inspectionsRequired": 4,
      "inspectionsActual": 12,
      "photosCount": 156,
      "organicInputsVerified": 8,
      "gpsVerificationRate": 100
    },
    "message": "Certificate submitted for review. Estimated review time: 24-48 hours."
  }
}
```

**Error Responses**:

```json
// 400 - Insufficient inspections
{
  "success": false,
  "error": "Insufficient field inspections",
  "code": "INSUFFICIENT_INSPECTIONS",
  "details": {
    "required": 4,
    "actual": 2,
    "message": "Minimum 4 field inspections required in last 90 days"
  }
}

// 400 - No verified organic inputs
{
  "success": false,
  "error": "No organic inputs verified",
  "code": "NO_ORGANIC_INPUTS",
  "details": {
    "message": "Please upload organic input receipts and wait for verification"
  }
}

// 400 - GPS verification failed
{
  "success": false,
  "error": "GPS verification failed",
  "code": "GPS_VERIFICATION_FAILED",
  "details": {
    "failedFields": ["clx123abc"],
    "message": "Some photos GPS coordinates do not match declared field boundaries"
  }
}

// 403 - Export company suspended
{
  "success": false,
  "error": "Export company account suspended",
  "code": "COMPANY_SUSPENDED",
  "details": {
    "message": "Contact your export company administrator"
  }
}
```

---

## 4. BACKEND IMPLEMENTATION

### 4.1 RequestCertificateUseCase

```typescript
// Location: apps/api/src/application/use-cases/organic-certificates/RequestCertificateUseCase.ts

import { IOrganicCertificateRepository } from '../../../domain/repositories/IOrganicCertificateRepository.js';
import { IOrganicFieldRepository } from '../../../domain/repositories/IOrganicFieldRepository.js';
import { IFieldInspectionRepository } from '../../../domain/repositories/IFieldInspectionRepository.js';
import { OrganicCertificateService } from '../../../domain/services/OrganicCertificateService.js';
import { AppError } from '../../../shared/errors/AppError.js';
import logger from '../../../shared/utils/logger.js';

interface RequestCertificateInput {
  farmerId: string;
  exportCompanyId: string;
  fieldIds: string[];
  cropType: string;
  variety?: string;
  certificationStandard: 'ORGANIC_USDA' | 'ORGANIC_EU' | 'SENASICA';
  harvestDate?: Date;
  estimatedWeight?: number;
  notes?: string;
}

interface RequestCertificateOutput {
  certificate: OrganicCertificate;
  eligibility: EligibilityDetails;
}

export class RequestCertificateUseCase {
  constructor(
    private certificateRepository: IOrganicCertificateRepository,
    private fieldRepository: IOrganicFieldRepository,
    private inspectionRepository: IFieldInspectionRepository,
    private certificateService: OrganicCertificateService,
  ) {}

  async execute(input: RequestCertificateInput): Promise<RequestCertificateOutput> {
    const {
      farmerId,
      exportCompanyId,
      fieldIds,
      cropType,
      certificationStandard,
      harvestDate,
      estimatedWeight,
      variety,
      notes,
    } = input;

    // 1. Validate fields belong to farmer
    const fields = await this.fieldRepository.findByIds(fieldIds);

    if (fields.length !== fieldIds.length) {
      throw new AppError('One or more fields not found', 404);
    }

    for (const field of fields) {
      if (field.producerId !== farmerId) {
        throw new AppError('Field does not belong to farmer', 403);
      }
    }

    // 2. Check certificate eligibility
    const eligibility = await this.certificateService.checkEligibility(
      farmerId,
      fieldIds,
      certificationStandard,
    );

    if (!eligibility.canIssue) {
      throw new AppError(eligibility.message, 400, {
        code: eligibility.errorCode,
        details: eligibility.details,
      });
    }

    // 3. Generate certificate number
    const certificateNumber = await this.certificateService.generateCertificateNumber();

    // 4. Build certificate payload
    const payload = await this.certificateService.buildPayload({
      certificateNumber,
      farmerId,
      fieldIds,
      cropType,
      variety,
      certificationStandard,
      harvestDate,
    });

    // 5. Generate PDF and QR code
    const { pdfUrl, qrCodeUrl } = await this.certificateService.generateCertificateAssets(
      certificateNumber,
      payload,
    );

    // 6. Calculate validity period (1 year from today)
    const validFrom = new Date();
    const validTo = new Date();
    validTo.setFullYear(validTo.getFullYear() + 1);

    // 7. Create certificate record
    const certificate = await this.certificateRepository.create({
      certificateNumber,
      farmerId,
      exportCompanyId,
      fieldIds,
      cropType,
      variety,
      certificationStandard,
      harvestDate,
      estimatedWeight,
      validFrom,
      validTo,
      status: 'PENDING_REVIEW',
      pdfUrl,
      qrCodeUrl,
      payloadSnapshot: JSON.stringify(payload),
      submittedAt: new Date(),
    });

    // 8. Notify export company admin
    await this.certificateService.notifyExportCompany(exportCompanyId, certificate);

    logger.info('Certificate requested', {
      certificateId: certificate.id,
      certificateNumber,
      farmerId,
      fieldCount: fieldIds.length,
      standard: certificationStandard,
    });

    return {
      certificate,
      eligibility: {
        inspectionsRequired: eligibility.requirements.inspections.required,
        inspectionsActual: eligibility.requirements.inspections.actual,
        photosCount: eligibility.requirements.photos.actual,
        organicInputsVerified: eligibility.requirements.inputs.verified,
        gpsVerificationRate: eligibility.requirements.gps.verificationRate,
      },
    };
  }
}
```

### 4.2 OrganicCertificateService

```typescript
// Location: apps/api/src/domain/services/OrganicCertificateService.ts

import { createHash } from 'crypto';
import { PrismaClient, CertificationType } from '@prisma/client';
import { IOrganicCertificateRepository } from '../repositories/IOrganicCertificateRepository.js';
import { IFieldInspectionRepository } from '../repositories/IFieldInspectionRepository.js';
import { BlockchainService } from './BlockchainService.js';
import { IPFSService } from './IPFSService.js';
import { CertificatePDFService } from './CertificatePDFService.js';
import { QRCodeService } from './QRCodeService.js';
import { StorageService } from '../../infrastructure/storage/StorageService.js';
import { EmailService } from '../../infrastructure/notifications/EmailService.js';
import { AppError } from '../../shared/errors/AppError.js';
import logger from '../../shared/utils/logger.js';

// Minimum requirements for certificate eligibility
const ELIGIBILITY_REQUIREMENTS = {
  minInspections: 4,           // Last 90 days
  minPhotosPerField: 5,
  minVerifiedInputs: 1,
  minGpsVerificationRate: 80,  // Percentage
  inspectionWindowDays: 90,
};

export interface CertificatePayload {
  version: string;
  certificateNumber: string;
  generatedAt: string;
  farmer: {
    id: string;
    name: string;
    location: string;
  };
  fields: Array<{
    id: string;
    name: string;
    cropType: string;
    hectares: number;
    organicSince: string;
  }>;
  certification: {
    standard: string;
    standardName: string;
    harvestDate?: string;
    validFrom: string;
    validTo: string;
  };
  inspectionSummary: {
    totalInspections: number;
    photosCount: number;
    organicInputsVerified: number;
    activitiesLogged: number;
    gpsVerificationRate: number;
    dateRange: { start: string; end: string };
  };
  inspections: Array<{
    id: string;
    date: string;
    photosCount: number;
    inputsCount: number;
    activitiesCount: number;
  }>;
  organicInputs: Array<{
    productName: string;
    inputType: string;
    verified: boolean;
    receiptDate?: string;
  }>;
}

export class OrganicCertificateService {
  private static readonly PAYLOAD_VERSION = '1.0.0';

  constructor(
    private prisma: PrismaClient,
    private certificateRepository: IOrganicCertificateRepository,
    private inspectionRepository: IFieldInspectionRepository,
    private blockchainService: BlockchainService,
    private ipfsService: IPFSService,
    private pdfService: CertificatePDFService,
    private qrService: QRCodeService,
    private storageService: StorageService,
    private emailService: EmailService,
  ) {}

  /**
   * Check if farmer can request certificate for given fields and standard
   */
  async checkEligibility(
    farmerId: string,
    fieldIds: string[],
    standard: CertificationType,
  ): Promise<EligibilityResult> {
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - ELIGIBILITY_REQUIREMENTS.inspectionWindowDays);

    // Get inspections for all fields in time window
    const inspections = await this.inspectionRepository.findByFieldIds(fieldIds, {
      dateFrom: windowStart,
    });

    // Count totals
    let totalPhotos = 0;
    let verifiedInputs = 0;
    let gpsVerifiedPhotos = 0;
    let totalGpsPhotos = 0;
    let totalActivities = 0;

    for (const inspection of inspections) {
      totalPhotos += inspection.photos?.length || 0;
      verifiedInputs += inspection.organicInputs?.filter((i: any) => i.verificationStatus === 'VERIFIED').length || 0;
      totalActivities += inspection.activities?.length || 0;

      for (const photo of inspection.photos || []) {
        totalGpsPhotos++;
        if (photo.withinFieldBoundary) gpsVerifiedPhotos++;
      }
    }

    const gpsVerificationRate = totalGpsPhotos > 0
      ? (gpsVerifiedPhotos / totalGpsPhotos) * 100
      : 0;

    // Build requirements check
    const requirements = {
      inspections: {
        required: ELIGIBILITY_REQUIREMENTS.minInspections,
        actual: inspections.length,
        met: inspections.length >= ELIGIBILITY_REQUIREMENTS.minInspections,
      },
      photos: {
        required: ELIGIBILITY_REQUIREMENTS.minPhotosPerField * fieldIds.length,
        actual: totalPhotos,
        met: totalPhotos >= ELIGIBILITY_REQUIREMENTS.minPhotosPerField * fieldIds.length,
      },
      inputs: {
        required: ELIGIBILITY_REQUIREMENTS.minVerifiedInputs,
        verified: verifiedInputs,
        met: verifiedInputs >= ELIGIBILITY_REQUIREMENTS.minVerifiedInputs,
      },
      gps: {
        required: ELIGIBILITY_REQUIREMENTS.minGpsVerificationRate,
        verificationRate: gpsVerificationRate,
        met: gpsVerificationRate >= ELIGIBILITY_REQUIREMENTS.minGpsVerificationRate,
      },
    };

    // Determine overall eligibility
    const canIssue = requirements.inspections.met &&
                     requirements.photos.met &&
                     requirements.inputs.met &&
                     requirements.gps.met;

    // Build error message if not eligible
    let message = 'All requirements met';
    let errorCode = '';

    if (!requirements.inspections.met) {
      message = `Minimum ${requirements.inspections.required} field inspections required in last ${ELIGIBILITY_REQUIREMENTS.inspectionWindowDays} days. You have ${requirements.inspections.actual}.`;
      errorCode = 'INSUFFICIENT_INSPECTIONS';
    } else if (!requirements.inputs.met) {
      message = 'At least 1 verified organic input receipt required.';
      errorCode = 'NO_ORGANIC_INPUTS';
    } else if (!requirements.gps.met) {
      message = `GPS verification rate must be at least ${ELIGIBILITY_REQUIREMENTS.minGpsVerificationRate}%. Current rate: ${gpsVerificationRate.toFixed(1)}%.`;
      errorCode = 'GPS_VERIFICATION_FAILED';
    } else if (!requirements.photos.met) {
      message = `Minimum ${requirements.photos.required} photos required. You have ${requirements.photos.actual}.`;
      errorCode = 'INSUFFICIENT_PHOTOS';
    }

    return {
      canIssue,
      message,
      errorCode,
      requirements,
      details: {
        inspectionWindow: { start: windowStart, end: new Date() },
        totalActivities,
      },
    };
  }

  /**
   * Generate unique certificate number
   * Format: AGB-MX-YYYY-NNNNNN
   */
  async generateCertificateNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `AGB-MX-${year}-`;

    // Get last certificate number for this year
    const lastCert = await this.prisma.organicCertificate.findFirst({
      where: {
        certificateNumber: { startsWith: prefix },
      },
      orderBy: { certificateNumber: 'desc' },
    });

    let sequence = 1;
    if (lastCert) {
      const lastSequence = parseInt(lastCert.certificateNumber.slice(-6), 10);
      sequence = lastSequence + 1;
    }

    return `${prefix}${sequence.toString().padStart(6, '0')}`;
  }

  /**
   * Build certificate payload for hashing and storage
   */
  async buildPayload(input: {
    certificateNumber: string;
    farmerId: string;
    fieldIds: string[];
    cropType: string;
    variety?: string;
    certificationStandard: CertificationType;
    harvestDate?: Date;
  }): Promise<CertificatePayload> {
    // Get farmer info
    const farmer = await this.prisma.producer.findUnique({
      where: { id: input.farmerId },
    });

    if (!farmer) {
      throw new AppError('Farmer not found', 404);
    }

    // Get fields
    const fields = await this.prisma.organicField.findMany({
      where: { id: { in: input.fieldIds } },
    });

    // Get inspections in last 90 days
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - ELIGIBILITY_REQUIREMENTS.inspectionWindowDays);

    const inspections = await this.prisma.fieldInspection.findMany({
      where: {
        fieldId: { in: input.fieldIds },
        inspectionDate: { gte: windowStart },
      },
      include: {
        photos: true,
        organicInputs: { where: { verificationStatus: 'VERIFIED' } },
        activities: true,
      },
      orderBy: { inspectionDate: 'desc' },
    });

    // Aggregate organic inputs
    const allInputs: any[] = [];
    for (const inspection of inspections) {
      allInputs.push(...(inspection.organicInputs || []));
    }

    // Calculate summary stats
    const totalPhotos = inspections.reduce((sum, i) => sum + (i.photos?.length || 0), 0);
    const totalActivities = inspections.reduce((sum, i) => sum + (i.activities?.length || 0), 0);
    const gpsVerifiedPhotos = inspections.reduce((sum, i) =>
      sum + (i.photos?.filter(p => p.withinFieldBoundary).length || 0), 0);
    const gpsVerificationRate = totalPhotos > 0 ? (gpsVerifiedPhotos / totalPhotos) * 100 : 0;

    const now = new Date();
    const validFrom = now;
    const validTo = new Date(now);
    validTo.setFullYear(validTo.getFullYear() + 1);

    return {
      version: OrganicCertificateService.PAYLOAD_VERSION,
      certificateNumber: input.certificateNumber,
      generatedAt: now.toISOString(),
      farmer: {
        id: farmer.id,
        name: farmer.businessName || farmer.rfc || 'Unknown',
        location: `${farmer.municipality || ''}, ${farmer.state || ''}, Mexico`,
      },
      fields: fields.map(f => ({
        id: f.id,
        name: f.name,
        cropType: f.cropType,
        hectares: Number(f.areaHectares),
        organicSince: f.organicSince?.toISOString() || '',
      })),
      certification: {
        standard: input.certificationStandard,
        standardName: this.getStandardName(input.certificationStandard),
        harvestDate: input.harvestDate?.toISOString(),
        validFrom: validFrom.toISOString(),
        validTo: validTo.toISOString(),
      },
      inspectionSummary: {
        totalInspections: inspections.length,
        photosCount: totalPhotos,
        organicInputsVerified: allInputs.length,
        activitiesLogged: totalActivities,
        gpsVerificationRate: Math.round(gpsVerificationRate),
        dateRange: {
          start: windowStart.toISOString(),
          end: now.toISOString(),
        },
      },
      inspections: inspections.slice(0, 10).map(i => ({ // Last 10 inspections
        id: i.id,
        date: i.inspectionDate.toISOString(),
        photosCount: i.photos?.length || 0,
        inputsCount: i.organicInputs?.length || 0,
        activitiesCount: i.activities?.length || 0,
      })),
      organicInputs: allInputs.map(input => ({
        productName: input.productName,
        inputType: input.inputType,
        verified: input.verificationStatus === 'VERIFIED',
        receiptDate: input.receiptDate?.toISOString(),
      })),
    };
  }

  /**
   * Generate PDF and QR code assets
   */
  async generateCertificateAssets(
    certificateNumber: string,
    payload: CertificatePayload,
  ): Promise<{ pdfUrl: string; qrCodeUrl: string }> {
    // Generate verification URL
    const verificationUrl = `https://verify.agrobridge.io/${certificateNumber}`;

    // Generate QR code
    const qrCodeBuffer = await this.qrService.generate(verificationUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    // Upload QR code to S3
    const qrCodeUrl = await this.storageService.upload(
      qrCodeBuffer,
      `qr-codes/${certificateNumber}.png`,
      'image/png',
    );

    // Generate PDF with embedded QR
    const pdfBuffer = await this.pdfService.generate(payload, qrCodeBuffer);

    // Upload PDF to S3
    const pdfUrl = await this.storageService.upload(
      pdfBuffer,
      `certificates/${certificateNumber}.pdf`,
      'application/pdf',
    );

    logger.info('Certificate assets generated', {
      certificateNumber,
      pdfUrl,
      qrCodeUrl,
    });

    return { pdfUrl, qrCodeUrl };
  }

  /**
   * Anchor approved certificate to blockchain
   */
  async anchorToBlockchain(certificateId: string): Promise<BlockchainAnchorResult> {
    const certificate = await this.certificateRepository.findById(certificateId);

    if (!certificate) {
      throw new AppError('Certificate not found', 404);
    }

    if (certificate.status !== 'APPROVED') {
      throw new AppError('Only approved certificates can be anchored', 400);
    }

    // Compute content hash from payload
    const contentHash = this.computeHash(certificate.payloadSnapshot || '');

    // Upload metadata to IPFS
    const ipfsHash = await this.ipfsService.upload(
      JSON.parse(certificate.payloadSnapshot || '{}'),
    );

    // Anchor to Polygon
    try {
      const blockchainResult = await this.blockchainService.anchorOrganicCertificate({
        certificateNumber: certificate.certificateNumber,
        contentHash,
        ipfsCid: ipfsHash,
        certificationStandard: certificate.certificationStandard,
        validFrom: certificate.validFrom,
        validTo: certificate.validTo,
      });

      // Update certificate with blockchain data
      await this.certificateRepository.update(certificateId, {
        contentHash,
        blockchainTxHash: blockchainResult.txHash,
        blockchainNetwork: 'polygon',
        blockchainTimestamp: new Date(),
        ipfsHash,
      });

      logger.info('Certificate anchored to blockchain', {
        certificateId,
        certificateNumber: certificate.certificateNumber,
        txHash: blockchainResult.txHash,
        ipfsHash,
      });

      return {
        txHash: blockchainResult.txHash,
        blockNumber: blockchainResult.blockNumber,
        ipfsHash,
        contentHash,
      };
    } catch (error: any) {
      logger.error('Failed to anchor certificate to blockchain', {
        certificateId,
        error: error.message,
      });

      // Don't fail the approval - mark as pending blockchain
      await this.certificateRepository.update(certificateId, {
        contentHash,
        // Leave blockchainTxHash null - will retry
      });

      throw new AppError('Blockchain anchoring failed. Certificate approved but not yet anchored.', 500);
    }
  }

  /**
   * Approve certificate and trigger blockchain anchoring
   */
  async approveCertificate(
    certificateId: string,
    approvedBy: string,
  ): Promise<OrganicCertificate> {
    const certificate = await this.certificateRepository.findById(certificateId);

    if (!certificate) {
      throw new AppError('Certificate not found', 404);
    }

    if (certificate.status !== 'PENDING_REVIEW') {
      throw new AppError(`Cannot approve certificate with status: ${certificate.status}`, 400);
    }

    // Update status to approved
    const updated = await this.certificateRepository.update(certificateId, {
      status: 'APPROVED',
      reviewedBy: approvedBy,
      reviewedAt: new Date(),
    });

    // Anchor to blockchain (async - don't wait)
    this.anchorToBlockchain(certificateId).catch(error => {
      logger.error('Background blockchain anchoring failed', {
        certificateId,
        error: error.message,
      });
    });

    // Notify farmer
    await this.notifyFarmer(certificate.farmerId, certificate, 'approved');

    // Increment export company certificate count for billing
    await this.incrementBillingCount(certificate.exportCompanyId);

    logger.info('Certificate approved', {
      certificateId,
      certificateNumber: certificate.certificateNumber,
      approvedBy,
    });

    return updated;
  }

  /**
   * Reject certificate with reason
   */
  async rejectCertificate(
    certificateId: string,
    reason: string,
    rejectedBy: string,
  ): Promise<OrganicCertificate> {
    const certificate = await this.certificateRepository.findById(certificateId);

    if (!certificate) {
      throw new AppError('Certificate not found', 404);
    }

    if (certificate.status !== 'PENDING_REVIEW') {
      throw new AppError(`Cannot reject certificate with status: ${certificate.status}`, 400);
    }

    const updated = await this.certificateRepository.update(certificateId, {
      status: 'REJECTED',
      reviewedBy: rejectedBy,
      reviewedAt: new Date(),
      rejectionReason: reason,
    });

    // Notify farmer
    await this.notifyFarmer(certificate.farmerId, certificate, 'rejected', reason);

    logger.info('Certificate rejected', {
      certificateId,
      certificateNumber: certificate.certificateNumber,
      rejectedBy,
      reason,
    });

    return updated;
  }

  /**
   * Verify certificate for public API
   */
  async verifyCertificate(certificateNumber: string): Promise<VerificationResult> {
    const certificate = await this.certificateRepository.findByCertificateNumber(certificateNumber);

    if (!certificate) {
      return {
        valid: false,
        exists: false,
        message: 'Certificate not found',
      };
    }

    // Check expiry
    const now = new Date();
    const isExpired = certificate.validTo < now;

    // Check revocation
    const isRevoked = certificate.status === 'REVOKED';

    // Check if approved
    const isApproved = certificate.status === 'APPROVED';

    // Verify hash if blockchain data exists
    let blockchainVerified = false;
    if (certificate.contentHash && certificate.payloadSnapshot) {
      const computedHash = this.computeHash(certificate.payloadSnapshot);
      blockchainVerified = computedHash === certificate.contentHash;
    }

    const valid = isApproved && !isExpired && !isRevoked;

    // Increment view count
    await this.certificateRepository.incrementViewCount(certificate.id);

    return {
      valid,
      exists: true,
      certificate: this.sanitizeCertificateForPublic(certificate),
      status: certificate.status,
      isExpired,
      isRevoked,
      blockchainVerified,
      blockchain: certificate.blockchainTxHash ? {
        network: certificate.blockchainNetwork || 'polygon',
        txHash: certificate.blockchainTxHash,
        explorerUrl: `https://polygonscan.com/tx/${certificate.blockchainTxHash}`,
        timestamp: certificate.blockchainTimestamp,
      } : null,
      ipfs: certificate.ipfsHash ? {
        cid: certificate.ipfsHash,
        gatewayUrl: `https://gateway.pinata.cloud/ipfs/${certificate.ipfsHash}`,
      } : null,
    };
  }

  // Helper methods

  private computeHash(payload: string): string {
    return createHash('sha256').update(payload).digest('hex');
  }

  private getStandardName(standard: CertificationType): string {
    const names: Record<string, string> = {
      ORGANIC_USDA: 'USDA Organic',
      ORGANIC_EU: 'EU Organic',
      SENASICA: 'SENASICA Orgánico',
    };
    return names[standard] || standard;
  }

  private sanitizeCertificateForPublic(certificate: any): PublicCertificateData {
    // Remove sensitive data, keep only public info
    const payload = JSON.parse(certificate.payloadSnapshot || '{}');

    return {
      certificateNumber: certificate.certificateNumber,
      farmerName: this.maskName(payload.farmer?.name || 'Unknown'),
      location: payload.farmer?.location || 'Mexico',
      cropType: certificate.cropType,
      variety: certificate.variety,
      certificationStandard: certificate.certificationStandard,
      standardName: this.getStandardName(certificate.certificationStandard),
      harvestDate: certificate.harvestDate,
      validFrom: certificate.validFrom,
      validTo: certificate.validTo,
      inspectionSummary: payload.inspectionSummary,
      viewCount: certificate.viewCount,
      lastViewedAt: certificate.lastViewedAt,
    };
  }

  private maskName(name: string): string {
    // "Miguel García" -> "Miguel G."
    const parts = name.trim().split(' ');
    if (parts.length > 1) {
      return `${parts[0]} ${parts[1][0]}.`;
    }
    return parts[0];
  }

  private async notifyFarmer(
    farmerId: string,
    certificate: any,
    status: 'approved' | 'rejected',
    reason?: string,
  ): Promise<void> {
    // Implementation: Send email/push notification to farmer
  }

  private async notifyExportCompany(
    exportCompanyId: string,
    certificate: any,
  ): Promise<void> {
    // Implementation: Send email to export company admin
  }

  private async incrementBillingCount(exportCompanyId: string): Promise<void> {
    // Implementation: Increment monthly certificate count for billing
  }
}
```

---

## 5. PDF TEMPLATE SPECIFICATION

### 5.1 Visual Layout

```
┌─────────────────────────────────────────────────────────────┐
│ ┌─────────┐                                 ┌─────────────┐ │
│ │AGROBRIDGE│                                │ USDA ORGANIC│ │
│ │  LOGO   │                                 │    LOGO     │ │
│ └─────────┘                                 └─────────────┘ │
│                                                             │
│                   ORGANIC CERTIFICATE                       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Certificate Number                      │   │
│  │          AGB-MX-2025-001234                          │   │
│  │    ┌──────────┐                                     │   │
│  │    │ QR CODE  │  Scan to verify authenticity         │   │
│  │    │          │  verify.agrobridge.io/AGB-MX-2025... │   │
│  │    └──────────┘                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ PRODUCER INFORMATION                                 │   │
│  │ ──────────────────────────────────────────────────── │   │
│  │ Name:          Miguel García                         │   │
│  │ Location:      Tancítaro, Michoacán, Mexico          │   │
│  │ Total Area:    50 hectares                           │   │
│  │ Organic Since: January 2020                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ CERTIFICATION DETAILS                                │   │
│  │ ──────────────────────────────────────────────────── │   │
│  │ Standard:      USDA Organic                          │   │
│  │ Crop:          Hass Avocado                          │   │
│  │ Harvest Date:  February 15, 2025                     │   │
│  │ Valid From:    January 15, 2025                      │   │
│  │ Valid Until:   January 15, 2026                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ VERIFICATION SUMMARY                                 │   │
│  │ ──────────────────────────────────────────────────── │   │
│  │ ✓ 12 field inspections in last 90 days              │   │
│  │ ✓ 156 photos with GPS verification                  │   │
│  │ ✓ 8 organic inputs verified                         │   │
│  │ ✓ 100% photos within declared field boundaries      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ BLOCKCHAIN VERIFICATION                              │   │
│  │ ──────────────────────────────────────────────────── │   │
│  │ Network:    Polygon                                  │   │
│  │ TX Hash:    0x7f3a...8c2d                            │   │
│  │ Timestamp:  January 15, 2025 10:45:23 UTC            │   │
│  │ IPFS CID:   QmX7Y8Z...                               │   │
│  │                                                     │   │
│  │ View on Explorer: polygonscan.com/tx/0x7f3a...      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│ Verified by AgroBridge • ISO 9001 • Powered by Polygon     │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Color Scheme

```css
Primary Green: #22C55E (Organic/nature)
Dark Text: #1F2937
Light Gray: #F3F4F6
Border Gray: #E5E7EB
Accent Blue: #3B82F6 (links)
```

---

## 6. ERROR HANDLING

### 6.1 Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INSUFFICIENT_INSPECTIONS` | 400 | Not enough inspections in time window |
| `NO_ORGANIC_INPUTS` | 400 | No verified organic input receipts |
| `GPS_VERIFICATION_FAILED` | 400 | Photos outside field boundary |
| `INSUFFICIENT_PHOTOS` | 400 | Not enough photos uploaded |
| `FIELD_NOT_FOUND` | 404 | One or more fields don't exist |
| `FIELD_NOT_OWNED` | 403 | Field belongs to different farmer |
| `COMPANY_SUSPENDED` | 403 | Export company account suspended |
| `CERTIFICATE_NOT_FOUND` | 404 | Certificate doesn't exist |
| `INVALID_STATUS_TRANSITION` | 400 | Cannot transition to requested status |
| `BLOCKCHAIN_ANCHOR_FAILED` | 500 | Blockchain transaction failed |
| `IPFS_UPLOAD_FAILED` | 500 | IPFS upload failed |
| `PDF_GENERATION_FAILED` | 500 | PDF generation failed |

### 6.2 Retry Strategy

```typescript
// Blockchain anchoring retry
const BLOCKCHAIN_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 2000,
  maxDelay: 30000,
  backoffMultiplier: 2,
};

// IPFS upload retry
const IPFS_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
};
```

---

## 7. TESTING STRATEGY

### 7.1 Unit Tests

```typescript
// tests/unit/organic-certificates/OrganicCertificateService.test.ts

describe('OrganicCertificateService', () => {
  describe('checkEligibility', () => {
    it('should return canIssue: true when all requirements met', async () => {});
    it('should return canIssue: false when insufficient inspections', async () => {});
    it('should return canIssue: false when no verified inputs', async () => {});
    it('should return canIssue: false when GPS verification rate too low', async () => {});
  });

  describe('generateCertificateNumber', () => {
    it('should generate sequential numbers within same year', async () => {});
    it('should reset sequence for new year', async () => {});
  });

  describe('buildPayload', () => {
    it('should include all required fields', async () => {});
    it('should aggregate inspection data correctly', async () => {});
  });

  describe('approveCertificate', () => {
    it('should update status to APPROVED', async () => {});
    it('should trigger blockchain anchoring', async () => {});
    it('should notify farmer', async () => {});
    it('should fail for non-PENDING_REVIEW certificates', async () => {});
  });
});
```

### 7.2 Integration Tests

```typescript
// tests/integration/organic-certification-flow.test.ts

describe('Organic Certification Flow', () => {
  it('should complete full certification flow', async () => {
    // 1. Create export company
    // 2. Invite farmer
    // 3. Farmer enrolls
    // 4. Create organic field
    // 5. Submit inspections
    // 6. Request certificate
    // 7. Approve certificate
    // 8. Verify certificate via public API
  });
});
```

---

*Specification created by Claude (Principal Backend Architect) on 2025-12-24*
