import { ExportCompanyTier, TIER_CONFIG } from '../../../domain/entities/ExportCompany.js';
import { ValidationError } from '../../../shared/errors/ValidationError.js';
export class UpgradeTierUseCase {
    companyService;
    logger;
    constructor(companyService, logger) {
        this.companyService = companyService;
        this.logger = logger;
    }
    async execute(request) {
        if (!request.companyId) {
            throw new ValidationError('Company ID is required');
        }
        if (!request.newTier) {
            throw new ValidationError('New tier is required');
        }
        if (!Object.values(ExportCompanyTier).includes(request.newTier)) {
            throw new ValidationError('Invalid tier. Must be STARTER, PROFESSIONAL, or ENTERPRISE');
        }
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
