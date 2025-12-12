export class GetBatchByNumberUseCase {
  async execute(dto: any): Promise<any> {
    console.log(dto);
    return { batchNumber: dto.batchNumber, status: 'REGISTERED' };
  }
}
