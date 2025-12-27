/**
 * Traceability 2.0 - Blockchain Quality Certificates
 * Repository Interface for QualityCertificate
 */

import {
  QualityCertificate,
  CreateCertificateInput,
  CertificateGrade,
} from "../entities/QualityCertificate.js";

export interface IQualityCertificateRepository {
  /**
   * Find a certificate by ID
   */
  findById(id: string): Promise<QualityCertificate | null>;

  /**
   * Find all certificates for a batch
   */
  findByBatchId(batchId: string): Promise<QualityCertificate[]>;

  /**
   * Find certificates by certifying body
   */
  findByCertifyingBody(certifyingBody: string): Promise<QualityCertificate[]>;

  /**
   * Find valid certificates (not expired)
   */
  findValidCertificates(batchId: string): Promise<QualityCertificate[]>;

  /**
   * Create a new certificate
   */
  create(
    input: CreateCertificateInput & {
      hashOnChain?: string;
      pdfUrl?: string;
      payloadSnapshot?: string;
    },
  ): Promise<QualityCertificate>;

  /**
   * Update certificate with blockchain hash
   */
  updateHash(id: string, hashOnChain: string): Promise<QualityCertificate>;

  /**
   * Update certificate with PDF URL
   */
  updatePdfUrl(id: string, pdfUrl: string): Promise<QualityCertificate>;

  /**
   * Count certificates by batch
   */
  countByBatch(batchId: string): Promise<number>;

  /**
   * Check if batch has a valid certificate of a specific grade
   */
  hasValidCertificate(
    batchId: string,
    grade: CertificateGrade,
  ): Promise<boolean>;
}
