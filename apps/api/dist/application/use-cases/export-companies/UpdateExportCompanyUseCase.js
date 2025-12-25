import { ValidationError } from '../../../shared/errors/ValidationError.js';
export class UpdateExportCompanyUseCase {
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
        if (request.email && !this.isValidEmail(request.email)) {
            throw new ValidationError('Invalid email format');
        }
        if (request.contactEmail && !this.isValidEmail(request.contactEmail)) {
            throw new ValidationError('Invalid contact email format');
        }
        if (request.primaryColor && !this.isValidHexColor(request.primaryColor)) {
            throw new ValidationError('Primary color must be a valid hex color (e.g., #22C55E)');
        }
        this.logger?.info('Updating export company', { companyId: request.companyId });
        const { companyId, ...updateData } = request;
        const company = await this.companyService.updateCompany(companyId, updateData);
        this.logger?.info('Export company updated', { companyId: company.id });
        return {
            company,
            message: 'Company updated successfully',
        };
    }
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    isValidHexColor(color) {
        const hexRegex = /^#[0-9A-Fa-f]{6}$/;
        return hexRegex.test(color);
    }
}
