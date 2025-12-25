/**
 * Prisma NFC Seal Repository
 *
 * @deprecated POST-MVP: NFC seal features not required for organic certification MVP.
 * This repository will be reactivated after beta launch.
 *
 * Errors: 8 TypeScript errors related to Prisma model field mismatches
 * Estimated fix time: 1 hour (not worth it for MVP)
 */

import { PrismaClient } from '@prisma/client';
import { AppError } from '../../../../shared/errors/AppError.js';
import logger from '../../../../shared/utils/logger.js';

// Re-export interface type for compatibility
export { INfcSealRepository } from '../../../../domain/repositories/INfcSealRepository.js';

/**
 * @deprecated POST-MVP - Stub repository implementation
 */
export class PrismaNfcSealRepository {
  constructor(private prisma: PrismaClient) {
    logger.info('[PrismaNfcSealRepository] Stub repository initialized - NFC features disabled for MVP');
  }

  private throwMvpError(): never {
    throw new AppError(
      'NFC seal features not available in MVP. This feature will be available after beta launch.',
      501
    );
  }

  async create(input: any): Promise<any> {
    this.throwMvpError();
  }

  async findById(id: string): Promise<any> {
    this.throwMvpError();
  }

  async findBySerialNumber(serialNumber: string): Promise<any> {
    this.throwMvpError();
  }

  async findByBatchId(batchId: string): Promise<any[]> {
    this.throwMvpError();
  }

  async findAvailableSeals(limit: number): Promise<any[]> {
    this.throwMvpError();
  }

  async update(id: string, data: any): Promise<any> {
    this.throwMvpError();
  }

  async createVerification(input: any): Promise<any> {
    this.throwMvpError();
  }

  async findVerificationsBySealId(sealId: string): Promise<any[]> {
    this.throwMvpError();
  }

  async findExpiringSeals(daysFromNow: number): Promise<any[]> {
    this.throwMvpError();
  }
}
