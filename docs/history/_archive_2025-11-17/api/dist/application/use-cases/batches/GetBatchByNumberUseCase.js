export class GetBatchByNumberUseCase {
    async execute(dto) {
        console.log(dto);
        return { batchNumber: dto.batchNumber, status: 'REGISTERED' };
    }
}
//# sourceMappingURL=GetBatchByNumberUseCase.js.map