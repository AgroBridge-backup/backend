/**
 * Traceability 2.0 - Blockchain Quality Certificates
 * Use Case: Issue a new quality certificate
 */

import { QualityCertificateService, IssueCertificateResult } from '../../../domain/services/QualityCertificateService.js';
import { CertificateGrade } from '../../../domain/entities/QualityCertificate.js';

export interface IssueCertificateRequest {
  batchId: string;
  grade: CertificateGrade;
  certifyingBody: string;
  validityDays?: number;
  issuedBy: string;
}

export class IssueCertificateUseCase {
  constructor(private certificateService: QualityCertificateService) {}

  async execute(request: IssueCertificateRequest): Promise<IssueCertificateResult> {
    return this.certificateService.issueCertificate({
      batchId: request.batchId,
      grade: request.grade,
      certifyingBody: request.certifyingBody,
      validityDays: request.validityDays ?? 365, // Default 1 year validity
      issuedBy: request.issuedBy,
    });
  }
}
