import { NotFoundError } from '../../../shared/errors/NotFoundError.js';
import { InsufficientPermissionsError } from '../../../shared/errors/InsufficientPermissionsError.js';
import { AppError } from '../../../shared/errors/AppError.js';
export class UpdateEventUseCase {
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
            throw new InsufficientPermissionsError('You can only update your own events.');
        }
        // Don't allow update if blockchainTxHash exists
        if (event.blockchainTxHash) {
            throw new AppError('Cannot update events recorded on blockchain.', 403);
        }
        // Prepare update data (only allowed fields)
        const updateData = {};
        if (dto.locationName !== undefined)
            updateData.locationName = dto.locationName;
        if (dto.latitude !== undefined)
            updateData.latitude = dto.latitude;
        if (dto.longitude !== undefined)
            updateData.longitude = dto.longitude;
        if (dto.temperature !== undefined)
            updateData.temperature = dto.temperature;
        if (dto.humidity !== undefined)
            updateData.humidity = dto.humidity;
        if (dto.notes !== undefined)
            updateData.notes = dto.notes;
        // Update event
        const updatedEvent = await this.eventRepository.update(dto.eventId, updateData);
        return updatedEvent;
    }
}
