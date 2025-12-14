export class CreateBatchUseCase {
    batchRepository;
    constructor(batchRepository) {
        this.batchRepository = batchRepository;
    }
    async execute(dto) {
        return { id: 'dummy-e2e-batch-id-123', ...dto };
    }
}
