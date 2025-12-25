/**
 * Update Export Company Use Case
 * Updates export company details
 */

import { ExportCompanyService } from '../../../domain/services/ExportCompanyService.js';
import { ExportCompany, ExportCompanyTier, UpdateExportCompanyInput } from '../../../domain/entities/ExportCompany.js';
import { ValidationError } from '../../../shared/errors/ValidationError.js';
import { ILogger } from '../../../domain/services/ILogger.js';

export interface UpdateExportCompanyRequest {
  companyId: string;
  name?: string;
  legalName?: string;
  email?: string;
  phone?: string;
  state?: string;
  city?: string;
  address?: string;
  postalCode?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  enabledStandards?: string[];
  logoUrl?: string;
  primaryColor?: string;
}

export interface UpdateExportCompanyResponse {
  company: ExportCompany;
  message: string;
}

export class UpdateExportCompanyUseCase {
  constructor(
    private readonly companyService: ExportCompanyService,
    private readonly logger?: ILogger
  ) {}

  async execute(request: UpdateExportCompanyRequest): Promise<UpdateExportCompanyResponse> {
    if (!request.companyId) {
      throw new ValidationError('Company ID is required');
    }

    // Validate email if provided
    if (request.email && !this.isValidEmail(request.email)) {
      throw new ValidationError('Invalid email format');
    }
    if (request.contactEmail && !this.isValidEmail(request.contactEmail)) {
      throw new ValidationError('Invalid contact email format');
    }

    // Validate hex color if provided
    if (request.primaryColor && !this.isValidHexColor(request.primaryColor)) {
      throw new ValidationError('Primary color must be a valid hex color (e.g., #22C55E)');
    }

    this.logger?.info('Updating export company', { companyId: request.companyId });

    const { companyId, ...updateData } = request;
    const company = await this.companyService.updateCompany(companyId, updateData);

    this.logger?.info('Export company updated', { companyId: company.id });

    return {
      company,
      message: 'Company updated successfully',
    };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidHexColor(color: string): boolean {
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    return hexRegex.test(color);
  }
}
