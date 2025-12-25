export class IssueCertificateUseCase {
    certificateService;
    constructor(certificateService) {
        this.certificateService = certificateService;
    }
    async execute(request) {
        return this.certificateService.issueCertificate({
            batchId: request.batchId,
            grade: request.grade,
            certifyingBody: request.certifyingBody,
            validityDays: request.validityDays ?? 365,
            issuedBy: request.issuedBy,
        });
    }
}
