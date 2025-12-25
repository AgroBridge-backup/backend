/**
 * Check Capacity Use Case
 * Checks if an export company has capacity for more farmers or certificates
 */

import { ExportCompanyService } from '../../../domain/services/ExportCompanyService.js';
import { ValidationError } from '../../../shared/errors/ValidationError.js';

export interface CheckCapacityRequest {
  companyId: string;
}

export interface CheckCapacityResponse {
  companyId: string;
  farmers: {
    canEnroll: boolean;
    reason?: string;
    currentCount: number;
    limit: number;
    percentUsed: number;
  };
  certificates: {
    canIssue: boolean;
    reason?: string;
    currentCount: number;
    limit: number;
    percentUsed: number;
  };
}

export class CheckCapacityUseCase {
  constructor(private readonly companyService: ExportCompanyService) {}

  async execute(request: CheckCapacityRequest): Promise<CheckCapacityResponse> {
    if (!request.companyId) {
      throw new ValidationError('Company ID is required');
    }

    const [farmerCapacity, certCapacity] = await Promise.all([
      this.companyService.canEnrollFarmer(request.companyId),
      this.companyService.canIssueCertificate(request.companyId),
    ]);

    return {
      companyId: request.companyId,
      farmers: {
        canEnroll: farmerCapacity.canEnroll,
        reason: farmerCapacity.reason,
        currentCount: farmerCapacity.currentCount,
        limit: farmerCapacity.limit,
        percentUsed: farmerCapacity.limit === -1 ? 0 : Math.round((farmerCapacity.currentCount / farmerCapacity.limit) * 100),
      },
      certificates: {
        canIssue: certCapacity.canIssue,
        reason: certCapacity.reason,
        currentCount: certCapacity.currentCount,
        limit: certCapacity.limit,
        percentUsed: certCapacity.limit === -1 ? 0 : Math.round((certCapacity.currentCount / certCapacity.limit) * 100),
      },
    };
  }
}
