import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../../shared/errors/AppError.js';
import { ExportCompanyStatus, ExportCompanyTier, TIER_CONFIG, } from '../entities/ExportCompany.js';
import logger from '../../shared/utils/logger.js';
const TRIAL_DURATION_DAYS = 14;
export class ExportCompanyService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async registerCompany(input) {
        if (!this.isValidRfc(input.rfc)) {
            throw new AppError('Invalid RFC format', 400);
        }
        const existingByRfc = await this.repository.findByRfc(input.rfc);
        if (existingByRfc) {
            throw new AppError('A company with this RFC already exists', 409);
        }
        const existingByEmail = await this.repository.findByEmail(input.email);
        if (existingByEmail) {
            throw new AppError('A company with this email already exists', 409);
        }
        const tier = input.tier || ExportCompanyTier.STARTER;
        const tierConfig = TIER_CONFIG[tier];
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DURATION_DAYS);
        const company = await this.repository.create({
            id: uuidv4(),
            name: input.name,
            legalName: input.legalName,
            rfc: input.rfc.toUpperCase(),
            email: input.email.toLowerCase(),
            phone: input.phone,
            country: input.country || 'MX',
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
            enabledStandards: input.enabledStandards || ['ORGANIC_USDA', 'ORGANIC_EU', 'SENASICA'],
            logoUrl: input.logoUrl,
            primaryColor: input.primaryColor || '#22C55E',
        });
        logger.info(`Export company registered: ${company.id} (${company.name})`);
        return { company, trialEndsAt };
    }
    async getCompanyWithStats(id) {
        const company = await this.repository.findByIdWithStats(id);
        if (!company) {
            throw new AppError('Export company not found', 404);
        }
        return company;
    }
    async getCompany(id) {
        const company = await this.repository.findById(id);
        if (!company) {
            throw new AppError('Export company not found', 404);
        }
        return company;
    }
    async listCompanies(filter) {
        return this.repository.list(filter);
    }
    async updateCompany(id, input) {
        const company = await this.repository.findById(id);
        if (!company) {
            throw new AppError('Export company not found', 404);
        }
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
    async upgradeTier(id, newTier) {
        const company = await this.repository.findById(id);
        if (!company) {
            throw new AppError('Export company not found', 404);
        }
        const currentTierIndex = Object.values(ExportCompanyTier).indexOf(company.tier);
        const newTierIndex = Object.values(ExportCompanyTier).indexOf(newTier);
        if (newTierIndex <= currentTierIndex) {
            throw new AppError('New tier must be higher than current tier', 400);
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
    async activateCompany(id, stripeCustomerId, stripeSubscriptionId) {
        const company = await this.repository.findById(id);
        if (!company) {
            throw new AppError('Export company not found', 404);
        }
        if (company.status !== ExportCompanyStatus.TRIAL) {
            throw new AppError('Company is not in trial status', 400);
        }
        logger.info(`Activating company ${id} with Stripe customer ${stripeCustomerId}`);
        return this.repository.activate(id, stripeCustomerId, stripeSubscriptionId);
    }
    async suspendCompany(id) {
        const company = await this.repository.findById(id);
        if (!company) {
            throw new AppError('Export company not found', 404);
        }
        logger.warn(`Suspending company ${id} due to payment failure`);
        return this.repository.suspend(id);
    }
    async cancelCompany(id) {
        const company = await this.repository.findById(id);
        if (!company) {
            throw new AppError('Export company not found', 404);
        }
        logger.info(`Cancelling company ${id}`);
        return this.repository.cancel(id);
    }
    async canEnrollFarmer(companyId) {
        const company = await this.repository.findById(companyId);
        if (!company) {
            throw new AppError('Export company not found', 404);
        }
        if (company.status === ExportCompanyStatus.SUSPENDED) {
            return {
                canEnroll: false,
                reason: 'Company subscription is suspended',
                currentCount: 0,
                limit: company.farmersIncluded,
            };
        }
        if (company.status === ExportCompanyStatus.CANCELLED) {
            return {
                canEnroll: false,
                reason: 'Company subscription is cancelled',
                currentCount: 0,
                limit: company.farmersIncluded,
            };
        }
        if (company.status === ExportCompanyStatus.TRIAL && company.trialEndsAt) {
            if (new Date() > company.trialEndsAt) {
                return {
                    canEnroll: false,
                    reason: 'Trial period has expired',
                    currentCount: 0,
                    limit: company.farmersIncluded,
                };
            }
        }
        const currentCount = await this.repository.countFarmers(companyId);
        if (company.farmersIncluded === -1) {
            return { canEnroll: true, currentCount, limit: -1 };
        }
        const canEnroll = currentCount < company.farmersIncluded;
        return {
            canEnroll,
            reason: canEnroll ? undefined : 'Farmer limit reached for current tier',
            currentCount,
            limit: company.farmersIncluded,
        };
    }
    async canIssueCertificate(companyId) {
        const company = await this.repository.findById(companyId);
        if (!company) {
            throw new AppError('Export company not found', 404);
        }
        if (company.status === ExportCompanyStatus.SUSPENDED) {
            return {
                canIssue: false,
                reason: 'Company subscription is suspended',
                currentCount: 0,
                limit: company.certsIncluded,
            };
        }
        if (company.status === ExportCompanyStatus.CANCELLED) {
            return {
                canIssue: false,
                reason: 'Company subscription is cancelled',
                currentCount: 0,
                limit: company.certsIncluded,
            };
        }
        const now = new Date();
        const currentCount = await this.repository.countCertificatesInMonth(companyId, now.getFullYear(), now.getMonth() + 1);
        if (company.certsIncluded === -1) {
            return { canIssue: true, currentCount, limit: -1 };
        }
        const canIssue = currentCount < company.certsIncluded;
        return {
            canIssue,
            reason: canIssue ? undefined : 'Monthly certificate limit reached',
            currentCount,
            limit: company.certsIncluded,
        };
    }
    async getExpiringTrials(daysUntilExpiry = 3) {
        return this.repository.findExpiringTrials(daysUntilExpiry);
    }
    isValidRfc(rfc) {
        const rfcPattern = /^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$/i;
        return rfcPattern.test(rfc);
    }
}
