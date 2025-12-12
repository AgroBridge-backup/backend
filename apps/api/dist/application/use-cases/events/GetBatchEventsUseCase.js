import { NotFoundError } from '../../../shared/errors/NotFoundError.js';
export class GetBatchEventsUseCase {
    eventRepository;
    batchRepository;
    constructor(eventRepository, batchRepository) {
        this.eventRepository = eventRepository;
        this.batchRepository = batchRepository;
    }
    async execute(dto) {
        // Verify batch exists
        const batch = await this.batchRepository.findById(dto.batchId);
        if (!batch) {
            throw new NotFoundError(`Batch with ID ${dto.batchId} not found.`);
        }
        const page = dto.page || 1;
        const limit = dto.limit || 20;
        const result = await this.eventRepository.findByBatchIdPaginated(dto.batchId, { page, limit });
        return {
            batchId: dto.batchId,
            events: result.events,
            total: result.total,
            page,
            limit,
        };
    }
}
