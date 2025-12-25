export class ListBatchCertificatesUseCase {
    certificateService;
    constructor(certificateService) {
        this.certificateService = certificateService;
    }
    async execute(request) {
        if (request.validOnly) {
            return this.certificateService.getValidCertificates(request.batchId);
        }
        return this.certificateService.getBatchCertificates(request.batchId);
    }
}
