/**
 * ExportCompany Domain Service
 * Business logic for B2B export company management
 * Handles subscription tiers, capacity checks, and billing events
 */

import { v4 as uuidv4 } from "uuid";
import { AppError } from "../../shared/errors/AppError.js";
import { IExportCompanyRepository } from "../repositories/IExportCompanyRepository.js";
import {
  ExportCompany,
  ExportCompanyFilter,
  ExportCompanyStatus,
  ExportCompanyTier,
  ExportCompanyWithStats,
  CreateExportCompanyInput,
  UpdateExportCompanyInput,
  TIER_CONFIG,
} from "../entities/ExportCompany.js";
import logger from "../../shared/utils/logger.js";

const TRIAL_DURATION_DAYS = 14;

export interface CreateCompanyResult {
  company: ExportCompany;
  trialEndsAt: Date;
}

export class ExportCompanyService {
  constructor(private repository: IExportCompanyRepository) {}

  /**
   * Register a new export company with trial period
   */
  async registerCompany(
    input: CreateExportCompanyInput,
  ): Promise<CreateCompanyResult> {
    // Validate RFC format (Mexican tax ID)
    if (!this.isValidRfc(input.rfc)) {
      throw new AppError("Invalid RFC format", 400);
    }

    // Check for existing company with same RFC or email
    const existingByRfc = await this.repository.findByRfc(input.rfc);
    if (existingByRfc) {
      throw new AppError("A company with this RFC already exists", 409);
    }

    const existingByEmail = await this.repository.findByEmail(input.email);
    if (existingByEmail) {
      throw new AppError("A company with this email already exists", 409);
    }

    // Get tier configuration
    const tier = input.tier || ExportCompanyTier.STARTER;
    const tierConfig = TIER_CONFIG[tier];

    // Calculate trial end date
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DURATION_DAYS);

    const company = await this.repository.create({
      id: uuidv4(),
      name: input.name,
      legalName: input.legalName,
      rfc: input.rfc.toUpperCase(),
      email: input.email.toLowerCase(),
      phone: input.phone,
      country: input.country || "MX",
      state: input.state,
      city: input.city,
      address: input.address,
      postalCode: input.postalCode,
      contactName: input.contactName,
      contactEmail: input.contactEmail.toLowerCase(),
      contactPhone: input.contactPhone,
      tier,
      status: ExportCompanyStatus.TRIAL,
      trialEndsAt,
      monthlyFee: tierConfig.monthlyFee,
      certificateFee: tierConfig.certificateFee,
      farmersIncluded: tierConfig.farmersIncluded,
      certsIncluded: tierConfig.certsIncluded,
      enabledStandards: input.enabledStandards || [
        "ORGANIC_USDA",
        "ORGANIC_EU",
        "SENASICA",
      ],
      logoUrl: input.logoUrl,
      primaryColor: input.primaryColor || "#22C55E",
    });

    logger.info(`Export company registered: ${company.id} (${company.name})`);

    return { company, trialEndsAt };
  }

  /**
   * Get company by ID with usage statistics
   */
  async getCompanyWithStats(id: string): Promise<ExportCompanyWithStats> {
    const company = await this.repository.findByIdWithStats(id);
    if (!company) {
      throw new AppError("Export company not found", 404);
    }
    return company;
  }

  /**
   * Get company by ID
   */
  async getCompany(id: string): Promise<ExportCompany> {
    const company = await this.repository.findById(id);
    if (!company) {
      throw new AppError("Export company not found", 404);
    }
    return company;
  }

  /**
   * List companies with filters
   */
  async listCompanies(filter?: ExportCompanyFilter): Promise<{
    companies: ExportCompany[];
    total: number;
  }> {
    return this.repository.list(filter);
  }

  /**
   * Update company details
   */
  async updateCompany(
    id: string,
    input: UpdateExportCompanyInput,
  ): Promise<ExportCompany> {
    const company = await this.repository.findById(id);
    if (!company) {
      throw new AppError("Export company not found", 404);
    }

    // If tier is being changed, update limits accordingly
    if (input.tier && input.tier !== company.tier) {
      const tierConfig = TIER_CONFIG[input.tier];
      return this.repository.update(id, {
        ...input,
        monthlyFee: tierConfig.monthlyFee,
        certificateFee: tierConfig.certificateFee,
        farmersIncluded: tierConfig.farmersIncluded,
        certsIncluded: tierConfig.certsIncluded,
      });
    }

    return this.repository.update(id, input);
  }

  /**
   * Upgrade company tier
   */
  async upgradeTier(
    id: string,
    newTier: ExportCompanyTier,
  ): Promise<ExportCompany> {
    const company = await this.repository.findById(id);
    if (!company) {
      throw new AppError("Export company not found", 404);
    }

    const currentTierIndex = Object.values(ExportCompanyTier).indexOf(
      company.tier,
    );
    const newTierIndex = Object.values(ExportCompanyTier).indexOf(newTier);

    if (newTierIndex <= currentTierIndex) {
      throw new AppError("New tier must be higher than current tier", 400);
    }

    const tierConfig = TIER_CONFIG[newTier];

    logger.info(`Upgrading company ${id} from ${company.tier} to ${newTier}`);

    return this.repository.update(id, {
      tier: newTier,
      monthlyFee: tierConfig.monthlyFee,
      certificateFee: tierConfig.certificateFee,
      farmersIncluded: tierConfig.farmersIncluded,
      certsIncluded: tierConfig.certsIncluded,
    });
  }

  /**
   * Activate company after successful payment
   */
  async activateCompany(
    id: string,
    stripeCustomerId: string,
    stripeSubscriptionId: string,
  ): Promise<ExportCompany> {
    const company = await this.repository.findById(id);
    if (!company) {
      throw new AppError("Export company not found", 404);
    }

    if (company.status !== ExportCompanyStatus.TRIAL) {
      throw new AppError("Company is not in trial status", 400);
    }

    logger.info(
      `Activating company ${id} with Stripe customer ${stripeCustomerId}`,
    );

    return this.repository.activate(id, stripeCustomerId, stripeSubscriptionId);
  }

  /**
   * Suspend company (payment failed)
   */
  async suspendCompany(id: string): Promise<ExportCompany> {
    const company = await this.repository.findById(id);
    if (!company) {
      throw new AppError("Export company not found", 404);
    }

    logger.warn(`Suspending company ${id} due to payment failure`);

    return this.repository.suspend(id);
  }

  /**
   * Cancel company subscription
   */
  async cancelCompany(id: string): Promise<ExportCompany> {
    const company = await this.repository.findById(id);
    if (!company) {
      throw new AppError("Export company not found", 404);
    }

    logger.info(`Cancelling company ${id}`);

    return this.repository.cancel(id);
  }

  /**
   * Check if company can enroll more farmers
   */
  async canEnrollFarmer(companyId: string): Promise<{
    canEnroll: boolean;
    reason?: string;
    currentCount: number;
    limit: number;
  }> {
    const company = await this.repository.findById(companyId);
    if (!company) {
      throw new AppError("Export company not found", 404);
    }

    // Check company status
    if (company.status === ExportCompanyStatus.SUSPENDED) {
      return {
        canEnroll: false,
        reason: "Company subscription is suspended",
        currentCount: 0,
        limit: company.farmersIncluded,
      };
    }

    if (company.status === ExportCompanyStatus.CANCELLED) {
      return {
        canEnroll: false,
        reason: "Company subscription is cancelled",
        currentCount: 0,
        limit: company.farmersIncluded,
      };
    }

    // Check trial expiry
    if (company.status === ExportCompanyStatus.TRIAL && company.trialEndsAt) {
      if (new Date() > company.trialEndsAt) {
        return {
          canEnroll: false,
          reason: "Trial period has expired",
          currentCount: 0,
          limit: company.farmersIncluded,
        };
      }
    }

    const currentCount = await this.repository.countFarmers(companyId);

    // Unlimited farmers for enterprise
    if (company.farmersIncluded === -1) {
      return { canEnroll: true, currentCount, limit: -1 };
    }

    const canEnroll = currentCount < company.farmersIncluded;

    return {
      canEnroll,
      reason: canEnroll ? undefined : "Farmer limit reached for current tier",
      currentCount,
      limit: company.farmersIncluded,
    };
  }

  /**
   * Check if company can issue more certificates this month
   */
  async canIssueCertificate(companyId: string): Promise<{
    canIssue: boolean;
    reason?: string;
    currentCount: number;
    limit: number;
  }> {
    const company = await this.repository.findById(companyId);
    if (!company) {
      throw new AppError("Export company not found", 404);
    }

    // Check company status
    if (company.status === ExportCompanyStatus.SUSPENDED) {
      return {
        canIssue: false,
        reason: "Company subscription is suspended",
        currentCount: 0,
        limit: company.certsIncluded,
      };
    }

    if (company.status === ExportCompanyStatus.CANCELLED) {
      return {
        canIssue: false,
        reason: "Company subscription is cancelled",
        currentCount: 0,
        limit: company.certsIncluded,
      };
    }

    const now = new Date();
    const currentCount = await this.repository.countCertificatesInMonth(
      companyId,
      now.getFullYear(),
      now.getMonth() + 1,
    );

    // Unlimited certificates for enterprise
    if (company.certsIncluded === -1) {
      return { canIssue: true, currentCount, limit: -1 };
    }

    const canIssue = currentCount < company.certsIncluded;

    return {
      canIssue,
      reason: canIssue ? undefined : "Monthly certificate limit reached",
      currentCount,
      limit: company.certsIncluded,
    };
  }

  /**
   * Get companies with expiring trials for notification
   */
  async getExpiringTrials(
    daysUntilExpiry: number = 3,
  ): Promise<ExportCompany[]> {
    return this.repository.findExpiringTrials(daysUntilExpiry);
  }

  /**
   * Validate Mexican RFC format
   */
  private isValidRfc(rfc: string): boolean {
    // RFC for companies: 3 letters + 6 digits + 3 alphanumeric
    // RFC for individuals: 4 letters + 6 digits + 3 alphanumeric
    const rfcPattern = /^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$/i;
    return rfcPattern.test(rfc);
  }
}
