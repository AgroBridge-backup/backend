export class FinalizeBatchStagesUseCase {
    finalizationService;
    constructor(finalizationService) {
        this.finalizationService = finalizationService;
    }
    async execute(request) {
        return this.finalizationService.finalize(request.batchId);
    }
}
