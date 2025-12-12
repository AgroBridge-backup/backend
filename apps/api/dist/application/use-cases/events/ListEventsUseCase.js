export class ListEventsUseCase {
    eventRepository;
    constructor(eventRepository) {
        this.eventRepository = eventRepository;
    }
    async execute(dto) {
        const page = dto.page || 1;
        const limit = dto.limit || 20;
        const filters = {};
        if (dto.eventType)
            filters.eventType = dto.eventType;
        if (dto.batchId)
            filters.batchId = dto.batchId;
        if (dto.createdById)
            filters.createdById = dto.createdById;
        const result = await this.eventRepository.findMany(filters, { page, limit });
        return {
            events: result.events,
            total: result.total,
            page,
            limit,
        };
    }
}
