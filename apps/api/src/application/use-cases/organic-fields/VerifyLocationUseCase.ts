/**
 * Verify Location Use Case
 * Verifies if a GPS location is within a field's boundary
 */

import { OrganicFieldService } from "../../../domain/services/OrganicFieldService.js";
import { ValidationError } from "../../../shared/errors/ValidationError.js";

export interface VerifyLocationRequest {
  fieldId: string;
  latitude: number;
  longitude: number;
}

export interface VerifyLocationResponse {
  isWithinBoundary: boolean;
  distanceFromCenter: number;
  message: string;
}

export class VerifyLocationUseCase {
  constructor(private readonly fieldService: OrganicFieldService) {}

  async execute(
    request: VerifyLocationRequest,
  ): Promise<VerifyLocationResponse> {
    if (!request.fieldId) {
      throw new ValidationError("Field ID is required");
    }
    if (request.latitude === undefined || request.longitude === undefined) {
      throw new ValidationError("Latitude and longitude are required");
    }
    if (request.latitude < -90 || request.latitude > 90) {
      throw new ValidationError("Latitude must be between -90 and 90");
    }
    if (request.longitude < -180 || request.longitude > 180) {
      throw new ValidationError("Longitude must be between -180 and 180");
    }

    const result = await this.fieldService.verifyLocationWithinField(
      request.fieldId,
      request.latitude,
      request.longitude,
    );

    return {
      isWithinBoundary: result.isWithin,
      distanceFromCenter: result.distanceFromCenter || 0,
      message: result.isWithin
        ? "Location verified within field boundary"
        : "Location is outside field boundary",
    };
  }
}
