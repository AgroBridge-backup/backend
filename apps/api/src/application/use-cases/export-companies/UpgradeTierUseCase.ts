/**
 * Upgrade Tier Use Case
 * Upgrades an export company to a higher tier
 */

import { ExportCompanyService } from '../../../domain/services/ExportCompanyService.js';
import { ExportCompany, ExportCompanyTier, TIER_CONFIG } from '../../../domain/entities/ExportCompany.js';
import { ValidationError } from '../../../shared/errors/ValidationError.js';
import { ILogger } from '../../../domain/services/ILogger.js';

export interface UpgradeTierRequest {
  companyId: string;
  newTier: ExportCompanyTier;
}

export interface UpgradeTierResponse {
  company: ExportCompany;
  previousTier: ExportCompanyTier;
  newTier: ExportCompanyTier;
  newLimits: {
    farmersIncluded: number;
    certsIncluded: number;
    monthlyFee: number;
    certificateFee: number;
  };
  message: string;
}

export class UpgradeTierUseCase {
  constructor(
    private readonly companyService: ExportCompanyService,
    private readonly logger?: ILogger
  ) {}

  async execute(request: UpgradeTierRequest): Promise<UpgradeTierResponse> {
    if (!request.companyId) {
      throw new ValidationError('Company ID is required');
    }
    if (!request.newTier) {
      throw new ValidationError('New tier is required');
    }
    if (!Object.values(ExportCompanyTier).includes(request.newTier)) {
      throw new ValidationError('Invalid tier. Must be STARTER, PROFESSIONAL, or ENTERPRISE');
    }

    // Get current company to determine previous tier
    const currentCompany = await this.companyService.getCompany(request.companyId);
    const previousTier = currentCompany.tier;

    this.logger?.info('Upgrading company tier', {
      companyId: request.companyId,
      from: previousTier,
      to: request.newTier,
    });

    const company = await this.companyService.upgradeTier(request.companyId, request.newTier);
    const tierConfig = TIER_CONFIG[request.newTier];

    return {
      company,
      previousTier,
      newTier: request.newTier,
      newLimits: {
        farmersIncluded: tierConfig.farmersIncluded,
        certsIncluded: tierConfig.certsIncluded,
        monthlyFee: tierConfig.monthlyFee,
        certificateFee: tierConfig.certificateFee,
      },
      message: `Tier upgraded from ${previousTier} to ${request.newTier}`,
    };
  }
}
