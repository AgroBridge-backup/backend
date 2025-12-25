/**
 * Register Organic Field Use Case
 * Creates a new organic field for a producer
 */

import { OrganicFieldService } from '../../../domain/services/OrganicFieldService.js';
import { OrganicField, CreateOrganicFieldInput } from '../../../domain/entities/OrganicField.js';
import { ValidationError } from '../../../shared/errors/ValidationError.js';
import { ILogger } from '../../../domain/services/ILogger.js';

export interface RegisterOrganicFieldRequest {
  producerId: string;
  baseFieldId?: string;
  name: string;
  localIdentifier?: string;
  cropType: string;
  variety?: string;
  areaHectares: number;
  boundaryGeoJson: string;
  centerLat: number;
  centerLng: number;
  altitude?: number;
  organicSince?: Date;
  lastConventional?: Date;
  waterSources?: string[];
  irrigationType?: string;
  soilType?: string;
  lastSoilTestDate?: Date;
  certifiedStandards?: string[];
}

export interface RegisterOrganicFieldResponse {
  field: OrganicField;
  transitionEndDate?: Date;
  message: string;
}

export class RegisterOrganicFieldUseCase {
  constructor(
    private readonly fieldService: OrganicFieldService,
    private readonly logger?: ILogger
  ) {}

  async execute(request: RegisterOrganicFieldRequest): Promise<RegisterOrganicFieldResponse> {
    // Validate required fields
    if (!request.producerId) {
      throw new ValidationError('Producer ID is required');
    }
    if (!request.name || request.name.trim().length < 2) {
      throw new ValidationError('Field name is required (minimum 2 characters)');
    }
    if (!request.cropType) {
      throw new ValidationError('Crop type is required');
    }
    if (!request.areaHectares || request.areaHectares <= 0) {
      throw new ValidationError('Area must be greater than 0 hectares');
    }
    if (!request.boundaryGeoJson) {
      throw new ValidationError('Field boundary (GeoJSON) is required');
    }

    this.logger?.info('Registering organic field', {
      producerId: request.producerId,
      name: request.name,
      cropType: request.cropType,
    });

    const result = await this.fieldService.registerField(request);

    this.logger?.info('Organic field registered', {
      fieldId: result.field.id,
      status: result.field.certificationStatus,
    });

    let message = `Field "${result.field.name}" registered successfully.`;
    if (result.transitionEndDate) {
      message += ` Transition period ends on ${result.transitionEndDate.toISOString().split('T')[0]}.`;
    }

    return {
      field: result.field,
      transitionEndDate: result.transitionEndDate,
      message,
    };
  }
}
