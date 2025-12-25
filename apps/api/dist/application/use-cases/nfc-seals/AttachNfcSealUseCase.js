import { AppError } from '../../../shared/errors/AppError.js';
export class AttachNfcSealUseCase {
    sealService;
    constructor(sealService) {
        this.sealService = sealService;
    }
    async execute(input) {
        if (!input.sealId) {
            throw new AppError('Seal ID is required', 400);
        }
        if (!input.batchId) {
            throw new AppError('Batch ID is required', 400);
        }
        if (!input.attachedBy) {
            throw new AppError('Attached by user ID is required', 400);
        }
        if (input.latitude !== undefined && (input.latitude < -90 || input.latitude > 90)) {
            throw new AppError('Invalid latitude', 400);
        }
        if (input.longitude !== undefined && (input.longitude < -180 || input.longitude > 180)) {
            throw new AppError('Invalid longitude', 400);
        }
        return this.sealService.attachSeal(input);
    }
}
