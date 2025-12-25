import { ValidationError } from '../../../shared/errors/ValidationError.js';
export class CheckCapacityUseCase {
    companyService;
    constructor(companyService) {
        this.companyService = companyService;
    }
    async execute(request) {
        if (!request.companyId) {
            throw new ValidationError('Company ID is required');
        }
        const [farmerCapacity, certCapacity] = await Promise.all([
            this.companyService.canEnrollFarmer(request.companyId),
            this.companyService.canIssueCertificate(request.companyId),
        ]);
        return {
            companyId: request.companyId,
            farmers: {
                canEnroll: farmerCapacity.canEnroll,
                reason: farmerCapacity.reason,
                currentCount: farmerCapacity.currentCount,
                limit: farmerCapacity.limit,
                percentUsed: farmerCapacity.limit === -1 ? 0 : Math.round((farmerCapacity.currentCount / farmerCapacity.limit) * 100),
            },
            certificates: {
                canIssue: certCapacity.canIssue,
                reason: certCapacity.reason,
                currentCount: certCapacity.currentCount,
                limit: certCapacity.limit,
                percentUsed: certCapacity.limit === -1 ? 0 : Math.round((certCapacity.currentCount / certCapacity.limit) * 100),
            },
        };
    }
}
