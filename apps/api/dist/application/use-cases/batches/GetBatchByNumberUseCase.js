export class GetBatchByNumberUseCase {
    batchRepository;
    constructor(batchRepository) {
        this.batchRepository = batchRepository;
    }
    async execute(dto) {
        return { id: 'dummy-batch-id', batchNumber: dto.batchNumber };
    }
}
