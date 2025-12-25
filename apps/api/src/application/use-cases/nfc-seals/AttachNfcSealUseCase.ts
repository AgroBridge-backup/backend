/**
 * Traceability 2.0 - Tamper-Evident NFC Seals
 * Use Case: Attach NFC Seal to Batch
 *
 * @deprecated POST-MVP: NFC seal features not required for MVP
 */

import { NfcSealService } from '../../../domain/services/NfcSealService.js';
import { AppError } from '../../../shared/errors/AppError.js';

export interface AttachNfcSealDTO {
  sealId: string;
  batchId: string;
  attachedBy: string;
  location?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * @deprecated POST-MVP
 */
export class AttachNfcSealUseCase {
  constructor(private sealService: NfcSealService) {}

  async execute(input: AttachNfcSealDTO): Promise<any> {
    if (!input.sealId) {
      throw new AppError('Seal ID is required', 400);
    }

    if (!input.batchId) {
      throw new AppError('Batch ID is required', 400);
    }

    return this.sealService.attachToContainer(input);
  }
}
