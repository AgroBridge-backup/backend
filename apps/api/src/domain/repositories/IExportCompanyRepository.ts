/**
 * ExportCompany Repository Interface
 * Defines the contract for export company data access
 */

import {
  ExportCompany,
  ExportCompanyFilter,
  ExportCompanyStatus,
  ExportCompanyTier,
  ExportCompanyWithStats,
} from '../entities/ExportCompany.js';

export interface CreateExportCompanyData {
  id: string;
  name: string;
  legalName?: string;
  rfc: string;
  email: string;
  phone?: string;
  country: string;
  state?: string;
  city?: string;
  address?: string;
  postalCode?: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  tier: ExportCompanyTier;
  status: ExportCompanyStatus;
  trialEndsAt?: Date;
  monthlyFee: number;
  certificateFee: number;
  farmersIncluded: number;
  certsIncluded: number;
  enabledStandards: string[];
  logoUrl?: string;
  primaryColor?: string;
}

export interface UpdateExportCompanyData {
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
  trialEndsAt?: Date;
  monthlyFee?: number;
  certificateFee?: number;
  farmersIncluded?: number;
  certsIncluded?: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  enabledStandards?: string[];
  logoUrl?: string;
  primaryColor?: string;
}

export interface ExportCompanyListResult {
  companies: ExportCompany[];
  total: number;
}

export interface IExportCompanyRepository {
  /**
   * Create a new export company
   */
  create(data: CreateExportCompanyData): Promise<ExportCompany>;

  /**
   * Find export company by ID
   */
  findById(id: string): Promise<ExportCompany | null>;

  /**
   * Find export company by RFC (Mexican tax ID)
   */
  findByRfc(rfc: string): Promise<ExportCompany | null>;

  /**
   * Find export company by email
   */
  findByEmail(email: string): Promise<ExportCompany | null>;

  /**
   * Find export company by Stripe customer ID
   */
  findByStripeCustomerId(stripeCustomerId: string): Promise<ExportCompany | null>;

  /**
   * List export companies with filtering and pagination
   */
  list(filter?: ExportCompanyFilter): Promise<ExportCompanyListResult>;

  /**
   * Update export company
   */
  update(id: string, data: UpdateExportCompanyData): Promise<ExportCompany>;

  /**
   * Get export company with usage statistics
   */
  findByIdWithStats(id: string): Promise<ExportCompanyWithStats | null>;

  /**
   * Count farmers enrolled under an export company
   */
  countFarmers(id: string): Promise<number>;

  /**
   * Count certificates issued for an export company in a given month
   */
  countCertificatesInMonth(id: string, year: number, month: number): Promise<number>;

  /**
   * Get companies with expiring trials (for notification)
   */
  findExpiringTrials(daysUntilExpiry: number): Promise<ExportCompany[]>;

  /**
   * Activate company (move from TRIAL to ACTIVE)
   */
  activate(id: string, stripeCustomerId: string, stripeSubscriptionId: string): Promise<ExportCompany>;

  /**
   * Suspend company (payment failed)
   */
  suspend(id: string): Promise<ExportCompany>;

  /**
   * Cancel company subscription
   */
  cancel(id: string): Promise<ExportCompany>;

  /**
   * Check if company has capacity for more farmers
   */
  hasCapacityForFarmers(id: string): Promise<boolean>;

  /**
   * Check if company has capacity for more certificates this month
   */
  hasCapacityForCertificates(id: string): Promise<boolean>;
}
