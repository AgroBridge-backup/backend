import { NotFoundError } from '../../../shared/errors/NotFoundError.js';
export class GetProducerStatsUseCase {
    producerRepository;
    constructor(producerRepository) {
        this.producerRepository = producerRepository;
    }
    async execute(dto) {
        // Get stats from repository (includes producer check)
        const stats = await this.producerRepository.getStatsByProducerId(dto.producerId);
        if (!stats || !stats.producer) {
            throw new NotFoundError(`Producer with ID ${dto.producerId} not found.`);
        }
        return stats;
    }
}
