/**
 * List Producer Fields Use Case
 * Lists organic fields for a producer with filtering
 */

import { OrganicFieldService } from "../../../domain/services/OrganicFieldService.js";
import {
  OrganicField,
  OrganicFieldStatus,
} from "../../../domain/entities/OrganicField.js";
import { ValidationError } from "../../../shared/errors/ValidationError.js";

export interface ListProducerFieldsRequest {
  producerId: string;
  certificationStatus?: OrganicFieldStatus;
  cropType?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

export interface ListProducerFieldsResponse {
  fields: OrganicField[];
  total: number;
  limit: number;
  offset: number;
}

export class ListProducerFieldsUseCase {
  constructor(private readonly fieldService: OrganicFieldService) {}

  async execute(
    request: ListProducerFieldsRequest,
  ): Promise<ListProducerFieldsResponse> {
    if (!request.producerId) {
      throw new ValidationError("Producer ID is required");
    }

    const limit = Math.min(request.limit || 20, 100);
    const offset = request.offset || 0;

    const result = await this.fieldService.listProducerFields(
      request.producerId,
      {
        certificationStatus: request.certificationStatus,
        cropType: request.cropType,
        isActive: request.isActive,
        limit,
        offset,
      },
    );

    return {
      fields: result.fields,
      total: result.total,
      limit,
      offset,
    };
  }
}
