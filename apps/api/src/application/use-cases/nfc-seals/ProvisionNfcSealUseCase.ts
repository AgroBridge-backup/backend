/**
 * Traceability 2.0 - Tamper-Evident NFC Seals
 * Use Case: Provision NFC Seal
 */

import { NfcSealService, ProvisionSealResult } from '../../../domain/services/NfcSealService.js';
import { AppError } from '../../../shared/errors/AppError.js';

export interface ProvisionNfcSealDTO {
  serialNumber: string;
  expiresAt?: Date;
}

export class ProvisionNfcSealUseCase {
  constructor(private sealService: NfcSealService) {}

  async execute(input: ProvisionNfcSealDTO): Promise<ProvisionSealResult> {
    if (!input.serialNumber || input.serialNumber.trim() === '') {
      throw new AppError('Serial number is required', 400);
    }

    // Validate expiration date if provided
    if (input.expiresAt && input.expiresAt < new Date()) {
      throw new AppError('Expiration date cannot be in the past', 400);
    }

    return this.sealService.provisionSeal({
      serialNumber: input.serialNumber.trim().toUpperCase(),
      expiresAt: input.expiresAt,
    });
  }
}
