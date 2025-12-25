/**
 * Traceability 2.0 - Blockchain Quality Certificates
 * Use Case: List certificates for a batch
 */

import { QualityCertificateService } from '../../../domain/services/QualityCertificateService.js';
import { QualityCertificate } from '../../../domain/entities/QualityCertificate.js';

export interface ListBatchCertificatesRequest {
  batchId: string;
  validOnly?: boolean;
}

export class ListBatchCertificatesUseCase {
  constructor(private certificateService: QualityCertificateService) {}

  async execute(request: ListBatchCertificatesRequest): Promise<QualityCertificate[]> {
    if (request.validOnly) {
      return this.certificateService.getValidCertificates(request.batchId);
    }
    return this.certificateService.getBatchCertificates(request.batchId);
  }
}
