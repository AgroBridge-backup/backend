import { IProducerRepository } from '../../../domain/repositories/IProducerRepository.js';
import { NotFoundError } from '../../../shared/errors/NotFoundError.js';

export class GetProducerByIdUseCase {
  constructor(private readonly producerRepository: IProducerRepository) {}

  async execute(dto: { producerId: string }): Promise<any> {
    const producer = await this.producerRepository.findById(dto.producerId);
    if (!producer) {
      throw new NotFoundError(`Producer with ID ${dto.producerId} not found.`);
    }
    return producer;
  }
}
