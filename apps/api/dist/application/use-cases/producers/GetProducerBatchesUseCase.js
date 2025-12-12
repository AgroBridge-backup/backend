import { NotFoundError } from '../../../shared/errors/NotFoundError.js';
export class GetProducerBatchesUseCase {
    producerRepository;
    batchRepository;
    constructor(producerRepository, batchRepository) {
        this.producerRepository = producerRepository;
        this.batchRepository = batchRepository;
    }
    async execute(dto) {
        // Verify producer exists
        const producer = await this.producerRepository.findById(dto.producerId);
        if (!producer) {
            throw new NotFoundError(`Producer with ID ${dto.producerId} not found.`);
        }
        const page = dto.page || 1;
        const limit = dto.limit || 20;
        const filters = {};
        if (dto.status)
            filters.status = dto.status;
        if (dto.variety)
            filters.variety = dto.variety;
        const result = await this.batchRepository.findByProducerId(dto.producerId, filters, { page, limit });
        return {
            producerId: dto.producerId,
            batches: result.batches,
            total: result.total,
            page,
            limit,
        };
    }
}
