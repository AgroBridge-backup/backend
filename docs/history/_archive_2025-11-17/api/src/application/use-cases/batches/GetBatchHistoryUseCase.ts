export class GetBatchHistoryUseCase {
  async execute(dto: any): Promise<any> {
    console.log(dto);
    return [{ eventType: 'HARVEST', timestamp: new Date() }];
  }
}
