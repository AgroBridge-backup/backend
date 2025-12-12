export class AddCertificationUseCase {
    producerRepository;
    constructor(producerRepository) {
        this.producerRepository = producerRepository;
    }
    async execute(dto) {
        return { id: 'dummy-cert-id' };
    }
}
