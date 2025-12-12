import { IProducerRepository, ProducerList } from '../../../../domain/repositories/IProducerRepository.js';

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
    console.log("[DEBUG] UseCase received DTO:", dto);
    try {
      const results = await this.producerRepository.find({
        page: dto.page,
        limit: dto.limit,
        isWhitelisted: dto.isWhitelisted,
        state: dto.state,
      });
      console.log("[DEBUG] UseCase received from Repo:", results);

      // Defensive check: Ensure results and its producer array exist and are arrays
      if (!results || !Array.isArray(results.producers)) {
        console.warn("[DEBUG] Repository returned a non-array or null/undefined result. Returning empty array.");
        return { producers: [], total: 0 };
      }

      return results;
    } catch (err) {
      console.error("[DEBUG] Unhandled exception in ListProducersUseCase:", err);
      // Re-throw to be caught by the global error handler, which will produce a 500
      throw err;
    }
  }
}
