export class ListProducersUseCase {
  async execute(_dto: any): Promise<any> {
    return [{ id: 'mock_producer_id', businessName: 'Mock Producer' }];
  }
}
