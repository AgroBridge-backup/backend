/**
 * Traceability 2.0 - Blockchain Quality Certificates
 * Use Case: Verify certificate authenticity and validity
 */

import { QualityCertificateService } from '../../../domain/services/QualityCertificateService.js';
import { QualityCertificate } from '../../../domain/entities/QualityCertificate.js';

export interface VerifyCertificateRequest {
  certificateId: string;
}

export interface VerifyCertificateResponse {
  isValid: boolean;
  certificate: QualityCertificate | null;
  computedHash: string | null;
  storedHash: string | null;
  isExpired: boolean;
  message: string;
}

export class VerifyCertificateUseCase {
  constructor(private certificateService: QualityCertificateService) {}

  async execute(request: VerifyCertificateRequest): Promise<VerifyCertificateResponse> {
    const result = await this.certificateService.verifyCertificate(request.certificateId);

    let message: string;
    if (!result.certificate) {
      message = 'Certificate not found';
    } else if (result.isExpired) {
      message = 'Certificate has expired';
    } else if (!result.isValid) {
      message = 'Certificate hash mismatch - data may have been tampered';
    } else {
      message = 'Certificate is valid and authentic';
    }

    return {
      ...result,
      message,
    };
  }
}
