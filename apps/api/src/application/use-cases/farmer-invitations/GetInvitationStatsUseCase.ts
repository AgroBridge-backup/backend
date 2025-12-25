/**
 * Get Invitation Stats Use Case
 * Gets invitation statistics for an export company
 */

import { FarmerInvitationService } from '../../../domain/services/FarmerInvitationService.js';
import { ValidationError } from '../../../shared/errors/ValidationError.js';

export interface GetInvitationStatsRequest {
  exportCompanyId: string;
}

export interface GetInvitationStatsResponse {
  pending: number;
  accepted: number;
  expired: number;
  cancelled: number;
  total: number;
  conversionRate: number;
}

export class GetInvitationStatsUseCase {
  constructor(private readonly invitationService: FarmerInvitationService) {}

  async execute(request: GetInvitationStatsRequest): Promise<GetInvitationStatsResponse> {
    if (!request.exportCompanyId) {
      throw new ValidationError('Export company ID is required');
    }

    const stats = await this.invitationService.getInvitationStats(request.exportCompanyId);

    // Calculate conversion rate (accepted / total sent)
    const conversionRate = stats.total > 0
      ? Math.round((stats.accepted / stats.total) * 100 * 100) / 100
      : 0;

    return {
      ...stats,
      conversionRate,
    };
  }
}
