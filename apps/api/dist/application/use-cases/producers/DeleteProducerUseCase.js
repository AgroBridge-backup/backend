import { NotFoundError } from '../../../shared/errors/NotFoundError.js';
import { InsufficientPermissionsError } from '../../../shared/errors/InsufficientPermissionsError.js';
import { AppError } from '../../../shared/errors/AppError.js';
export class DeleteProducerUseCase {
    producerRepository;
    batchRepository;
    constructor(producerRepository, batchRepository) {
        this.producerRepository = producerRepository;
        this.batchRepository = batchRepository;
    }
    async execute(dto) {
        // Check producer exists
        const producer = await this.producerRepository.findById(dto.producerId);
        if (!producer) {
            throw new NotFoundError(`Producer with ID ${dto.producerId} not found.`);
        }
        // Validate permissions: only owner or ADMIN can delete
        if (producer.userId !== dto.userId && dto.userRole !== 'ADMIN') {
            throw new InsufficientPermissionsError('You can only delete your own producer profile.');
        }
        // Check for active batches (REGISTERED, IN_TRANSIT)
        const activeBatchCount = await this.batchRepository.countByProducerAndStatus(dto.producerId, ['REGISTERED', 'IN_TRANSIT']);
        if (activeBatchCount > 0) {
            throw new AppError(`Cannot delete producer: ${activeBatchCount} active batch(es) exist. Please complete or cancel them first.`, 409);
        }
        // Delete producer (cascades will handle related data)
        await this.producerRepository.delete(dto.producerId);
    }
}
