/**
 * Get Producer Field Stats Use Case
 * Gets aggregated statistics for a producer's organic fields
 */

import { OrganicFieldService } from "../../../domain/services/OrganicFieldService.js";
import { OrganicFieldStatus } from "../../../domain/entities/OrganicField.js";
import { ValidationError } from "../../../shared/errors/ValidationError.js";

export interface GetProducerFieldStatsRequest {
  producerId: string;
}

export interface GetProducerFieldStatsResponse {
  totalFields: number;
  totalHectares: number;
  byStatus: Record<OrganicFieldStatus, number>;
  byCropType: Record<string, number>;
}

export class GetProducerFieldStatsUseCase {
  constructor(private readonly fieldService: OrganicFieldService) {}

  async execute(
    request: GetProducerFieldStatsRequest,
  ): Promise<GetProducerFieldStatsResponse> {
    if (!request.producerId) {
      throw new ValidationError("Producer ID is required");
    }

    return this.fieldService.getProducerFieldStats(request.producerId);
  }
}
