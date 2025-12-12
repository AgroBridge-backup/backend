export class GetBatchHistoryUseCase {
    batchRepository;
    constructor(batchRepository) {
        this.batchRepository = batchRepository;
    }
    async execute(dto) {
        return [];
    }
}
