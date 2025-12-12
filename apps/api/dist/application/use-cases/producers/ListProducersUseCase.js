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
            // Defensive check: Ensure results and its producer array exist and are arrays
            if (!results || !Array.isArray(results.producers)) {
                return { producers: [], total: 0 };
            }
            return results;
        }
        catch (err) {
            // Re-throw to be caught by the global error handler, which will produce a 500
            throw err;
        }
    }
}
