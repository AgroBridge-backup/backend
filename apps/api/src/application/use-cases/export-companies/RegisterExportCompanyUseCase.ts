/**
 * Register Export Company Use Case
 * Creates a new B2B export company with 14-day trial
 */

import { ExportCompanyService } from "../../../domain/services/ExportCompanyService.js";
import {
  ExportCompany,
  ExportCompanyTier,
  CreateExportCompanyInput,
} from "../../../domain/entities/ExportCompany.js";
import { ValidationError } from "../../../shared/errors/ValidationError.js";
import { ILogger } from "../../../domain/services/ILogger.js";

export interface RegisterExportCompanyRequest {
  name: string;
  legalName?: string;
  rfc: string;
  email: string;
  phone?: string;
  country?: string;
  state?: string;
  city?: string;
  address?: string;
  postalCode?: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  tier?: ExportCompanyTier;
  enabledStandards?: string[];
  logoUrl?: string;
  primaryColor?: string;
}

export interface RegisterExportCompanyResponse {
  company: ExportCompany;
  trialEndsAt: Date;
  message: string;
}

export class RegisterExportCompanyUseCase {
  constructor(
    private readonly companyService: ExportCompanyService,
    private readonly logger?: ILogger,
  ) {}

  async execute(
    request: RegisterExportCompanyRequest,
  ): Promise<RegisterExportCompanyResponse> {
    // Validate required fields
    if (!request.name || request.name.trim().length < 2) {
      throw new ValidationError(
        "Company name is required (minimum 2 characters)",
      );
    }
    if (!request.rfc || request.rfc.length < 12) {
      throw new ValidationError("Valid RFC is required (12-13 characters)");
    }
    if (!request.email || !this.isValidEmail(request.email)) {
      throw new ValidationError("Valid email is required");
    }
    if (!request.contactName || request.contactName.trim().length < 2) {
      throw new ValidationError("Contact name is required");
    }
    if (!request.contactEmail || !this.isValidEmail(request.contactEmail)) {
      throw new ValidationError("Valid contact email is required");
    }

    this.logger?.info("Registering export company", {
      name: request.name,
      rfc: request.rfc,
      tier: request.tier || "STARTER",
    });

    const result = await this.companyService.registerCompany(request);

    this.logger?.info("Export company registered successfully", {
      companyId: result.company.id,
      trialEndsAt: result.trialEndsAt.toISOString(),
    });

    return {
      company: result.company,
      trialEndsAt: result.trialEndsAt,
      message: `Company registered successfully. Trial ends on ${result.trialEndsAt.toISOString().split("T")[0]}`,
    };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
