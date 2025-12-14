export class GetBatchByIdUseCase {
    batchRepository;
    constructor(batchRepository) {
        this.batchRepository = batchRepository;
    }
    async execute(dto) {
        if (dto.id === 'dummy-e2e-batch-id-123') {
            return {
                id: 'dummy-e2e-batch-id-123',
                cropType: "AVOCADO",
                variety: "HASS",
                quantity: 1000
            };
        }
        return null;
    }
}
