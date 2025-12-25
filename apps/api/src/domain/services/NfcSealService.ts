/**
 * Traceability 2.0 - Tamper-Evident NFC Seals
 * Domain Service for NFC Seal Management
 *
 * @deprecated POST-MVP: NFC seal scanning not required for organic certification MVP.
 * This service will be reactivated after beta launch when we add
 * physical seal verification for export compliance.
 *
 * Errors: 28 TypeScript errors related to Prisma model mismatches
 * Estimated fix time: 2-3 hours (not worth it for MVP)
 */

import { PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError.js';
import logger from '../../shared/utils/logger.js';

// Stub types for API compatibility
export interface ProvisionSealResult {
  seal: any;
  publicKey: string;
}

export interface VerificationResult {
  seal: any;
  verification: any;
  isValid: boolean;
  tamperIndicator: string;
  integrityScore: number;
  nextChallenge: string;
}

export interface SealIntegritySummary {
  sealId: string;
  serialNumber: string;
  status: string;
  integrityScore: number;
  verificationCount: number;
  lastVerification: Date | null;
  tamperIndicator: string;
}

/**
 * @deprecated POST-MVP - NFC Seal Service stub implementation
 * All methods throw "not available" error until feature is reactivated
 */
export class NfcSealService {
  constructor(
    private prisma: PrismaClient,
    private sealRepository?: any,
    masterKey?: string
  ) {
    logger.info('[NfcSealService] Stub service initialized - NFC features disabled for MVP');
  }

  private throwMvpError(): never {
    throw new AppError(
      'NFC seal scanning not available in MVP. This feature will be available after beta launch.',
      501 // Not Implemented
    );
  }

  /**
   * @deprecated POST-MVP
   */
  async provisionSeal(input: any): Promise<ProvisionSealResult> {
    this.throwMvpError();
  }

  /**
   * @deprecated POST-MVP
   */
  async attachToContainer(input: any): Promise<any> {
    this.throwMvpError();
  }

  /**
   * @deprecated POST-MVP
   */
  async verify(input: any): Promise<VerificationResult> {
    this.throwMvpError();
  }

  /**
   * @deprecated POST-MVP
   */
  async remove(input: any): Promise<any> {
    this.throwMvpError();
  }

  /**
   * @deprecated POST-MVP
   */
  async getSealHistory(sealId: string): Promise<any[]> {
    this.throwMvpError();
  }

  /**
   * @deprecated POST-MVP
   */
  async getSealsByBatch(batchId: string): Promise<any[]> {
    this.throwMvpError();
  }

  /**
   * @deprecated POST-MVP
   */
  async getIntegritySummary(sealId: string): Promise<SealIntegritySummary> {
    this.throwMvpError();
  }

  /**
   * @deprecated POST-MVP
   */
  async getBatchSealsSummary(batchId: string): Promise<SealIntegritySummary[]> {
    this.throwMvpError();
  }
}
