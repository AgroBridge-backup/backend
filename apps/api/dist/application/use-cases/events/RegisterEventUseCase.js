export class RegisterEventUseCase {
    eventRepository;
    constructor(eventRepository) {
        this.eventRepository = eventRepository;
    }
    async execute(dto) {
        return { id: 'dummy-e2e-event-id-456', ...dto };
    }
}
