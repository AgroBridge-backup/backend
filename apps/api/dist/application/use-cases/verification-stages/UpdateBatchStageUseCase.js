export class UpdateBatchStageUseCase {
    stageService;
    constructor(stageService) {
        this.stageService = stageService;
    }
    async execute(request) {
        const context = {
            userId: request.userId,
            userRole: request.userRole,
        };
        const stage = await this.stageService.updateStage(request.stageId, {
            status: request.status,
            notes: request.notes,
            location: request.location,
            latitude: request.latitude,
            longitude: request.longitude,
            evidenceUrl: request.evidenceUrl,
        }, context);
        return { stage };
    }
}
