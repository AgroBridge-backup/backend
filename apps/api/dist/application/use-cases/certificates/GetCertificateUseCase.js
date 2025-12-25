import { AppError } from '../../../shared/errors/AppError.js';
export class GetCertificateUseCase {
    certificateService;
    constructor(certificateService) {
        this.certificateService = certificateService;
    }
    async execute(request) {
        const certificate = await this.certificateService.getCertificate(request.certificateId);
        if (!certificate) {
            throw new AppError('Certificate not found', 404);
        }
        return certificate;
    }
}
