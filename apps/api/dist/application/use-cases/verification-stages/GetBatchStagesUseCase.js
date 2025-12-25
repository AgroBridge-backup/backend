export class GetBatchStagesUseCase {
    stageService;
    constructor(stageService) {
        this.stageService = stageService;
    }
    async execute(request) {
        return this.stageService.getBatchStages(request.batchId);
    }
}
