export class VerifyCertificateUseCase {
    certificateService;
    constructor(certificateService) {
        this.certificateService = certificateService;
    }
    async execute(request) {
        const result = await this.certificateService.verifyCertificate(request.certificateId);
        let message;
        if (!result.certificate) {
            message = 'Certificate not found';
        }
        else if (result.isExpired) {
            message = 'Certificate has expired';
        }
        else if (!result.isValid) {
            message = 'Certificate hash mismatch - data may have been tampered';
        }
        else {
            message = 'Certificate is valid and authentic';
        }
        return {
            ...result,
            message,
        };
    }
}
