export class WhitelistProducerUseCase {
  async execute(dto: any): Promise<any> {
    console.log(dto);
    return { txHash: 'mock_tx_hash' };
  }
}
