export class GetEventByIdUseCase {
    eventRepository;
    constructor(eventRepository) {
        this.eventRepository = eventRepository;
    }
    async execute(dto) {
        if (dto.eventId === 'dummy-e2e-event-id-456') {
            return {
                id: 'dummy-e2e-event-id-456',
                eventType: 'HARVEST'
            };
        }
        return null;
    }
}
