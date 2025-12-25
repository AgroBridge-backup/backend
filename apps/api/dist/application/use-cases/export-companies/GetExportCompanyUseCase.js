import { ValidationError } from '../../../shared/errors/ValidationError.js';
export class GetExportCompanyUseCase {
    companyService;
    constructor(companyService) {
        this.companyService = companyService;
    }
    async execute(request) {
        if (!request.companyId) {
            throw new ValidationError('Company ID is required');
        }
        const company = await this.companyService.getCompanyWithStats(request.companyId);
        return { company };
    }
}
