/**
 * Update Organic Field Use Case
 * Updates an organic field's details
 */

import { OrganicFieldService } from '../../../domain/services/OrganicFieldService.js';
import { OrganicField, UpdateOrganicFieldInput } from '../../../domain/entities/OrganicField.js';
import { ValidationError } from '../../../shared/errors/ValidationError.js';
import { ILogger } from '../../../domain/services/ILogger.js';

export interface UpdateOrganicFieldRequest {
  fieldId: string;
  name?: string;
  localIdentifier?: string;
  cropType?: string;
  variety?: string;
  areaHectares?: number;
  boundaryGeoJson?: string;
  centerLat?: number;
  centerLng?: number;
  altitude?: number;
  waterSources?: string[];
  irrigationType?: string;
  soilType?: string;
  lastSoilTestDate?: Date;
}

export interface UpdateOrganicFieldResponse {
  field: OrganicField;
  message: string;
}

export class UpdateOrganicFieldUseCase {
  constructor(
    private readonly fieldService: OrganicFieldService,
    private readonly logger?: ILogger
  ) {}

  async execute(request: UpdateOrganicFieldRequest): Promise<UpdateOrganicFieldResponse> {
    if (!request.fieldId) {
      throw new ValidationError('Field ID is required');
    }

    this.logger?.info('Updating organic field', { fieldId: request.fieldId });

    const { fieldId, ...updateData } = request;
    const field = await this.fieldService.updateField(fieldId, updateData);

    return {
      field,
      message: 'Field updated successfully',
    };
  }
}
