export class GetBatchHistoryUseCase {
    async execute(dto) {
        console.log(dto);
        return [{ eventType: 'HARVEST', timestamp: new Date() }];
    }
}
//# sourceMappingURL=GetBatchHistoryUseCase.js.map