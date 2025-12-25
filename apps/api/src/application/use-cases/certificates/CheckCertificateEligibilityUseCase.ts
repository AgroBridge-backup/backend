/**
 * Traceability 2.0 - Blockchain Quality Certificates
 * Use Case: Check if a batch is eligible for a specific certificate grade
 */

import { QualityCertificateService } from '../../../domain/services/QualityCertificateService.js';
import { CertificateGrade } from '../../../domain/entities/QualityCertificate.js';

export interface CheckCertificateEligibilityRequest {
  batchId: string;
  grade: CertificateGrade;
}

export interface CheckCertificateEligibilityResponse {
  canIssue: boolean;
  missingStages: string[];
  message: string;
}

export class CheckCertificateEligibilityUseCase {
  constructor(private certificateService: QualityCertificateService) {}

  async execute(request: CheckCertificateEligibilityRequest): Promise<CheckCertificateEligibilityResponse> {
    return this.certificateService.canIssueCertificate(request.batchId, request.grade);
  }
}
