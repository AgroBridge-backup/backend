/**
 * Referrals Routes
 * RESTful API endpoints for referral management
 */

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { PrismaReferralRepository } from "../../infrastructure/database/prisma/repositories/PrismaReferralRepository.js";
import {
  RegisterReferralUseCase,
  GetReferralStatsUseCase,
  MarkReferralRewardedUseCase,
} from "../../application/use-cases/referrals/index.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { RateLimiterConfig } from "../../infrastructure/http/middleware/rate-limiter.middleware.js";
import { logger } from "../../infrastructure/logging/logger.js";

// Validation schemas
const registerReferralSchema = z.object({
  referralCode: z.string().min(1).max(20),
  referredUserId: z.string().uuid(),
});

const markRewardedSchema = z.object({
  rewardTxHash: z.string().optional(),
});

/**
 * Factory function to create referrals router with dependencies
 */
export default function createReferralsRouter(prisma: PrismaClient): Router {
  const router = Router();

  // Initialize repository and use cases
  const referralRepository = new PrismaReferralRepository(prisma);
  const registerReferralUseCase = new RegisterReferralUseCase(
    referralRepository,
  );
  const getReferralStatsUseCase = new GetReferralStatsUseCase(
    referralRepository,
  );
  const markReferralRewardedUseCase = new MarkReferralRewardedUseCase(
    referralRepository,
  );

  /**
   * POST /api/v1/referrals
   * Register a new referral
   * NOTE: Requires authentication - user can only register themselves as referred
   */
  router.post(
    "/",
    authenticate(), // P1 FIX: Added authentication
    RateLimiterConfig.creation(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const validation = registerReferralSchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: "Validation error",
            details: validation.error.errors,
          });
        }

        const userId = req.user?.userId;
        if (!userId) {
          return res.status(401).json({
            success: false,
            error: "Authentication required",
          });
        }

        // P1 FIX: User can only register THEMSELVES as the referred user
        // This prevents abuse where attackers claim referrals for other users
        if (validation.data.referredUserId !== userId) {
          return res.status(403).json({
            success: false,
            error: "Cannot register referral for another user",
          });
        }

        const result = await registerReferralUseCase.execute({
          referralCode: validation.data.referralCode,
          referredUserId: userId, // Use authenticated user ID
          ipAddress: req.ip,
          deviceFingerprint: req.headers["x-device-fingerprint"] as
            | string
            | undefined,
        });

        logger.info("Referral registered via API", {
          referralId: result.referral.id,
          userId,
        });

        res.status(201).json({
          success: true,
          data: result.referral,
          message: result.message,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/referrals/me
   * List referrals where the authenticated user is the referrer
   */
  router.get(
    "/me",
    authenticate(),
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.userId;
        if (!userId) {
          return res.status(401).json({
            success: false,
            error: "Authentication required",
          });
        }

        const referrals = await referralRepository.listByReferrer(userId);

        res.json({
          success: true,
          data: referrals,
          meta: {
            total: referrals.length,
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/referrals/me/stats
   * Get referral stats for the authenticated user
   */
  router.get(
    "/me/stats",
    authenticate(),
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.userId;
        if (!userId) {
          return res.status(401).json({
            success: false,
            error: "Authentication required",
          });
        }

        const result = await getReferralStatsUseCase.execute({ userId });

        res.json({
          success: true,
          data: {
            stats: result.stats,
            referralCode: result.referralCode,
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/referrals/me/code
   * Get or generate referral code for authenticated user
   */
  router.get(
    "/me/code",
    authenticate(),
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.userId;
        if (!userId) {
          return res.status(401).json({
            success: false,
            error: "Authentication required",
          });
        }

        const referralCode =
          await referralRepository.getOrCreateUserReferralCode(userId);

        res.json({
          success: true,
          data: {
            code: referralCode.code,
            shareUrl: `${process.env.APP_BASE_URL || "https://agrobridge.io"}/signup?ref=${referralCode.code}`,
            stats: {
              totalReferrals: referralCode.totalReferrals,
              activeReferrals: referralCode.activeReferrals,
              completedReferrals: referralCode.completedReferrals,
              totalRewardsEarned: referralCode.totalRewardsEarned,
            },
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/referrals/:id/reward
   * Mark referral as rewarded (admin only)
   */
  router.post(
    "/:id/reward",
    authenticate(["ADMIN"]),
    RateLimiterConfig.sensitive(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const validation = markRewardedSchema.safeParse(req.body);

        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: "Validation error",
            details: validation.error.errors,
          });
        }

        const result = await markReferralRewardedUseCase.execute({
          referralId: id,
          rewardTxHash: validation.data.rewardTxHash,
        });

        logger.info("Referral marked as rewarded via API", {
          referralId: id,
          adminUserId: req.user?.userId,
        });

        res.json({
          success: true,
          data: result.referral,
          message: result.message,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/referrals/leaderboard
   * Get current month leaderboard
   */
  router.get(
    "/leaderboard",
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const now = new Date();
        const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

        const leaderboard = await referralRepository.getLeaderboard(
          monthYear,
          limit,
        );

        res.json({
          success: true,
          data: leaderboard,
          meta: {
            monthYear,
            totalEntries: leaderboard.length,
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/referrals/leaderboard/:monthYear
   * Get leaderboard for a specific month
   */
  router.get(
    "/leaderboard/:monthYear",
    RateLimiterConfig.api(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { monthYear } = req.params;

        // Validate monthYear format (YYYY-MM)
        if (!/^\d{4}-\d{2}$/.test(monthYear)) {
          return res.status(400).json({
            success: false,
            error: "Invalid monthYear format. Use YYYY-MM.",
          });
        }

        const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

        const leaderboard = await referralRepository.getLeaderboard(
          monthYear,
          limit,
        );

        res.json({
          success: true,
          data: leaderboard,
          meta: {
            monthYear,
            totalEntries: leaderboard.length,
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
