/**
 * Cancel Farmer Invitation Use Case
 * Cancels a pending invitation
 */

import { FarmerInvitationService } from '../../../domain/services/FarmerInvitationService.js';
import { FarmerInvitation } from '../../../domain/entities/FarmerInvitation.js';
import { ValidationError } from '../../../shared/errors/ValidationError.js';
import { ILogger } from '../../../domain/services/ILogger.js';

export interface CancelInvitationRequest {
  invitationId: string;
  exportCompanyId: string;
}

export interface CancelInvitationResponse {
  invitation: FarmerInvitation;
  message: string;
}

export class CancelInvitationUseCase {
  constructor(
    private readonly invitationService: FarmerInvitationService,
    private readonly logger?: ILogger
  ) {}

  async execute(request: CancelInvitationRequest): Promise<CancelInvitationResponse> {
    if (!request.invitationId) {
      throw new ValidationError('Invitation ID is required');
    }
    if (!request.exportCompanyId) {
      throw new ValidationError('Export company ID is required');
    }

    this.logger?.info('Cancelling farmer invitation', {
      invitationId: request.invitationId,
    });

    const invitation = await this.invitationService.cancelInvitation(
      request.invitationId,
      request.exportCompanyId
    );

    return {
      invitation,
      message: 'Invitation cancelled successfully',
    };
  }
}
