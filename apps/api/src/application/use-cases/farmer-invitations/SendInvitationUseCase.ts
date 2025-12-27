/**
 * Send Farmer Invitation Use Case
 * Sends an invitation email to a farmer to join the export company
 */

import { FarmerInvitationService } from "../../../domain/services/FarmerInvitationService.js";
import { FarmerInvitation } from "../../../domain/entities/FarmerInvitation.js";
import { ValidationError } from "../../../shared/errors/ValidationError.js";
import { ILogger } from "../../../domain/services/ILogger.js";

export interface SendInvitationRequest {
  exportCompanyId: string;
  email: string;
  phone?: string;
  farmerName?: string;
  baseUrl: string;
}

export interface SendInvitationResponse {
  invitation: FarmerInvitation;
  signupUrl: string;
  message: string;
}

export class SendInvitationUseCase {
  constructor(
    private readonly invitationService: FarmerInvitationService,
    private readonly logger?: ILogger,
  ) {}

  async execute(
    request: SendInvitationRequest,
  ): Promise<SendInvitationResponse> {
    // Validate required fields
    if (!request.exportCompanyId) {
      throw new ValidationError("Export company ID is required");
    }
    if (!request.email) {
      throw new ValidationError("Email is required");
    }
    if (!request.baseUrl) {
      throw new ValidationError("Base URL is required");
    }

    this.logger?.info("Sending farmer invitation", {
      exportCompanyId: request.exportCompanyId,
      email: request.email,
    });

    const result = await this.invitationService.sendInvitation(
      {
        exportCompanyId: request.exportCompanyId,
        email: request.email,
        phone: request.phone,
        farmerName: request.farmerName,
      },
      request.baseUrl,
    );

    this.logger?.info("Farmer invitation sent", {
      invitationId: result.invitation.id,
    });

    return {
      invitation: result.invitation,
      signupUrl: result.signupUrl,
      message: `Invitation sent to ${request.email}. Valid for 7 days.`,
    };
  }
}
