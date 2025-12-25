/**
 * ExportCompany Domain Entity
 * Represents a B2B export company customer in the organic certification infrastructure
 * Primary revenue source: SaaS subscription + per-certificate transaction fees
 */

export enum ExportCompanyTier {
  STARTER = 'STARTER',           // 10 farmers, 50 certs/month, $500/mo
  PROFESSIONAL = 'PROFESSIONAL', // 50 farmers, 200 certs/month, $1,000/mo
  ENTERPRISE = 'ENTERPRISE',     // Unlimited farmers, unlimited certs, $2,000/mo
}

export enum ExportCompanyStatus {
  TRIAL = 'TRIAL',         // 14-day trial period
  ACTIVE = 'ACTIVE',       // Paying customer
  SUSPENDED = 'SUSPENDED', // Payment failed or policy violation
  CANCELLED = 'CANCELLED', // Churned customer
}

export interface ExportCompany {
  id: string;

  // Company identification
  name: string;
  legalName?: string | null;
  rfc: string;
  email: string;
  phone?: string | null;

  // Address
  country: string;
  state?: string | null;
  city?: string | null;
  address?: string | null;
  postalCode?: string | null;

  // Primary contact
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;

  // Subscription & billing
  tier: ExportCompanyTier;
  status: ExportCompanyStatus;
  trialEndsAt?: Date | null;
  monthlyFee: number;
  certificateFee: number;
  farmersIncluded: number;
  certsIncluded: number;

  // Stripe integration
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;

  // Enabled certification standards
  enabledStandards: string[];

  // White-label branding
  logoUrl?: string | null;
  primaryColor?: string | null;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateExportCompanyInput {
  name: string;
  legalName?: string;
  rfc: string;
  email: string;
  phone?: string;
  country?: string;
  state?: string;
  city?: string;
  address?: string;
  postalCode?: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  tier?: ExportCompanyTier;
  enabledStandards?: string[];
  logoUrl?: string;
  primaryColor?: string;
}

export interface UpdateExportCompanyInput {
  name?: string;
  legalName?: string;
  email?: string;
  phone?: string;
  state?: string;
  city?: string;
  address?: string;
  postalCode?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  tier?: ExportCompanyTier;
  status?: ExportCompanyStatus;
  enabledStandards?: string[];
  logoUrl?: string;
  primaryColor?: string;
}

export interface ExportCompanyFilter {
  status?: ExportCompanyStatus;
  tier?: ExportCompanyTier;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ExportCompanyWithStats extends ExportCompany {
  farmerCount: number;
  certificateCount: number;
  monthlyUsage: {
    certificates: number;
    farmers: number;
  };
}

// Tier configuration for business logic
export const TIER_CONFIG: Record<ExportCompanyTier, {
  monthlyFee: number;
  certificateFee: number;
  farmersIncluded: number;
  certsIncluded: number;
}> = {
  [ExportCompanyTier.STARTER]: {
    monthlyFee: 500,
    certificateFee: 10,
    farmersIncluded: 10,
    certsIncluded: 50,
  },
  [ExportCompanyTier.PROFESSIONAL]: {
    monthlyFee: 1000,
    certificateFee: 8,
    farmersIncluded: 50,
    certsIncluded: 200,
  },
  [ExportCompanyTier.ENTERPRISE]: {
    monthlyFee: 2000,
    certificateFee: 5,
    farmersIncluded: -1, // Unlimited
    certsIncluded: -1,   // Unlimited
  },
};
