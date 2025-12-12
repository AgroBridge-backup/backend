import { NotFoundError } from '../../../shared/errors/NotFoundError.js';
import { InsufficientPermissionsError } from '../../../shared/errors/InsufficientPermissionsError.js';
import { AppError } from '../../../shared/errors/AppError.js';
export class DeleteBatchUseCase {
    batchRepository;
    producerRepository;
    constructor(batchRepository, producerRepository) {
        this.batchRepository = batchRepository;
        this.producerRepository = producerRepository;
    }
    async execute(dto) {
        // Check batch exists
        const batch = await this.batchRepository.findById(dto.batchId);
        if (!batch) {
            throw new NotFoundError(`Batch with ID ${dto.batchId} not found.`);
        }
        // Get producer to check ownership
        const producer = await this.producerRepository.findById(batch.producerId);
        if (!producer) {
            throw new NotFoundError('Producer not found for this batch.');
        }
        // Validate permissions: owner or ADMIN only
        if (producer.userId !== dto.userId && dto.userRole !== 'ADMIN') {
            throw new InsufficientPermissionsError('You can only delete your own batches.');
        }
        // Check if batch can be deleted based on status
        const undeletableStatuses = ['IN_TRANSIT', 'DELIVERED'];
        if (undeletableStatuses.includes(batch.status)) {
            throw new AppError(`Cannot delete batch with status: ${batch.status}. Only REGISTERED or REJECTED batches can be deleted.`, 409);
        }
        // Delete batch (cascades will handle events)
        await this.batchRepository.delete(dto.batchId);
    }
}
