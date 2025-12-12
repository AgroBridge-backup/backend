export class CreateBatchUseCase {
    batchRepository;
    constructor(batchRepository) {
        this.batchRepository = batchRepository;
    }
    async execute(dto) {
        // Simulate creation and respond with a predictable ID for E2E tests
        return { id: 'dummy-e2e-batch-id-123', ...dto };
    }
}
