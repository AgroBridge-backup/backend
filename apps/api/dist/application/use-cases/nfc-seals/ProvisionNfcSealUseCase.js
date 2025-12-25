import { AppError } from '../../../shared/errors/AppError.js';
export class ProvisionNfcSealUseCase {
    sealService;
    constructor(sealService) {
        this.sealService = sealService;
    }
    async execute(input) {
        if (!input.serialNumber || input.serialNumber.trim() === '') {
            throw new AppError('Serial number is required', 400);
        }
        if (input.expiresAt && input.expiresAt < new Date()) {
            throw new AppError('Expiration date cannot be in the past', 400);
        }
        return this.sealService.provisionSeal({
            serialNumber: input.serialNumber.trim().toUpperCase(),
            expiresAt: input.expiresAt,
        });
    }
}
