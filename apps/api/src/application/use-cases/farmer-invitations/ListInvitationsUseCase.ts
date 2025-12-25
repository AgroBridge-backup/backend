/**
 * List Farmer Invitations Use Case
 * Lists invitations for an export company with filtering
 */

import { FarmerInvitationService } from '../../../domain/services/FarmerInvitationService.js';
import { FarmerInvitation, FarmerInvitationStatus } from '../../../domain/entities/FarmerInvitation.js';
import { ValidationError } from '../../../shared/errors/ValidationError.js';

export interface ListInvitationsRequest {
  exportCompanyId: string;
  status?: FarmerInvitationStatus;
  email?: string;
  limit?: number;
  offset?: number;
}

export interface ListInvitationsResponse {
  invitations: FarmerInvitation[];
  total: number;
  limit: number;
  offset: number;
}

export class ListInvitationsUseCase {
  constructor(private readonly invitationService: FarmerInvitationService) {}

  async execute(request: ListInvitationsRequest): Promise<ListInvitationsResponse> {
    if (!request.exportCompanyId) {
      throw new ValidationError('Export company ID is required');
    }

    const limit = Math.min(request.limit || 20, 100);
    const offset = request.offset || 0;

    const result = await this.invitationService.listInvitations(request.exportCompanyId, {
      status: request.status,
      email: request.email,
      limit,
      offset,
    });

    return {
      invitations: result.invitations,
      total: result.total,
      limit,
      offset,
    };
  }
}
