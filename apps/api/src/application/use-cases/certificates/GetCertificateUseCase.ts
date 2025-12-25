/**
 * Traceability 2.0 - Blockchain Quality Certificates
 * Use Case: Get certificate details
 */

import { QualityCertificateService } from '../../../domain/services/QualityCertificateService.js';
import { QualityCertificate } from '../../../domain/entities/QualityCertificate.js';
import { AppError } from '../../../shared/errors/AppError.js';

export interface GetCertificateRequest {
  certificateId: string;
}

export class GetCertificateUseCase {
  constructor(private certificateService: QualityCertificateService) {}

  async execute(request: GetCertificateRequest): Promise<QualityCertificate> {
    const certificate = await this.certificateService.getCertificate(request.certificateId);

    if (!certificate) {
      throw new AppError('Certificate not found', 404);
    }

    return certificate;
  }
}
