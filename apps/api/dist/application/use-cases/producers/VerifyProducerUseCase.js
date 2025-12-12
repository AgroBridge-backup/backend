import { NotFoundError } from '../../../shared/errors/NotFoundError.js';
export class VerifyProducerUseCase {
    producerRepository;
    constructor(producerRepository) {
        this.producerRepository = producerRepository;
    }
    async execute(dto) {
        // Check producer exists
        const producer = await this.producerRepository.findById(dto.producerId);
        if (!producer) {
            throw new NotFoundError(`Producer with ID ${dto.producerId} not found.`);
        }
        // Update whitelist status (using existing method name)
        const updatedProducer = await this.producerRepository.updateWhitelist(dto.producerId, dto.verified, dto.adminUserId);
        return updatedProducer;
    }
}
