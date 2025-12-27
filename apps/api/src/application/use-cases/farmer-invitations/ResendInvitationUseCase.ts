/**
 * Resend Farmer Invitation Use Case
 * Resends an invitation with a new token
 */

import { FarmerInvitationService } from "../../../domain/services/FarmerInvitationService.js";
import { FarmerInvitation } from "../../../domain/entities/FarmerInvitation.js";
import { ValidationError } from "../../../shared/errors/ValidationError.js";
import { ILogger } from "../../../domain/services/ILogger.js";

export interface ResendInvitationRequest {
  invitationId: string;
  exportCompanyId: string;
  baseUrl: string;
}

export interface ResendInvitationResponse {
  invitation: FarmerInvitation;
  signupUrl: string;
  message: string;
}

export class ResendInvitationUseCase {
  constructor(
    private readonly invitationService: FarmerInvitationService,
    private readonly logger?: ILogger,
  ) {}

  async execute(
    request: ResendInvitationRequest,
  ): Promise<ResendInvitationResponse> {
    if (!request.invitationId) {
      throw new ValidationError("Invitation ID is required");
    }
    if (!request.exportCompanyId) {
      throw new ValidationError("Export company ID is required");
    }
    if (!request.baseUrl) {
      throw new ValidationError("Base URL is required");
    }

    this.logger?.info("Resending farmer invitation", {
      invitationId: request.invitationId,
    });

    const result = await this.invitationService.resendInvitation(
      request.invitationId,
      request.exportCompanyId,
      request.baseUrl,
    );

    return {
      invitation: result.invitation,
      signupUrl: result.signupUrl,
      message: "Invitation resent successfully. Valid for 7 days.",
    };
  }
}
