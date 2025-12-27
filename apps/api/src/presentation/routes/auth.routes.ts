/**
 * @file Auth Routes
 * @description Authentication, 2FA, and OAuth routes
 *
 * @author AgroBridge Engineering Team
 */

import { Router, Request, Response } from "express";
import { validateRequest } from "../middlewares/validator.middleware.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { RateLimiterConfig } from "../../infrastructure/http/middleware/rate-limiter.middleware.js";
import { Password } from "../../domain/value-objects/Password.js";
import { oAuthService } from "../../infrastructure/auth/oauth/OAuthService.js";
import {
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  passwordStrengthSchema,
  verify2FASchema,
  enable2FASchema,
  disable2FASchema,
  regenerateBackupCodesSchema,
  oauthCallbackSchema,
} from "../validators/auth.validator.js";

// Types for extended auth use cases - using AllUseCases['auth'] for type compatibility
import { AllUseCases } from "../../application/use-cases/index.js";

type AuthUseCases = AllUseCases["auth"];

export function createAuthRouter(useCases: AuthUseCases) {
  const router = Router();

  // ═══════════════════════════════════════════════════════════════════════════════
  // CORE AUTHENTICATION ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/v1/auth/login
   * Login with email and password
   * Rate limited: 5 attempts per 15 minutes
   *
   * If 2FA is enabled, returns { requires2FA: true, tempToken: string }
   * Otherwise returns { accessToken, refreshToken }
   */
  router.post(
    "/login",
    RateLimiterConfig.auth(),
    validateRequest(loginSchema),
    async (req: Request, res: Response, next) => {
      try {
        const result = await useCases.loginUseCase.execute(req.body);
        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/auth/register
   * Register a new user account
   * Rate limited: 3 attempts per 15 minutes
   */
  router.post(
    "/register",
    RateLimiterConfig.auth(),
    validateRequest(registerSchema),
    async (req: Request, res: Response, next) => {
      try {
        const result = await useCases.registerUseCase.execute(req.body);
        res.status(201).json({
          success: true,
          data: result,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/auth/refresh
   * Refresh access token using refresh token
   * Rate limited: 10 attempts per 15 minutes
   */
  router.post(
    "/refresh",
    RateLimiterConfig.tokenRefresh(),
    validateRequest(refreshTokenSchema),
    async (req: Request, res: Response, next) => {
      try {
        const result = await useCases.refreshTokenUseCase.execute(req.body);
        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/auth/logout
   * Logout and revoke current token
   */
  router.post(
    "/logout",
    authenticate(),
    async (req: Request, res: Response, next) => {
      try {
        if (req.user?.jti && req.user?.exp) {
          await useCases.logoutUseCase.execute({
            jti: req.user.jti,
            exp: req.user.exp,
          });
        }
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/auth/me
   * Get current authenticated user info
   */
  router.get(
    "/me",
    authenticate(),
    async (req: Request, res: Response, next) => {
      try {
        if (!req.user?.userId) {
          return res.status(401).json({
            success: false,
            error: { code: "UNAUTHORIZED", message: "User not authenticated" },
          });
        }
        const result = await useCases.getCurrentUserUseCase.execute({
          userId: req.user.userId,
        });
        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/auth/password-strength
   * Check password strength (for frontend real-time validation)
   * Public endpoint, moderately rate limited
   */
  router.post(
    "/password-strength",
    RateLimiterConfig.api(),
    validateRequest(passwordStrengthSchema),
    async (req: Request, res: Response) => {
      const { password } = req.body;
      const strength = Password.calculateStrength(password);
      const errors = Password.validate(password);

      res.json({
        success: true,
        data: {
          valid: strength.valid,
          score: strength.score,
          level: strength.level,
          errors: errors.length > 0 ? errors : undefined,
        },
      });
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // TWO-FACTOR AUTHENTICATION ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/v1/auth/2fa/verify
   * Verify 2FA token during login (step 2 of login flow)
   * Rate limited: 5 attempts per 5 minutes
   */
  router.post(
    "/2fa/verify",
    RateLimiterConfig.twoFactor(),
    validateRequest(verify2FASchema),
    async (req: Request, res: Response, next) => {
      try {
        const result = await useCases.verify2FAUseCase.execute(req.body);
        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/auth/2fa/setup
   * Initialize 2FA setup - generates secret and QR code
   * Requires authentication
   */
  router.post(
    "/2fa/setup",
    authenticate(),
    async (req: Request, res: Response, next) => {
      try {
        if (!req.user?.userId) {
          return res.status(401).json({
            success: false,
            error: { code: "UNAUTHORIZED", message: "User not authenticated" },
          });
        }

        const result = await useCases.setup2FAUseCase.execute({
          userId: req.user.userId,
        });
        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/auth/2fa/enable
   * Enable 2FA after verifying the setup token
   * Returns backup codes (store securely!)
   * Requires authentication
   */
  router.post(
    "/2fa/enable",
    authenticate(),
    validateRequest(enable2FASchema),
    async (req: Request, res: Response, next) => {
      try {
        if (!req.user?.userId) {
          return res.status(401).json({
            success: false,
            error: { code: "UNAUTHORIZED", message: "User not authenticated" },
          });
        }

        const result = await useCases.enable2FAUseCase.execute({
          userId: req.user.userId,
          token: req.body.token,
        });
        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/auth/2fa/disable
   * Disable 2FA (requires verification token)
   * Requires authentication
   */
  router.post(
    "/2fa/disable",
    authenticate(),
    validateRequest(disable2FASchema),
    async (req: Request, res: Response, next) => {
      try {
        if (!req.user?.userId) {
          return res.status(401).json({
            success: false,
            error: { code: "UNAUTHORIZED", message: "User not authenticated" },
          });
        }

        const result = await useCases.disable2FAUseCase.execute({
          userId: req.user.userId,
          token: req.body.token,
        });
        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/auth/2fa/status
   * Get current 2FA status for the user
   * Requires authentication
   */
  router.get(
    "/2fa/status",
    authenticate(),
    async (req: Request, res: Response, next) => {
      try {
        if (!req.user?.userId) {
          return res.status(401).json({
            success: false,
            error: { code: "UNAUTHORIZED", message: "User not authenticated" },
          });
        }

        const result = await useCases.get2FAStatusUseCase.execute({
          userId: req.user.userId,
        });
        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/auth/2fa/backup-codes
   * Regenerate backup codes (requires verification token)
   * Returns new backup codes (store securely!)
   * Requires authentication
   */
  router.post(
    "/2fa/backup-codes",
    authenticate(),
    validateRequest(regenerateBackupCodesSchema),
    async (req: Request, res: Response, next) => {
      try {
        if (!req.user?.userId) {
          return res.status(401).json({
            success: false,
            error: { code: "UNAUTHORIZED", message: "User not authenticated" },
          });
        }

        const result = await useCases.regenerateBackupCodesUseCase.execute({
          userId: req.user.userId,
          token: req.body.token,
        });
        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // OAUTH ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/v1/auth/oauth/google
   * Redirect to Google OAuth login
   */
  router.get(
    "/oauth/google",
    RateLimiterConfig.oauth(),
    async (req: Request, res: Response, next) => {
      try {
        const authUrl = await oAuthService.getLoginUrl("google");
        res.redirect(authUrl);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/auth/oauth/google/callback
   * Handle Google OAuth callback
   * SECURITY: Uses one-time code exchange instead of exposing tokens in URL
   */
  router.get(
    "/oauth/google/callback",
    validateRequest(oauthCallbackSchema),
    async (req: Request, res: Response, next) => {
      try {
        const { code, state } = req.query as { code: string; state: string };
        const result = await oAuthService.handleCallback(code, state);

        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        if (!result.success) {
          res.redirect(
            `${frontendUrl}/auth/callback?error=${encodeURIComponent(result.error || "Authentication failed")}`,
          );
          return;
        }

        // Check if this is an auth result (has tokens) or link result
        if (
          "accessToken" in result &&
          result.accessToken &&
          result.refreshToken
        ) {
          // SECURITY: Store tokens in Redis and return a one-time code
          // Tokens are never exposed in the URL
          const exchangeCode = await oAuthService.storeTokensForExchange(
            result.accessToken,
            result.refreshToken,
            {
              isNewUser: result.isNewUser,
              requires2FA: result.requires2FA,
              tempToken: result.tempToken,
            },
          );

          if (result.requires2FA) {
            // 2FA required - include tempToken for verification flow
            res.redirect(
              `${frontendUrl}/auth/callback?code=${exchangeCode}&requires2FA=true`,
            );
          } else {
            res.redirect(
              `${frontendUrl}/auth/callback?code=${exchangeCode}${result.isNewUser ? "&newUser=true" : ""}`,
            );
          }
        } else {
          // Link result - redirect with success message
          res.redirect(
            `${frontendUrl}/auth/callback?linked=true&provider=google`,
          );
        }
      } catch (error) {
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        const errorMessage =
          error instanceof Error ? error.message : "Authentication failed";
        res.redirect(
          `${frontendUrl}/auth/callback?error=${encodeURIComponent(errorMessage)}`,
        );
      }
    },
  );

  /**
   * GET /api/v1/auth/oauth/github
   * Redirect to GitHub OAuth login
   */
  router.get(
    "/oauth/github",
    RateLimiterConfig.oauth(),
    async (req: Request, res: Response, next) => {
      try {
        const authUrl = await oAuthService.getLoginUrl("github");
        res.redirect(authUrl);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/auth/oauth/github/callback
   * Handle GitHub OAuth callback
   * SECURITY: Uses one-time code exchange instead of exposing tokens in URL
   */
  router.get(
    "/oauth/github/callback",
    validateRequest(oauthCallbackSchema),
    async (req: Request, res: Response, next) => {
      try {
        const { code, state } = req.query as { code: string; state: string };
        const result = await oAuthService.handleCallback(code, state);

        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        if (!result.success) {
          res.redirect(
            `${frontendUrl}/auth/callback?error=${encodeURIComponent(result.error || "Authentication failed")}`,
          );
          return;
        }

        // Check if this is an auth result (has tokens) or link result
        if (
          "accessToken" in result &&
          result.accessToken &&
          result.refreshToken
        ) {
          // SECURITY: Store tokens in Redis and return a one-time code
          // Tokens are never exposed in the URL
          const exchangeCode = await oAuthService.storeTokensForExchange(
            result.accessToken,
            result.refreshToken,
            {
              isNewUser: result.isNewUser,
              requires2FA: result.requires2FA,
              tempToken: result.tempToken,
            },
          );

          if (result.requires2FA) {
            // 2FA required - include tempToken for verification flow
            res.redirect(
              `${frontendUrl}/auth/callback?code=${exchangeCode}&requires2FA=true`,
            );
          } else {
            res.redirect(
              `${frontendUrl}/auth/callback?code=${exchangeCode}${result.isNewUser ? "&newUser=true" : ""}`,
            );
          }
        } else {
          // Link result - redirect with success message
          res.redirect(
            `${frontendUrl}/auth/callback?linked=true&provider=github`,
          );
        }
      } catch (error) {
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        const errorMessage =
          error instanceof Error ? error.message : "Authentication failed";
        res.redirect(
          `${frontendUrl}/auth/callback?error=${encodeURIComponent(errorMessage)}`,
        );
      }
    },
  );

  /**
   * POST /api/v1/auth/oauth/link/google
   * Link Google account to existing user
   * Requires authentication
   */
  router.post(
    "/oauth/link/google",
    authenticate(),
    async (req: Request, res: Response, next) => {
      try {
        if (!req.user?.userId) {
          return res.status(401).json({
            success: false,
            error: { code: "UNAUTHORIZED", message: "User not authenticated" },
          });
        }

        const authUrl = await oAuthService.getLinkUrl(
          "google",
          req.user.userId,
        );
        res.json({
          success: true,
          data: { authUrl },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/auth/oauth/link/github
   * Link GitHub account to existing user
   * Requires authentication
   */
  router.post(
    "/oauth/link/github",
    authenticate(),
    async (req: Request, res: Response, next) => {
      try {
        if (!req.user?.userId) {
          return res.status(401).json({
            success: false,
            error: { code: "UNAUTHORIZED", message: "User not authenticated" },
          });
        }

        const authUrl = await oAuthService.getLinkUrl(
          "github",
          req.user.userId,
        );
        res.json({
          success: true,
          data: { authUrl },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * DELETE /api/v1/auth/oauth/unlink/:provider
   * Unlink OAuth provider from user account
   * Requires authentication
   */
  router.delete(
    "/oauth/unlink/:provider",
    authenticate(),
    async (req: Request, res: Response, next) => {
      try {
        if (!req.user?.userId) {
          return res.status(401).json({
            success: false,
            error: { code: "UNAUTHORIZED", message: "User not authenticated" },
          });
        }

        const provider = req.params.provider as "google" | "github";
        if (!["google", "github"].includes(provider)) {
          return res.status(400).json({
            success: false,
            error: {
              code: "INVALID_PROVIDER",
              message: "Invalid OAuth provider",
            },
          });
        }

        const result = await oAuthService.unlinkAccount(
          req.user.userId,
          provider,
        );
        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/auth/oauth/providers
   * Get linked OAuth providers for user
   * Requires authentication
   */
  router.get(
    "/oauth/providers",
    authenticate(),
    async (req: Request, res: Response, next) => {
      try {
        if (!req.user?.userId) {
          return res.status(401).json({
            success: false,
            error: { code: "UNAUTHORIZED", message: "User not authenticated" },
          });
        }

        const providers = await oAuthService.getLinkedProviders(
          req.user.userId,
        );
        res.json({
          success: true,
          data: { providers },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECURE TOKEN EXCHANGE ENDPOINT
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/v1/auth/oauth/exchange
   * Exchange one-time authorization code for tokens
   * SECURITY: Code is single-use and expires in 60 seconds
   *
   * This endpoint should be called by the frontend after receiving the
   * authorization code from the OAuth callback redirect.
   */
  router.post(
    "/oauth/exchange",
    RateLimiterConfig.auth(),
    async (req: Request, res: Response, next) => {
      try {
        const { code } = req.body;

        if (!code || typeof code !== "string") {
          return res.status(400).json({
            success: false,
            error: {
              code: "INVALID_REQUEST",
              message: "Authorization code is required",
            },
          });
        }

        const result = await oAuthService.exchangeCodeForTokens(code);

        if (!result) {
          return res.status(400).json({
            success: false,
            error: {
              code: "INVALID_CODE",
              message:
                "Invalid or expired authorization code. Please try logging in again.",
            },
          });
        }

        // Return tokens securely via POST response body
        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
