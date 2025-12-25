export class GetLocationHistoryUseCase {
    transitService;
    constructor(transitService) {
        this.transitService = transitService;
    }
    async execute(request) {
        return this.transitService.getLocationHistory(request.sessionId, request.limit);
    }
}
