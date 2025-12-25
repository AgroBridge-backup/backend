import { AppError } from '../../../shared/errors/AppError.js';
export class GetTransitSessionUseCase {
    transitService;
    constructor(transitService) {
        this.transitService = transitService;
    }
    async execute(request) {
        const session = await this.transitService.getSessionWithProgress(request.sessionId);
        if (!session) {
            throw new AppError('Transit session not found', 404);
        }
        return session;
    }
}
