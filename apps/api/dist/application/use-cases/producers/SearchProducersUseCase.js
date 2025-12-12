export class SearchProducersUseCase {
    producerRepository;
    constructor(producerRepository) {
        this.producerRepository = producerRepository;
    }
    async execute(dto) {
        const criteria = {
            page: dto.page || 1,
            limit: dto.limit || 20,
            isWhitelisted: dto.isWhitelisted,
            state: dto.state,
        };
        const results = await this.producerRepository.searchProducers(dto.searchQuery, criteria);
        // Defensive check
        if (!results || !Array.isArray(results.producers)) {
            return { producers: [], total: 0 };
        }
        return results;
    }
}
