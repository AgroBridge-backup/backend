import { ValidationError } from '../../../shared/errors/ValidationError.js';
export class RegisterExportCompanyUseCase {
    companyService;
    logger;
    constructor(companyService, logger) {
        this.companyService = companyService;
        this.logger = logger;
    }
    async execute(request) {
        if (!request.name || request.name.trim().length < 2) {
            throw new ValidationError('Company name is required (minimum 2 characters)');
        }
        if (!request.rfc || request.rfc.length < 12) {
            throw new ValidationError('Valid RFC is required (12-13 characters)');
        }
        if (!request.email || !this.isValidEmail(request.email)) {
            throw new ValidationError('Valid email is required');
        }
        if (!request.contactName || request.contactName.trim().length < 2) {
            throw new ValidationError('Contact name is required');
        }
        if (!request.contactEmail || !this.isValidEmail(request.contactEmail)) {
            throw new ValidationError('Valid contact email is required');
        }
        this.logger?.info('Registering export company', {
            name: request.name,
            rfc: request.rfc,
            tier: request.tier || 'STARTER',
        });
        const result = await this.companyService.registerCompany(request);
        this.logger?.info('Export company registered successfully', {
            companyId: result.company.id,
            trialEndsAt: result.trialEndsAt.toISOString(),
        });
        return {
            company: result.company,
            trialEndsAt: result.trialEndsAt,
            message: `Company registered successfully. Trial ends on ${result.trialEndsAt.toISOString().split('T')[0]}`,
        };
    }
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
}
