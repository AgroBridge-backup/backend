/**
 * FarmerInvitation Domain Entity
 * B2B2C enrollment flow: Export Company invites farmers to join the platform
 * Farmers receive email/SMS with signup link containing invite token
 */

export enum FarmerInvitationStatus {
  PENDING = 'PENDING',     // Invitation sent, awaiting farmer action
  ACCEPTED = 'ACCEPTED',   // Farmer completed registration
  EXPIRED = 'EXPIRED',     // Invitation expired (7 days default)
  CANCELLED = 'CANCELLED', // Export company cancelled the invitation
}

export interface FarmerInvitation {
  id: string;

  // Export company that sent the invitation
  exportCompanyId: string;

  // Invitation details
  email: string;
  phone?: string | null;
  farmerName?: string | null;

  // Security token for signup link
  inviteToken: string;

  // Status
  status: FarmerInvitationStatus;

  // Result - set when farmer registers
  farmerId?: string | null;

  // Timestamps
  sentAt: Date;
  expiresAt: Date;
  acceptedAt?: Date | null;
  createdAt: Date;
}

export interface CreateFarmerInvitationInput {
  exportCompanyId: string;
  email: string;
  phone?: string;
  farmerName?: string;
}

export interface FarmerInvitationFilter {
  exportCompanyId?: string;
  status?: FarmerInvitationStatus;
  email?: string;
  limit?: number;
  offset?: number;
}

export interface FarmerInvitationWithCompany extends FarmerInvitation {
  exportCompany: {
    id: string;
    name: string;
    logoUrl?: string | null;
    primaryColor?: string | null;
  };
}

// Default invitation expiry in days
export const INVITATION_EXPIRY_DAYS = 7;
