/**
 * Organic Certificate Use Cases
 * Application layer for organic certificate operations
 */

import { OrganicCertificateService } from "../../../domain/services/OrganicCertificateService.js";
import {
  OrganicCertificate,
  OrganicCertificateStatus,
  CertificateGenerationRequest,
  PublicCertificateData,
  BlockchainProof,
  CertificateFilter,
  CropType,
  CertificationStandard,
  ViewData,
} from "../../../domain/entities/OrganicCertificate.js";
import { OrganicCertificateWithDetails } from "../../../domain/repositories/IOrganicCertificateRepository.js";

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE CERTIFICATE USE CASE (Primary Workflow)
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateCertificateInput {
  farmerId: string;
  fieldIds: string[];
  cropType: CropType | string;
  harvestDate?: Date;
  certificationStandard: CertificationStandard | string;
  notes?: string;
}

export interface CreateCertificateOutput {
  certificate: OrganicCertificate;
  message: string;
}

export class CreateCertificateUseCase {
  constructor(private readonly service: OrganicCertificateService) {}

  async execute(
    input: CreateCertificateInput,
  ): Promise<CreateCertificateOutput> {
    const request: CertificateGenerationRequest = {
      farmerId: input.farmerId,
      fieldIds: input.fieldIds,
      cropType: input.cropType,
      harvestDate: input.harvestDate,
      certificationStandard: input.certificationStandard,
      notes: input.notes,
    };

    const certificate = await this.service.generateCertificate(request);

    return {
      certificate,
      message:
        "Certificate generation in progress. You will be notified when ready.",
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET CERTIFICATE USE CASE
// ═══════════════════════════════════════════════════════════════════════════════

export interface GetCertificateInput {
  certificateId: string;
  includeDetails?: boolean;
}

export interface GetCertificateOutput {
  certificate: OrganicCertificate | OrganicCertificateWithDetails;
}

export class GetCertificateUseCase {
  constructor(private readonly service: OrganicCertificateService) {}

  async execute(input: GetCertificateInput): Promise<GetCertificateOutput> {
    const certificate = input.includeDetails
      ? await this.service.getCertificateWithDetails(input.certificateId)
      : await this.service.getCertificate(input.certificateId);

    return { certificate };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIST CERTIFICATES USE CASE
// ═══════════════════════════════════════════════════════════════════════════════

export interface ListCertificatesInput {
  farmerId?: string;
  exportCompanyId?: string;
  status?: OrganicCertificateStatus;
  cropType?: CropType | string;
  certificationStandard?: CertificationStandard | string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

export interface ListCertificatesOutput {
  certificates: OrganicCertificate[];
  total: number;
  limit: number;
  offset: number;
}

export class ListCertificatesUseCase {
  constructor(private readonly service: OrganicCertificateService) {}

  async execute(input: ListCertificatesInput): Promise<ListCertificatesOutput> {
    const filter: CertificateFilter = {
      farmerId: input.farmerId,
      exportCompanyId: input.exportCompanyId,
      status: input.status,
      cropType: input.cropType,
      certificationStandard: input.certificationStandard,
      fromDate: input.fromDate,
      toDate: input.toDate,
      limit: input.limit || 50,
      offset: input.offset || 0,
    };

    return this.service.listCertificates(filter);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// APPROVE CERTIFICATE USE CASE
// ═══════════════════════════════════════════════════════════════════════════════

export interface ApproveCertificateInput {
  certificateId: string;
  reviewerId: string;
}

export interface ApproveCertificateOutput {
  certificate: OrganicCertificate;
  message: string;
}

export class ApproveCertificateUseCase {
  constructor(private readonly service: OrganicCertificateService) {}

  async execute(
    input: ApproveCertificateInput,
  ): Promise<ApproveCertificateOutput> {
    const certificate = await this.service.approveCertificate(
      input.certificateId,
      input.reviewerId,
    );

    return {
      certificate,
      message: "Certificate approved successfully",
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REJECT CERTIFICATE USE CASE
// ═══════════════════════════════════════════════════════════════════════════════

export interface RejectCertificateInput {
  certificateId: string;
  reviewerId: string;
  reason: string;
}

export interface RejectCertificateOutput {
  certificate: OrganicCertificate;
  message: string;
}

export class RejectCertificateUseCase {
  constructor(private readonly service: OrganicCertificateService) {}

  async execute(
    input: RejectCertificateInput,
  ): Promise<RejectCertificateOutput> {
    const certificate = await this.service.rejectCertificate(
      input.certificateId,
      input.reviewerId,
      input.reason,
    );

    return {
      certificate,
      message: `Certificate rejected: ${input.reason}`,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REVOKE CERTIFICATE USE CASE
// ═══════════════════════════════════════════════════════════════════════════════

export interface RevokeCertificateInput {
  certificateId: string;
  reason: string;
}

export interface RevokeCertificateOutput {
  certificate: OrganicCertificate;
  message: string;
}

export class RevokeCertificateUseCase {
  constructor(private readonly service: OrganicCertificateService) {}

  async execute(
    input: RevokeCertificateInput,
  ): Promise<RevokeCertificateOutput> {
    const certificate = await this.service.revokeCertificate(
      input.certificateId,
      input.reason,
    );

    return {
      certificate,
      message: "Certificate revoked",
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFY CERTIFICATE USE CASE (Public - No Auth)
// ═══════════════════════════════════════════════════════════════════════════════

export interface VerifyCertificateInput {
  certificateNumber: string;
  viewData?: ViewData;
}

export interface VerifyCertificateOutput extends PublicCertificateData {}

export class VerifyCertificateUseCase {
  constructor(private readonly service: OrganicCertificateService) {}

  async execute(
    input: VerifyCertificateInput,
  ): Promise<VerifyCertificateOutput> {
    return this.service.verifyCertificateByCertNumber(
      input.certificateNumber,
      input.viewData,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET BLOCKCHAIN PROOF USE CASE (Public - No Auth)
// ═══════════════════════════════════════════════════════════════════════════════

export interface GetBlockchainProofInput {
  certificateNumber: string;
}

export interface GetBlockchainProofOutput extends BlockchainProof {}

export class GetBlockchainProofUseCase {
  constructor(private readonly service: OrganicCertificateService) {}

  async execute(
    input: GetBlockchainProofInput,
  ): Promise<GetBlockchainProofOutput> {
    return this.service.verifyBlockchainProof(input.certificateNumber);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOWNLOAD CERTIFICATE PDF USE CASE
// ═══════════════════════════════════════════════════════════════════════════════

export interface DownloadCertificatePdfInput {
  certificateId: string;
}

export interface DownloadCertificatePdfOutput {
  pdfUrl: string;
  certificateNumber: string;
}

export class DownloadCertificatePdfUseCase {
  constructor(private readonly service: OrganicCertificateService) {}

  async execute(
    input: DownloadCertificatePdfInput,
  ): Promise<DownloadCertificatePdfOutput> {
    const certificate = await this.service.getCertificate(input.certificateId);

    if (!certificate.pdfUrl) {
      throw new Error("PDF not yet generated for this certificate");
    }

    return {
      pdfUrl: certificate.pdfUrl,
      certificateNumber: certificate.certificateNumber,
    };
  }
}
