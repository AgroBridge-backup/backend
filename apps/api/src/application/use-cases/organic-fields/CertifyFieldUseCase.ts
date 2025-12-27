/**
 * Certify Field Use Case
 * Transitions a field to certified status with specified standards
 */

import { OrganicFieldService } from "../../../domain/services/OrganicFieldService.js";
import { OrganicField } from "../../../domain/entities/OrganicField.js";
import { ValidationError } from "../../../shared/errors/ValidationError.js";
import { ILogger } from "../../../domain/services/ILogger.js";

export interface CertifyFieldRequest {
  fieldId: string;
  standards: string[];
}

export interface CertifyFieldResponse {
  field: OrganicField;
  message: string;
}

export class CertifyFieldUseCase {
  constructor(
    private readonly fieldService: OrganicFieldService,
    private readonly logger?: ILogger,
  ) {}

  async execute(request: CertifyFieldRequest): Promise<CertifyFieldResponse> {
    if (!request.fieldId) {
      throw new ValidationError("Field ID is required");
    }
    if (!request.standards || request.standards.length === 0) {
      throw new ValidationError(
        "At least one certification standard is required",
      );
    }

    // Validate standards
    const validStandards = ["ORGANIC_USDA", "ORGANIC_EU", "SENASICA"];
    for (const standard of request.standards) {
      if (!validStandards.includes(standard)) {
        throw new ValidationError(
          `Invalid standard: ${standard}. Valid: ${validStandards.join(", ")}`,
        );
      }
    }

    this.logger?.info("Certifying organic field", {
      fieldId: request.fieldId,
      standards: request.standards.join(","),
    });

    const field = await this.fieldService.certifyField(
      request.fieldId,
      request.standards,
    );

    return {
      field,
      message: `Field certified with standards: ${request.standards.join(", ")}`,
    };
  }
}
