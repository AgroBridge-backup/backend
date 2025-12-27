/**
 * List Export Companies Use Case
 * Lists export companies with filtering and pagination
 */

import { ExportCompanyService } from "../../../domain/services/ExportCompanyService.js";
import {
  ExportCompany,
  ExportCompanyStatus,
  ExportCompanyTier,
} from "../../../domain/entities/ExportCompany.js";

export interface ListExportCompaniesRequest {
  status?: ExportCompanyStatus;
  tier?: ExportCompanyTier;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListExportCompaniesResponse {
  companies: ExportCompany[];
  total: number;
  limit: number;
  offset: number;
}

export class ListExportCompaniesUseCase {
  constructor(private readonly companyService: ExportCompanyService) {}

  async execute(
    request: ListExportCompaniesRequest,
  ): Promise<ListExportCompaniesResponse> {
    const limit = Math.min(request.limit || 20, 100);
    const offset = request.offset || 0;

    const result = await this.companyService.listCompanies({
      status: request.status,
      tier: request.tier,
      search: request.search,
      limit,
      offset,
    });

    return {
      companies: result.companies,
      total: result.total,
      limit,
      offset,
    };
  }
}
