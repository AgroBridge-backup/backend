/**
 * Get Organic Field Use Case
 * Retrieves an organic field by ID with statistics
 */

import { OrganicFieldService } from '../../../domain/services/OrganicFieldService.js';
import { OrganicFieldWithStats } from '../../../domain/entities/OrganicField.js';
import { ValidationError } from '../../../shared/errors/ValidationError.js';

export interface GetOrganicFieldRequest {
  fieldId: string;
}

export interface GetOrganicFieldResponse {
  field: OrganicFieldWithStats;
}

export class GetOrganicFieldUseCase {
  constructor(private readonly fieldService: OrganicFieldService) {}

  async execute(request: GetOrganicFieldRequest): Promise<GetOrganicFieldResponse> {
    if (!request.fieldId) {
      throw new ValidationError('Field ID is required');
    }

    const field = await this.fieldService.getFieldWithStats(request.fieldId);

    return { field };
  }
}
