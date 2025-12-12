import { NotFoundError } from '../../../shared/errors/NotFoundError.js';
export class GetBatchTimelineUseCase {
    batchRepository;
    eventRepository;
    constructor(batchRepository, eventRepository) {
        this.batchRepository = batchRepository;
        this.eventRepository = eventRepository;
    }
    async execute(dto) {
        // Check batch exists
        const batch = await this.batchRepository.findById(dto.batchId);
        if (!batch) {
            throw new NotFoundError(`Batch with ID ${dto.batchId} not found.`);
        }
        // Get ALL events for this batch ordered by timestamp ASC
        const events = await this.eventRepository.findByBatchId(dto.batchId);
        // Calculate summary
        const totalEvents = events.length;
        const firstEvent = events.length > 0 ? events[0].timestamp : null;
        const lastEvent = events.length > 0 ? events[events.length - 1].timestamp : null;
        const currentLocation = events.length > 0
            ? events[events.length - 1].locationName || batch.origin
            : batch.origin;
        return {
            batch: {
                id: batch.id,
                variety: batch.variety,
                origin: batch.origin,
                status: batch.status,
                createdAt: batch.createdAt,
            },
            timeline: events,
            summary: {
                totalEvents,
                firstEvent,
                lastEvent,
                currentLocation,
            },
        };
    }
}
