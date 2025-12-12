export class GetProducerByIdUseCase {
  async execute(dto: any): Promise<any> {
    console.log(dto);
    return { id: dto.producerId, businessName: 'Mock Producer' };
  }
}
