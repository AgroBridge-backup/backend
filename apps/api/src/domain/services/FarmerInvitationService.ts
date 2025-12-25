/**
 * FarmerInvitation Domain Service
 * Business logic for B2B2C farmer enrollment flow
 * Export companies invite farmers → farmers receive email → farmers register
 */

import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../../shared/errors/AppError.js';
import { IFarmerInvitationRepository } from '../repositories/IFarmerInvitationRepository.js';
import { IExportCompanyRepository } from '../repositories/IExportCompanyRepository.js';
import {
  FarmerInvitation,
  FarmerInvitationFilter,
  FarmerInvitationStatus,
  FarmerInvitationWithCompany,
  CreateFarmerInvitationInput,
  INVITATION_EXPIRY_DAYS,
} from '../entities/FarmerInvitation.js';
import { ExportCompanyStatus } from '../entities/ExportCompany.js';
import logger from '../../shared/utils/logger.js';

export interface SendInvitationResult {
  invitation: FarmerInvitation;
  signupUrl: string;
}

export interface ValidateTokenResult {
  valid: boolean;
  invitation?: FarmerInvitationWithCompany;
  reason?: string;
}

export class FarmerInvitationService {
  constructor(
    private invitationRepository: IFarmerInvitationRepository,
    private companyRepository: IExportCompanyRepository
  ) {}

  /**
   * Send a new invitation to a farmer
   */
  async sendInvitation(input: CreateFarmerInvitationInput, baseUrl: string): Promise<SendInvitationResult> {
    // Validate email format
    if (!this.isValidEmail(input.email)) {
      throw new AppError('Invalid email format', 400);
    }

    // Check company exists and is active
    const company = await this.companyRepository.findById(input.exportCompanyId);
    if (!company) {
      throw new AppError('Export company not found', 404);
    }

    if (company.status === ExportCompanyStatus.SUSPENDED) {
      throw new AppError('Company subscription is suspended', 403);
    }

    if (company.status === ExportCompanyStatus.CANCELLED) {
      throw new AppError('Company subscription is cancelled', 403);
    }

    // Check trial expiry
    if (company.status === ExportCompanyStatus.TRIAL && company.trialEndsAt) {
      if (new Date() > company.trialEndsAt) {
        throw new AppError('Company trial has expired', 403);
      }
    }

    // Check capacity
    const hasCapacity = await this.companyRepository.hasCapacityForFarmers(input.exportCompanyId);
    if (!hasCapacity) {
      throw new AppError('Company has reached farmer limit for current tier', 403);
    }

    // Check if farmer already has pending invitation
    const hasPending = await this.invitationRepository.hasPendingInvitation(
      input.email,
      input.exportCompanyId
    );
    if (hasPending) {
      throw new AppError('An invitation is already pending for this email', 409);
    }

    // Generate invite token and expiry date
    const inviteToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

    const invitation = await this.invitationRepository.create({
      id: uuidv4(),
      exportCompanyId: input.exportCompanyId,
      email: input.email.toLowerCase(),
      phone: input.phone,
      farmerName: input.farmerName,
      inviteToken,
      status: FarmerInvitationStatus.PENDING,
      expiresAt,
    });

    // Generate signup URL
    const signupUrl = `${baseUrl}/signup?token=${inviteToken}`;

    logger.info(`Farmer invitation sent: ${invitation.id} to ${invitation.email}`);

    return { invitation, signupUrl };
  }

  /**
   * Validate an invitation token (for signup flow)
   */
  async validateToken(token: string): Promise<ValidateTokenResult> {
    const invitation = await this.invitationRepository.findByToken(token);

    if (!invitation) {
      return { valid: false, reason: 'Invalid invitation token' };
    }

    if (invitation.status === FarmerInvitationStatus.ACCEPTED) {
      return { valid: false, reason: 'Invitation has already been accepted' };
    }

    if (invitation.status === FarmerInvitationStatus.CANCELLED) {
      return { valid: false, reason: 'Invitation has been cancelled' };
    }

    if (invitation.status === FarmerInvitationStatus.EXPIRED || new Date() > invitation.expiresAt) {
      return { valid: false, reason: 'Invitation has expired' };
    }

    return { valid: true, invitation };
  }

  /**
   * Accept an invitation (called during farmer registration)
   */
  async acceptInvitation(token: string, farmerId: string): Promise<FarmerInvitation> {
    const validation = await this.validateToken(token);
    if (!validation.valid) {
      throw new AppError(validation.reason || 'Invalid invitation', 400);
    }

    const invitation = validation.invitation!;

    logger.info(`Farmer invitation accepted: ${invitation.id} by farmer ${farmerId}`);

    return this.invitationRepository.accept(invitation.id, farmerId);
  }

  /**
   * Cancel an invitation
   */
  async cancelInvitation(id: string, companyId: string): Promise<FarmerInvitation> {
    const invitation = await this.invitationRepository.findById(id);

    if (!invitation) {
      throw new AppError('Invitation not found', 404);
    }

    if (invitation.exportCompanyId !== companyId) {
      throw new AppError('Not authorized to cancel this invitation', 403);
    }

    if (invitation.status !== FarmerInvitationStatus.PENDING) {
      throw new AppError('Only pending invitations can be cancelled', 400);
    }

    logger.info(`Farmer invitation cancelled: ${id}`);

    return this.invitationRepository.cancel(id);
  }

  /**
   * Resend an invitation with new token
   */
  async resendInvitation(id: string, companyId: string, baseUrl: string): Promise<SendInvitationResult> {
    const invitation = await this.invitationRepository.findById(id);

    if (!invitation) {
      throw new AppError('Invitation not found', 404);
    }

    if (invitation.exportCompanyId !== companyId) {
      throw new AppError('Not authorized to resend this invitation', 403);
    }

    if (invitation.status === FarmerInvitationStatus.ACCEPTED) {
      throw new AppError('Cannot resend accepted invitation', 400);
    }

    // Check company is still active
    const company = await this.companyRepository.findById(companyId);
    if (!company || company.status === ExportCompanyStatus.CANCELLED) {
      throw new AppError('Company is not active', 403);
    }

    // Generate new token and expiry
    const newToken = uuidv4();
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + INVITATION_EXPIRY_DAYS);

    const updatedInvitation = await this.invitationRepository.resend(id, newToken, newExpiresAt);
    const signupUrl = `${baseUrl}/signup?token=${newToken}`;

    logger.info(`Farmer invitation resent: ${id}`);

    return { invitation: updatedInvitation, signupUrl };
  }

  /**
   * List invitations for a company
   */
  async listInvitations(
    companyId: string,
    filter?: Omit<FarmerInvitationFilter, 'exportCompanyId'>
  ): Promise<{ invitations: FarmerInvitation[]; total: number }> {
    return this.invitationRepository.listByCompany(companyId, filter);
  }

  /**
   * Get invitation by ID
   */
  async getInvitation(id: string, companyId: string): Promise<FarmerInvitation> {
    const invitation = await this.invitationRepository.findById(id);

    if (!invitation) {
      throw new AppError('Invitation not found', 404);
    }

    if (invitation.exportCompanyId !== companyId) {
      throw new AppError('Not authorized to view this invitation', 403);
    }

    return invitation;
  }

  /**
   * Mark expired invitations (for cron job)
   */
  async processExpiredInvitations(): Promise<number> {
    const count = await this.invitationRepository.markExpired();
    if (count > 0) {
      logger.info(`Marked ${count} invitations as expired`);
    }
    return count;
  }

  /**
   * Get invitation statistics for a company
   */
  async getInvitationStats(companyId: string): Promise<{
    pending: number;
    accepted: number;
    expired: number;
    cancelled: number;
    total: number;
  }> {
    const [pending, accepted, expired, cancelled] = await Promise.all([
      this.invitationRepository.list({ exportCompanyId: companyId, status: FarmerInvitationStatus.PENDING, limit: 0 }),
      this.invitationRepository.list({ exportCompanyId: companyId, status: FarmerInvitationStatus.ACCEPTED, limit: 0 }),
      this.invitationRepository.list({ exportCompanyId: companyId, status: FarmerInvitationStatus.EXPIRED, limit: 0 }),
      this.invitationRepository.list({ exportCompanyId: companyId, status: FarmerInvitationStatus.CANCELLED, limit: 0 }),
    ]);

    return {
      pending: pending.total,
      accepted: accepted.total,
      expired: expired.total,
      cancelled: cancelled.total,
      total: pending.total + accepted.total + expired.total + cancelled.total,
    };
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
