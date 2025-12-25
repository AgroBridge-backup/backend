/**
 * Traceability 2.0 - Tamper-Evident NFC Seals
 * Use Case: Verify NFC Seal
 *
 * @deprecated POST-MVP: NFC seal features not required for MVP
 */

import { NfcSealService, VerificationResult } from '../../../domain/services/NfcSealService.js';
import { AppError } from '../../../shared/errors/AppError.js';

export interface VerifyNfcSealDTO {
  serialNumber: string;
  signature: string;
  readCounter: number;
  verifiedBy: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  deviceInfo?: string;
}

/**
 * @deprecated POST-MVP
 */
export class VerifyNfcSealUseCase {
  constructor(private sealService: NfcSealService) {}

  async execute(input: VerifyNfcSealDTO): Promise<VerificationResult> {
    if (!input.serialNumber) {
      throw new AppError('Serial number is required', 400);
    }

    if (!input.signature) {
      throw new AppError('Signature is required', 400);
    }

    return this.sealService.verify(input);
  }
}
