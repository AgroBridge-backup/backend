export class AddLocationUpdateUseCase {
    transitService;
    constructor(transitService) {
        this.transitService = transitService;
    }
    async execute(request) {
        return this.transitService.addLocationUpdate(request);
    }
}
