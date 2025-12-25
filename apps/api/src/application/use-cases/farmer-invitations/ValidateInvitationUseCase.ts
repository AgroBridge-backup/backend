/**
 * Validate Farmer Invitation Use Case
 * Validates an invitation token during farmer signup flow
 */

import { FarmerInvitationService } from '../../../domain/services/FarmerInvitationService.js';
import { FarmerInvitationWithCompany } from '../../../domain/entities/FarmerInvitation.js';
import { ValidationError } from '../../../shared/errors/ValidationError.js';

export interface ValidateInvitationRequest {
  token: string;
}

export interface ValidateInvitationResponse {
  valid: boolean;
  invitation?: FarmerInvitationWithCompany;
  reason?: string;
}

export class ValidateInvitationUseCase {
  constructor(private readonly invitationService: FarmerInvitationService) {}

  async execute(request: ValidateInvitationRequest): Promise<ValidateInvitationResponse> {
    if (!request.token) {
      throw new ValidationError('Invitation token is required');
    }

    const result = await this.invitationService.validateToken(request.token);

    return result;
  }
}
