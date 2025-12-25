/**
 * Get Export Company Use Case
 * Retrieves an export company by ID with usage statistics
 */

import { ExportCompanyService } from '../../../domain/services/ExportCompanyService.js';
import { ExportCompanyWithStats } from '../../../domain/entities/ExportCompany.js';
import { ValidationError } from '../../../shared/errors/ValidationError.js';

export interface GetExportCompanyRequest {
  companyId: string;
  includeStats?: boolean;
}

export interface GetExportCompanyResponse {
  company: ExportCompanyWithStats;
}

export class GetExportCompanyUseCase {
  constructor(private readonly companyService: ExportCompanyService) {}

  async execute(request: GetExportCompanyRequest): Promise<GetExportCompanyResponse> {
    if (!request.companyId) {
      throw new ValidationError('Company ID is required');
    }

    const company = await this.companyService.getCompanyWithStats(request.companyId);

    return { company };
  }
}
