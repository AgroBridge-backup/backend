import { NotFoundError } from '../../../shared/errors/NotFoundError.js';
export class GetProducerByIdUseCase {
    producerRepository;
    constructor(producerRepository) {
        this.producerRepository = producerRepository;
    }
    async execute(dto) {
        const producer = await this.producerRepository.findById(dto.producerId);
        if (!producer) {
            throw new NotFoundError('Producer not found');
        }
        return producer;
    }
}
