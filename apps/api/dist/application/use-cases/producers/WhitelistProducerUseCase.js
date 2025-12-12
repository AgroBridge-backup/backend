import { NotFoundError } from '../../../shared/errors/NotFoundError.js';
export class WhitelistProducerUseCase {
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
        // Whitelist the producer
        const updatedProducer = await this.producerRepository.updateWhitelist(dto.producerId, true, dto.adminUserId);
        return updatedProducer;
    }
}
