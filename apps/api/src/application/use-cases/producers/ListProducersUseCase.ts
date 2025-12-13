import { IProducerRepository, ProducerList } from '../../../domain/repositories/IProducerRepository.js';

export type ListProducersRequestDto = {
  page: number;
  limit: number;
  isWhitelisted?: boolean;
  state?: string;
};

export type ListProducersResponseDto = ProducerList;

export class ListProducersUseCase {
  constructor(private readonly producerRepository: IProducerRepository) {}

  async execute(dto: ListProducersRequestDto): Promise<ListProducersResponseDto> {
    try {
      const results = await this.producerRepository.find({
        page: dto.page,
        limit: dto.limit,
        isWhitelisted: dto.isWhitelisted,
        state: dto.state,
      });

      // Defensive check: Ensure results and its producer array exist and are arrays
      if (!results || !Array.isArray(results.producers)) {
        return { producers: [], total: 0 };
      }

      return results;
    } catch (err) {
      // Re-throw to be caught by the global error handler, which will produce a 500
      throw err;
    }
  }
}
