export class CheckCertificateEligibilityUseCase {
    certificateService;
    constructor(certificateService) {
        this.certificateService = certificateService;
    }
    async execute(request) {
        return this.certificateService.canIssueCertificate(request.batchId, request.grade);
    }
}
