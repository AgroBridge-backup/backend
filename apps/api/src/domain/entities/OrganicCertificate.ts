/**
 * OrganicCertificate Domain Entity
 * Blockchain-anchored organic certificates for Mexican agricultural exports
 * Revenue: $5-20/certificate + SaaS subscription
 */

/**
 * Certificate status workflow
 */
export enum OrganicCertificateStatus {
  DRAFT = "DRAFT", // Certificate created, not submitted
  PROCESSING = "PROCESSING", // PDF/blockchain generation in progress
  PENDING_REVIEW = "PENDING_REVIEW", // Submitted, awaiting export company review
  APPROVED = "APPROVED", // Export company approved, blockchain anchored
  REJECTED = "REJECTED", // Export company rejected
  REVOKED = "REVOKED", // Certificate revoked post-approval
  BLOCKCHAIN_FAILED = "BLOCKCHAIN_FAILED", // Blockchain anchoring failed (retryable)
}

/**
 * Certification standards supported
 */
export enum CertificationStandard {
  USDA_ORGANIC = "ORGANIC_USDA", // US market - 60% of exports
  EU_ORGANIC = "ORGANIC_EU", // EU Regulation 2018/848
  SENASICA = "SENASICA", // Mexico domestic + LATAM
}

/**
 * Crop types for Mexican export (primary revenue crops)
 */
export enum CropType {
  AVOCADO = "AVOCADO", // Hass avocados - Michoacán
  BLUEBERRY = "BLUEBERRY", // Berries - Jalisco
  RASPBERRY = "RASPBERRY", // Berries - Jalisco
  STRAWBERRY = "STRAWBERRY", // Berries - Baja California
  BLACKBERRY = "BLACKBERRY", // Berries
  OTHER = "OTHER",
}

/**
 * Blockchain networks supported
 */
export enum BlockchainNetwork {
  POLYGON = "POLYGON", // Primary - low gas fees
  BASE = "BASE", // Coinbase L2 - backup
  ETHEREUM = "ETHEREUM", // Mainnet - high-value certs
}

/**
 * Minimum inspection requirements for certificate generation
 */
export const CERTIFICATE_REQUIREMENTS = {
  minInspections: 4, // At least 4 field inspections in last 90 days
  minPhotos: 12, // At least 12 photos across all inspections
  minOrganicInputs: 3, // At least 3 verified organic inputs
  inspectionWindowDays: 90, // Inspections must be within this window
  certificateValidityDays: 365, // Certificate valid for 1 year
} as const;

/**
 * OrganicCertificate entity
 */
export interface OrganicCertificate {
  id: string;
  certificateNumber: string; // Format: AGB-MX-2025-001234

  // Parties
  farmerId: string;
  exportCompanyId: string;

  // Fields covered
  fieldIds: string[];

  // Crop information
  cropType: CropType | string;
  variety?: string | null;
  harvestDate?: Date | null;
  estimatedWeight?: number | null; // kg

  // Certification
  certificationStandard: CertificationStandard | string;

  // Validity period
  validFrom: Date;
  validTo: Date;

  // Status
  status: OrganicCertificateStatus;

  // Review process
  submittedAt?: Date | null;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  rejectionReason?: string | null;

  // Generated assets
  pdfUrl?: string | null;
  qrCodeUrl?: string | null;
  qrCodeShortUrl?: string | null;

  // Blockchain anchoring
  contentHash?: string | null; // SHA-256 of payload
  blockchainTxHash?: string | null;
  blockchainNetwork?: string | null;
  blockchainTimestamp?: Date | null;

  // IPFS storage
  ipfsHash?: string | null;

  // Payload snapshot for verification
  payloadSnapshot?: string | null;

  // Analytics
  viewCount: number;
  lastViewedAt?: Date | null;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for creating a new certificate
 */
export interface CreateOrganicCertificateInput {
  farmerId: string;
  exportCompanyId: string;
  fieldIds: string[];
  cropType: CropType | string;
  variety?: string;
  harvestDate?: Date;
  estimatedWeight?: number;
  certificationStandard: CertificationStandard | string;
  notes?: string;
}

/**
 * Certificate generation request (from API)
 */
export interface CertificateGenerationRequest {
  farmerId: string;
  fieldIds: string[];
  cropType: CropType | string;
  harvestDate?: Date;
  certificationStandard: CertificationStandard | string;
  notes?: string;
}

/**
 * Aggregated field data for certificate generation
 */
export interface AggregatedFieldData {
  fields: Array<{
    id: string;
    name: string;
    hectares: number;
    cropType: string;
    certificationStatus: string;
    gpsCoordinates: {
      centerLat: number;
      centerLng: number;
      boundaryGeoJson: string;
    };
  }>;

  inspections: Array<{
    id: string;
    fieldId: string;
    inspectorName: string;
    inspectionDate: Date;
    inspectionType: string;
    isVerified: boolean;
    gpsVerified: boolean;
    photosCount: number;
    organicInputsCount: number;
    activitiesCount: number;
  }>;

  organicInputs: Array<{
    id: string;
    productName: string;
    inputType: string;
    isOmriListed: boolean;
    isOrganicApproved: boolean;
    verificationStatus: string;
    supplier?: string | null;
  }>;

  photos: Array<{
    id: string;
    inspectionId: string;
    imageUrl: string;
    thumbnailUrl?: string | null;
    capturedAt: Date;
    gpsLocation?: {
      lat: number;
      lng: number;
    } | null;
    withinFieldBoundary: boolean;
    caption?: string | null;
  }>;

  activities: Array<{
    id: string;
    activityType: string;
    activityDate: Date;
    description?: string | null;
  }>;

  summary: {
    totalFields: number;
    totalHectares: number;
    totalInspections: number;
    verifiedInspections: number;
    totalPhotos: number;
    totalOrganicInputs: number;
    verifiedOrganicInputs: number;
    totalActivities: number;
    dateRange: {
      start: Date;
      end: Date;
    };
  };
}

/**
 * Validation result for certificate generation
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  field: string;
  message: string;
  required?: number;
  actual?: number;
}

export interface ValidationWarning {
  code: string;
  field: string;
  message: string;
}

/**
 * Public certificate data (for QR verification)
 */
export interface PublicCertificateData {
  valid: boolean;
  certificateNumber: string;
  status: OrganicCertificateStatus;

  farmInfo: {
    farmerName: string;
    location: string;
    totalHectares: number;
    cropType: string;
  };

  certification: {
    standard: string;
    harvestDate?: Date | null;
    issuedDate: Date;
    expiryDate: Date;
  };

  blockchain?: {
    network: string;
    txHash: string;
    timestamp: Date;
    explorerUrl: string;
    verified: boolean;
  } | null;

  ipfs?: {
    cid: string;
    gatewayUrl: string;
  } | null;

  exportCompany: {
    name: string;
    country: string;
  };

  verificationStats: {
    totalVerifications: number;
    lastVerified?: Date | null;
  };
}

/**
 * Blockchain proof for certificate
 */
export interface BlockchainProof {
  certificateNumber: string;
  txHash: string;
  network: string;
  timestamp: Date;
  explorerUrl: string;
  isValid: boolean;
  contentHash: string;
}

/**
 * PDF template data
 */
export interface PdfTemplateData {
  // Header
  certificateNumber: string;
  issuedDate: Date;
  expiryDate: Date;
  qrCodeDataUrl: string; // Base64 QR code image

  // Farmer Info
  farmer: {
    name: string;
    location: string;
    totalHectares: number;
  };

  // Certification
  certificationStandard: CertificationStandard | string;
  cropType: string;
  harvestDate?: Date | null;

  // Field Inspection Summary
  inspectionSummary: {
    totalInspections: number;
    dateRange: { start: Date; end: Date };
    photosCount: number;
    organicInputsCount: number;
    activitiesCount: number;
  };

  // GPS Map (optional)
  fieldMapImageUrl?: string;

  // Blockchain Verification
  blockchain: {
    network: string;
    txHash: string;
    timestamp: Date;
    explorerUrl: string;
  };

  // Export Company
  exportCompany: {
    name: string;
    logo?: string;
  };

  // Sample photos (3-5)
  samplePhotos: Array<{
    url: string;
    caption?: string | null;
    timestamp: Date;
    gpsLocation?: { lat: number; lng: number } | null;
  }>;
}

/**
 * Certificate metadata for IPFS
 */
export interface CertificateIpfsMetadata {
  version: string;
  certificateNumber: string;
  issuedDate: string;
  expiryDate: string;

  farmer: {
    id: string;
    name: string;
    location: string;
  };

  fields: Array<{
    id: string;
    name: string;
    hectares: number;
    cropType: string;
    gpsCoordinates: {
      centerLat: number;
      centerLng: number;
    };
  }>;

  inspections: Array<{
    id: string;
    date: string;
    photosCount: number;
    organicInputsCount: number;
    verified: boolean;
  }>;

  organicInputs: Array<{
    name: string;
    type: string;
    supplier?: string | null;
    verified: boolean;
  }>;

  photos: Array<{
    url: string;
    timestamp: string;
    gpsLocation?: { lat: number; lng: number } | null;
  }>;

  blockchain: {
    txHash: string;
    network: string;
    timestamp: string;
  };

  certificationStandard: string;
  cropType: string;
  harvestDate?: string | null;
}

/**
 * Certificate verification log entry
 */
export interface CertificateVerification {
  id: string;
  certificateId: string;
  verifierType?: string | null;
  country?: string | null;
  deviceType?: string | null;
  referrer?: string | null;
  verifiedAt: Date;
}

/**
 * Filter for listing certificates
 */
export interface CertificateFilter {
  farmerId?: string;
  exportCompanyId?: string;
  status?: OrganicCertificateStatus;
  cropType?: CropType | string;
  certificationStandard?: CertificationStandard | string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * QR code content structure
 */
export interface QrCodeContent {
  certificateNumber: string;
  verificationUrl: string;
  issuedDate: string;
  farmer: string;
  cropType: string;
  blockchainTxHash?: string | null;
}

/**
 * View analytics data
 */
export interface ViewData {
  ipAddress?: string;
  userAgent?: string;
  country?: string;
  deviceType?: string;
  referrer?: string;
}

/**
 * Explorer URLs by network
 */
export const BLOCKCHAIN_EXPLORERS: Record<string, string> = {
  POLYGON: "https://polygonscan.com/tx/",
  BASE: "https://basescan.org/tx/",
  ETHEREUM: "https://etherscan.io/tx/",
};

/**
 * IPFS gateway URLs
 */
export const IPFS_GATEWAYS = {
  pinata: "https://gateway.pinata.cloud/ipfs/",
  cloudflare: "https://cloudflare-ipfs.com/ipfs/",
  ipfsio: "https://ipfs.io/ipfs/",
} as const;

/**
 * Certification standard display names
 */
export const CERTIFICATION_DISPLAY_NAMES: Record<string, string> = {
  ORGANIC_USDA: "USDA Organic",
  ORGANIC_EU: "EU Organic",
  SENASICA: "SENASICA Mexico",
};
