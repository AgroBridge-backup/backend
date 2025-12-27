/**
 * Register Referral Use Case
 * Registers a new referral when a user signs up with a referral code
 */

import { randomUUID } from "crypto";
import { IReferralRepository } from "../../../domain/repositories/IReferralRepository.js";
import { Referral, ReferralStatus } from "../../../domain/entities/Referral.js";
import { ValidationError } from "../../../shared/errors/ValidationError.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";
import { ILogger } from "../../../domain/services/ILogger.js";

export interface RegisterReferralRequest {
  referralCode: string;
  referredUserId: string;
  ipAddress?: string;
  deviceFingerprint?: string;
}

export interface RegisterReferralResponse {
  referral: Referral;
  message: string;
}

export class RegisterReferralUseCase {
  constructor(
    private readonly referralRepository: IReferralRepository,
    private readonly logger?: ILogger,
  ) {}

  async execute(
    request: RegisterReferralRequest,
  ): Promise<RegisterReferralResponse> {
    if (!request.referralCode) {
      throw new ValidationError("Referral code is required");
    }
    if (!request.referredUserId) {
      throw new ValidationError("Referred user ID is required");
    }

    // Check if user was already referred
    const existingReferral = await this.referralRepository.findByReferredUser(
      request.referredUserId,
    );
    if (existingReferral) {
      throw new ValidationError("User has already been referred");
    }

    // Find the referrer by their code
    const userReferralCode =
      await this.referralRepository.findUserReferralCodeByCode(
        request.referralCode,
      );
    if (!userReferralCode) {
      throw new NotFoundError("Invalid referral code");
    }

    // Cannot refer yourself
    if (userReferralCode.userId === request.referredUserId) {
      throw new ValidationError("Cannot use your own referral code");
    }

    // Get current month for leaderboard grouping
    const now = new Date();
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const referralId = randomUUID();

    this.logger?.info("Registering new referral", {
      referralCode: request.referralCode,
      referrerId: userReferralCode.userId,
      referredId: request.referredUserId,
    });

    // Create the referral
    const referral = await this.referralRepository.create({
      id: referralId,
      referrerId: userReferralCode.userId,
      referredId: request.referredUserId,
      referralCode: request.referralCode,
      status: ReferralStatus.REGISTERED,
      monthYear,
      ipAddress: request.ipAddress,
      deviceFingerprint: request.deviceFingerprint,
    });

    // Update referrer's stats
    await this.referralRepository.updateUserReferralCodeStats(
      userReferralCode.userId,
      {
        totalReferrals: 1,
      },
    );

    this.logger?.info("Referral registered successfully", {
      referralId: referral.id,
      referrerId: referral.referrerId,
      referredId: referral.referredId,
    });

    return {
      referral,
      message: "Referral registered successfully",
    };
  }
}
