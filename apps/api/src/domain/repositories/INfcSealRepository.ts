/**
 * Traceability 2.0 - Tamper-Evident NFC Seals
 * Repository Interface
 */

import {
  NfcSeal,
  NfcSealVerification,
  NfcSealStatus,
  CreateNfcSealInput,
} from '../entities/NfcSeal.js';

export interface INfcSealRepository {
  /**
   * Find a seal by ID
   */
  findById(id: string): Promise<NfcSeal | null>;

  /**
   * Find a seal by serial number
   */
  findBySerialNumber(serialNumber: string): Promise<NfcSeal | null>;

  /**
   * Find seals by batch ID
   */
  findByBatchId(batchId: string): Promise<NfcSeal[]>;

  /**
   * Find seals by status
   */
  findByStatus(status: NfcSealStatus): Promise<NfcSeal[]>;

  /**
   * Find available (provisioned) seals
   */
  findAvailable(): Promise<NfcSeal[]>;

  /**
   * Create a new seal
   */
  create(input: CreateNfcSealInput & {
    publicKey: string;
    encryptedPrivateKey: string;
    challenge: string;
  }): Promise<NfcSeal>;

  /**
   * Update a seal
   */
  update(id: string, data: Partial<NfcSeal>): Promise<NfcSeal>;

  /**
   * Create a verification record
   */
  createVerification(data: Omit<NfcSealVerification, 'id'>): Promise<NfcSealVerification>;

  /**
   * Get verifications for a seal
   */
  getVerifications(sealId: string): Promise<NfcSealVerification[]>;

  /**
   * Get latest verification for a seal
   */
  getLatestVerification(sealId: string): Promise<NfcSealVerification | null>;

  /**
   * Count seals by status
   */
  countByStatus(): Promise<Record<NfcSealStatus, number>>;

  /**
   * Find expired seals that need status update
   */
  findExpiredSeals(): Promise<NfcSeal[]>;

  /**
   * Bulk update seal status
   */
  bulkUpdateStatus(ids: string[], status: NfcSealStatus): Promise<number>;
}
