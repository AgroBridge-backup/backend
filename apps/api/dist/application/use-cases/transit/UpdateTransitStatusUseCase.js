export class UpdateTransitStatusUseCase {
    transitService;
    constructor(transitService) {
        this.transitService = transitService;
    }
    async execute(request) {
        return this.transitService.updateSessionStatus(request.sessionId, request.status, request.userId);
    }
}
