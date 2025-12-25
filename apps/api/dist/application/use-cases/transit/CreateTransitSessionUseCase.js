export class CreateTransitSessionUseCase {
    transitService;
    constructor(transitService) {
        this.transitService = transitService;
    }
    async execute(request) {
        return this.transitService.createSession(request);
    }
}
