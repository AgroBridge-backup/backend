/**
 * Traceability 2.0 - Blockchain Quality Certificates
 * Domain Entity for QualityCertificate
 */

export enum CertificateGrade {
  STANDARD = "STANDARD",
  PREMIUM = "PREMIUM",
  EXPORT = "EXPORT",
  ORGANIC = "ORGANIC",
}

export interface QualityCertificate {
  id: string;
  batchId: string;
  grade: CertificateGrade;
  certifyingBody: string;
  validFrom: Date;
  validTo: Date;
  hashOnChain: string | null;
  pdfUrl: string | null;
  issuedAt: Date;
  issuedBy: string;
  payloadSnapshot: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCertificateInput {
  batchId: string;
  grade: CertificateGrade;
  certifyingBody: string;
  validFrom: Date;
  validTo: Date;
  issuedBy: string;
}

export interface CertificatePayload {
  certificateId: string;
  batchId: string;
  batchCode: string;
  grade: CertificateGrade;
  certifyingBody: string;
  validFrom: string;
  validTo: string;
  issuedAt: string;
  issuedBy: string;
  // Batch information
  batch: {
    producerId: string | null;
    cropType: string | null;
    variety: string | null;
    quantity: number | null;
    harvestDate: string | null;
    origin: string | null;
  };
  // Verification stages summary
  stages: Array<{
    stageType: string;
    status: string;
    actorId: string;
    timestamp: string;
    location: string | null;
  }>;
  // NFC seal status (if available)
  nfcSeals?: Array<{
    uid: string;
    status: string;
    lastVerifiedAt: string | null;
  }>;
  // Temperature readings summary (if available)
  temperatureSummary?: {
    count: number;
    minValue: number;
    maxValue: number;
    avgValue: number;
    outOfRangeCount: number;
  };
  // Metadata
  version: string;
  generatedAt: string;
}

/**
 * Certificate grade display information
 */
export const CERTIFICATE_GRADE_INFO: Record<
  CertificateGrade,
  {
    displayName: string;
    description: string;
    color: string;
  }
> = {
  [CertificateGrade.STANDARD]: {
    displayName: "Estándar",
    description: "Certificado básico de calidad",
    color: "#9E9E9E",
  },
  [CertificateGrade.PREMIUM]: {
    displayName: "Premium",
    description: "Calidad superior verificada",
    color: "#FFD700",
  },
  [CertificateGrade.EXPORT]: {
    displayName: "Exportación",
    description: "Apto para mercados internacionales",
    color: "#2196F3",
  },
  [CertificateGrade.ORGANIC]: {
    displayName: "Orgánico",
    description: "Certificación orgánica verificada",
    color: "#4CAF50",
  },
};

/**
 * Minimum required stages for certificate issuance by grade
 */
export const REQUIRED_STAGES_BY_GRADE: Record<CertificateGrade, string[]> = {
  [CertificateGrade.STANDARD]: ["HARVEST", "PACKING"],
  [CertificateGrade.PREMIUM]: ["HARVEST", "PACKING", "COLD_CHAIN"],
  [CertificateGrade.EXPORT]: [
    "HARVEST",
    "PACKING",
    "COLD_CHAIN",
    "EXPORT",
    "DELIVERY",
  ],
  [CertificateGrade.ORGANIC]: [
    "HARVEST",
    "PACKING",
    "COLD_CHAIN",
    "EXPORT",
    "DELIVERY",
  ],
};

/**
 * Grade hierarchy for upgrade validation
 */
const GRADE_HIERARCHY: Record<CertificateGrade, number> = {
  [CertificateGrade.STANDARD]: 1,
  [CertificateGrade.PREMIUM]: 2,
  [CertificateGrade.EXPORT]: 3,
  [CertificateGrade.ORGANIC]: 4,
};

/**
 * Check if a certificate is currently valid (not expired and past valid start date)
 */
export function isCertificateValid(certificate: QualityCertificate): boolean {
  const now = new Date();
  return certificate.validFrom <= now && certificate.validTo >= now;
}

/**
 * Check if a certificate can be upgraded from one grade to another
 */
export function canUpgradeToGrade(
  currentGrade: CertificateGrade,
  targetGrade: CertificateGrade,
): boolean {
  return GRADE_HIERARCHY[targetGrade] > GRADE_HIERARCHY[currentGrade];
}
