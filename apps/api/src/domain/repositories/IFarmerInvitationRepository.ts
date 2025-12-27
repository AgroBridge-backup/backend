/**
 * FarmerInvitation Repository Interface
 * Defines the contract for farmer invitation data access
 */

import {
  FarmerInvitation,
  FarmerInvitationFilter,
  FarmerInvitationStatus,
  FarmerInvitationWithCompany,
} from "../entities/FarmerInvitation.js";

export interface CreateFarmerInvitationData {
  id: string;
  exportCompanyId: string;
  email: string;
  phone?: string;
  farmerName?: string;
  inviteToken: string;
  status: FarmerInvitationStatus;
  expiresAt: Date;
}

export interface FarmerInvitationListResult {
  invitations: FarmerInvitation[];
  total: number;
}

export interface IFarmerInvitationRepository {
  /**
   * Create a new farmer invitation
   */
  create(data: CreateFarmerInvitationData): Promise<FarmerInvitation>;

  /**
   * Find invitation by ID
   */
  findById(id: string): Promise<FarmerInvitation | null>;

  /**
   * Find invitation by token (for signup flow)
   */
  findByToken(token: string): Promise<FarmerInvitationWithCompany | null>;

  /**
   * Find invitation by email for a specific company
   */
  findByEmailAndCompany(
    email: string,
    exportCompanyId: string,
  ): Promise<FarmerInvitation | null>;

  /**
   * List invitations with filtering
   */
  list(filter: FarmerInvitationFilter): Promise<FarmerInvitationListResult>;

  /**
   * List invitations for a company
   */
  listByCompany(
    exportCompanyId: string,
    filter?: Omit<FarmerInvitationFilter, "exportCompanyId">,
  ): Promise<FarmerInvitationListResult>;

  /**
   * Mark invitation as accepted and link to farmer
   */
  accept(id: string, farmerId: string): Promise<FarmerInvitation>;

  /**
   * Cancel invitation
   */
  cancel(id: string): Promise<FarmerInvitation>;

  /**
   * Mark expired invitations (batch operation for cron job)
   */
  markExpired(): Promise<number>;

  /**
   * Resend invitation (update token and expiry)
   */
  resend(
    id: string,
    newToken: string,
    newExpiresAt: Date,
  ): Promise<FarmerInvitation>;

  /**
   * Count pending invitations for a company
   */
  countPending(exportCompanyId: string): Promise<number>;

  /**
   * Check if email already has pending invitation for company
   */
  hasPendingInvitation(
    email: string,
    exportCompanyId: string,
  ): Promise<boolean>;
}
