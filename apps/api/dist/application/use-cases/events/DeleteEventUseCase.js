import { NotFoundError } from '../../../shared/errors/NotFoundError.js';
import { InsufficientPermissionsError } from '../../../shared/errors/InsufficientPermissionsError.js';
import { AppError } from '../../../shared/errors/AppError.js';
export class DeleteEventUseCase {
    eventRepository;
    constructor(eventRepository) {
        this.eventRepository = eventRepository;
    }
    async execute(dto) {
        // Check event exists
        const event = await this.eventRepository.findById(dto.eventId);
        if (!event) {
            throw new NotFoundError(`Event with ID ${dto.eventId} not found.`);
        }
        // Validate permissions: owner or ADMIN only
        if (event.createdById !== dto.userId && dto.userRole !== 'ADMIN') {
            throw new InsufficientPermissionsError('You can only delete your own events.');
        }
        // Don't allow deletion of system-generated events (DELIVERY, CUSTOMS_CLEARANCE)
        const systemEventTypes = ['DELIVERY', 'CUSTOMS_CLEARANCE'];
        if (systemEventTypes.includes(event.eventType)) {
            throw new AppError('Cannot delete system-generated events.', 403);
        }
        // Blockchain-recorded events cannot be deleted
        if (event.blockchainTxHash) {
            throw new AppError('Cannot delete events recorded on blockchain.', 403);
        }
        // Delete event
        await this.eventRepository.delete(dto.eventId);
    }
}
