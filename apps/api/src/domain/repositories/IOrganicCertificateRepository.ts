/**
 * OrganicCertificate Repository Interface
 * Defines the contract for organic certificate data access
 */

import {
  OrganicCertificate,
  OrganicCertificateStatus,
  CertificateFilter,
  CertificateVerification,
} from "../entities/OrganicCertificate.js";

/**
 * Create certificate data
 */
export interface CreateOrganicCertificateData {
  id?: string;
  certificateNumber: string;
  farmerId: string;
  exportCompanyId: string;
  fieldIds: string[];
  cropType: string;
  variety?: string;
  harvestDate?: Date;
  estimatedWeight?: number;
  certificationStandard: string;
  validFrom: Date;
  validTo: Date;
  status?: OrganicCertificateStatus;
  payloadSnapshot?: string;
  contentHash?: string;
}

/**
 * Update certificate data
 */
export interface UpdateOrganicCertificateData {
  status?: OrganicCertificateStatus;
  submittedAt?: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  rejectionReason?: string;
  pdfUrl?: string;
  qrCodeUrl?: string;
  qrCodeShortUrl?: string;
  contentHash?: string;
  blockchainTxHash?: string;
  blockchainNetwork?: string;
  blockchainTimestamp?: Date;
  ipfsHash?: string;
  payloadSnapshot?: string;
}

/**
 * Certificate list result
 */
export interface OrganicCertificateListResult {
  certificates: OrganicCertificate[];
  total: number;
}

/**
 * Create verification log data
 */
export interface CreateVerificationLogData {
  certificateId: string;
  verifierType?: string;
  country?: string;
  deviceType?: string;
  referrer?: string;
}

/**
 * Repository interface
 */
export interface IOrganicCertificateRepository {
  /**
   * Create a new organic certificate
   */
  create(data: CreateOrganicCertificateData): Promise<OrganicCertificate>;

  /**
   * Find certificate by ID
   */
  findById(id: string): Promise<OrganicCertificate | null>;

  /**
   * Find certificate by certificate number
   */
  findByCertificateNumber(
    certificateNumber: string,
  ): Promise<OrganicCertificate | null>;

  /**
   * Update certificate
   */
  update(
    id: string,
    data: UpdateOrganicCertificateData,
  ): Promise<OrganicCertificate>;

  /**
   * List certificates with filtering
   */
  list(filter: CertificateFilter): Promise<OrganicCertificateListResult>;

  /**
   * List certificates by farmer
   */
  listByFarmer(
    farmerId: string,
    filter?: Omit<CertificateFilter, "farmerId">,
  ): Promise<OrganicCertificateListResult>;

  /**
   * List certificates by export company
   */
  listByExportCompany(
    exportCompanyId: string,
    filter?: Omit<CertificateFilter, "exportCompanyId">,
  ): Promise<OrganicCertificateListResult>;

  /**
   * Get certificate with farmer and export company details
   */
  findByIdWithDetails(
    id: string,
  ): Promise<OrganicCertificateWithDetails | null>;

  /**
   * Get certificate by number with details (for public verification)
   */
  findByCertificateNumberWithDetails(
    certificateNumber: string,
  ): Promise<OrganicCertificateWithDetails | null>;

  /**
   * Check if farmer has pending certificate for fields
   */
  hasPendingCertificateForFields(
    farmerId: string,
    fieldIds: string[],
  ): Promise<boolean>;

  /**
   * Get next certificate sequence number for a given year
   */
  getNextSequenceNumber(year: number): Promise<number>;

  /**
   * Increment view count
   */
  incrementViewCount(id: string): Promise<void>;

  /**
   * Log verification (QR scan)
   */
  logVerification(
    data: CreateVerificationLogData,
  ): Promise<CertificateVerification>;

  /**
   * Get verification count for certificate
   */
  getVerificationCount(certificateId: string): Promise<number>;

  /**
   * Get last verification date for certificate
   */
  getLastVerificationDate(certificateId: string): Promise<Date | null>;

  /**
   * Count certificates by status
   */
  countByStatus(status: OrganicCertificateStatus): Promise<number>;

  /**
   * Count certificates by farmer
   */
  countByFarmer(farmerId: string): Promise<number>;

  /**
   * Count certificates by export company
   */
  countByExportCompany(exportCompanyId: string): Promise<number>;

  /**
   * Get certificates pending review for export company
   */
  getPendingReviewForExportCompany(
    exportCompanyId: string,
  ): Promise<OrganicCertificate[]>;

  /**
   * Get certificates with blockchain failed status (for retry)
   */
  getBlockchainFailedCertificates(): Promise<OrganicCertificate[]>;
}

/**
 * Certificate with related entities
 */
export interface OrganicCertificateWithDetails extends OrganicCertificate {
  farmer: {
    id: string;
    businessName: string;
    municipality: string;
    state: string;
  };
  exportCompany: {
    id: string;
    name: string;
    country: string;
    logoUrl?: string | null;
  };
}
