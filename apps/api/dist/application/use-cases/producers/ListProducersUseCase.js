export class ListProducersUseCase {
    producerRepository;
    constructor(producerRepository) {
        this.producerRepository = producerRepository;
    }
    async execute(dto) {
        try {
            const results = await this.producerRepository.find({
                page: dto.page,
                limit: dto.limit,
                isWhitelisted: dto.isWhitelisted,
                state: dto.state,
            });
            if (!results || !Array.isArray(results.producers)) {
                return { producers: [], total: 0 };
            }
            return results;
        }
        catch (err) {
            throw err;
        }
    }
}
