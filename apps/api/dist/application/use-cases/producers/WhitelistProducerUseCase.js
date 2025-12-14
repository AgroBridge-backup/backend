export class WhitelistProducerUseCase {
    producerRepository;
    constructor(producerRepository) {
        this.producerRepository = producerRepository;
    }
    async execute(dto) {
        return { id: dto.producerId, isWhitelisted: true };
    }
}
