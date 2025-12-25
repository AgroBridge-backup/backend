import { AppError } from '../../../shared/errors/AppError.js';
export class VerifyNfcSealUseCase {
    sealService;
    constructor(sealService) {
        this.sealService = sealService;
    }
    async execute(input) {
        if (!input.serialNumber) {
            throw new AppError('Serial number is required', 400);
        }
        if (!input.signature) {
            throw new AppError('Signature is required', 400);
        }
        if (input.readCounter === undefined || input.readCounter < 0) {
            throw new AppError('Valid read counter is required', 400);
        }
        if (!input.verifiedBy) {
            throw new AppError('Verified by user ID is required', 400);
        }
        return this.sealService.verifySeal({
            serialNumber: input.serialNumber.trim().toUpperCase(),
            signature: input.signature,
            readCounter: input.readCounter,
            verifiedBy: input.verifiedBy,
            location: input.location,
            latitude: input.latitude,
            longitude: input.longitude,
            deviceInfo: input.deviceInfo,
        });
    }
}
