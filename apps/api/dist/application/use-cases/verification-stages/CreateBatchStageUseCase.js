export class CreateBatchStageUseCase {
    stageService;
    constructor(stageService) {
        this.stageService = stageService;
    }
    async execute(request) {
        const context = {
            userId: request.userId,
            userRole: request.userRole,
        };
        if (request.stageType) {
            return this.stageService.createSpecificStage({
                batchId: request.batchId,
                stageType: request.stageType,
                actorId: request.userId,
                location: request.location,
                latitude: request.latitude,
                longitude: request.longitude,
                notes: request.notes,
                evidenceUrl: request.evidenceUrl,
            }, context);
        }
        else {
            return this.stageService.createNextStage(request.batchId, {
                actorId: request.userId,
                location: request.location,
                latitude: request.latitude,
                longitude: request.longitude,
                notes: request.notes,
                evidenceUrl: request.evidenceUrl,
            }, context);
        }
    }
}
