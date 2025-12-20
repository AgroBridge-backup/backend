// Developed by Alejandro Navarro Ayala - CEO & Senior Developer
import { IBatchRepository } from "../../../domain/repositories/IBatchRepository.js";
export class GetBatchHistoryUseCase {
  constructor(private readonly batchRepository: IBatchRepository) {}
  async execute(dto: any): Promise<any> {
    return [];
  }
}