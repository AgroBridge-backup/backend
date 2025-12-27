// Developed by Alejandro Navarro Ayala - CEO & Senior Developer
import { IBatchRepository } from "../../../domain/repositories/IBatchRepository.js";
export class GetBatchByNumberUseCase {
  constructor(private readonly batchRepository: IBatchRepository) {}
  async execute(dto: any): Promise<any> {
    return { id: "dummy-batch-id", batchNumber: dto.batchNumber };
  }
}
