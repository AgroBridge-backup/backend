/**
 * @file OAuth Service
 * @description Unified OAuth service for managing authentication with external providers
 *
 * Features:
 * - Authentication with Google and GitHub
 * - Account linking to existing users
 * - Account creation for new OAuth users
 * - State management for CSRF protection
 * - JWT token generation after OAuth
 *
 * @author AgroBridge Engineering Team
 */

import * as crypto from "crypto";
import jwt from "jsonwebtoken";
import * as fs from "node:fs";
import * as path from "node:path";
import { OAuthProviderType, UserRole } from "@prisma/client";
import {
  googleOAuthProvider,
  type GoogleUserProfile,
} from "./GoogleOAuthProvider.js";
import {
  gitHubOAuthProvider,
  type GitHubUserProfile,
} from "./GitHubOAuthProvider.js";
import { redisClient } from "../../cache/RedisClient.js";
import { prisma } from "../../database/prisma/client.js";
import logger from "../../../shared/utils/logger.js";

// Load JWT private key
const privateKeyPath = process.env.JWT_PRIVATE_KEY_PATH || "./jwtRS256.key";
const resolvedPath = path.resolve(process.cwd(), privateKeyPath);
let JWT_PRIVATE_KEY: string;
try {
  JWT_PRIVATE_KEY = fs.readFileSync(resolvedPath, "utf-8");
} catch {
  logger.warn(
    "[OAuthService] JWT private key not found, OAuth login will fail",
  );
  JWT_PRIVATE_KEY = "";
}

const ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_TOKEN_TTL || "15m";
const REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_TOKEN_TTL || "7d";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Supported OAuth providers
 */
export type OAuthProvider = "google" | "github";

/**
 * OAuth state stored in Redis
 */
interface OAuthState {
  provider: OAuthProvider;
  action: "login" | "link";
  userId?: string; // Present when linking
  redirectUrl?: string;
  createdAt: number;
}

/**
 * OAuth authentication result
 */
export interface OAuthAuthResult {
  success: boolean;
  isNewUser?: boolean;
  accessToken?: string;
  refreshToken?: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
  requires2FA?: boolean;
  tempToken?: string;
  error?: string;
  errorCode?: string;
}

/**
 * OAuth link result
 */
export interface OAuthLinkResult {
  success: boolean;
  provider?: OAuthProvider;
  providerId?: string;
  error?: string;
  errorCode?: string;
}

/**
 * OAuth provider info for a user
 */
export interface LinkedProvider {
  provider: OAuthProvider;
  providerId: string;
  email: string | null;
  displayName: string | null;
  linkedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// OAUTH SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * OAuth Service
 *
 * Manages OAuth authentication flow and account linking
 */
export class OAuthService {
  private static instance: OAuthService | null = null;
  private readonly stateExpiry = 600; // 10 minutes

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): OAuthService {
    if (!OAuthService.instance) {
      OAuthService.instance = new OAuthService();
    }
    return OAuthService.instance;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // AUTHORIZATION URL GENERATION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Get authorization URL for login
   *
   * @param provider - OAuth provider
   * @param redirectUrl - URL to redirect after auth
   * @returns Authorization URL
   */
  async getLoginUrl(
    provider: OAuthProvider,
    redirectUrl?: string,
  ): Promise<string> {
    const state = await this.createState(
      provider,
      "login",
      undefined,
      redirectUrl,
    );
    return this.getAuthorizationUrl(provider, state);
  }

  /**
   * Get authorization URL for linking account
   *
   * @param provider - OAuth provider
   * @param userId - User ID to link to
   * @returns Authorization URL
   */
  async getLinkUrl(provider: OAuthProvider, userId: string): Promise<string> {
    const state = await this.createState(provider, "link", userId);
    return this.getAuthorizationUrl(provider, state);
  }

  /**
   * Get authorization URL from provider
   */
  private getAuthorizationUrl(provider: OAuthProvider, state: string): string {
    switch (provider) {
      case "google":
        return googleOAuthProvider.getAuthorizationUrl(state);
      case "github":
        return gitHubOAuthProvider.getAuthorizationUrl(state);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CALLBACK HANDLING
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Handle OAuth callback
   *
   * @param code - Authorization code
   * @param state - State parameter
   * @returns Authentication result
   */
  async handleCallback(
    code: string,
    state: string,
  ): Promise<OAuthAuthResult | OAuthLinkResult> {
    // Validate state
    const stateData = await this.validateState(state);
    if (!stateData) {
      return {
        success: false,
        error: "Invalid or expired state parameter",
        errorCode: "INVALID_STATE",
      };
    }

    // Exchange code for tokens
    const result = await this.exchangeCode(stateData.provider, code);
    if (!result.success || !result.profile) {
      return {
        success: false,
        error: result.error || "Failed to authenticate with provider",
        errorCode: result.errorCode || "AUTH_FAILED",
      };
    }

    // Handle based on action
    if (stateData.action === "link") {
      return this.linkAccount(
        stateData.userId!,
        stateData.provider,
        result.profile,
      );
    } else {
      return this.authenticateWithOAuth(stateData.provider, result.profile);
    }
  }

  /**
   * Exchange code with provider
   */
  private async exchangeCode(
    provider: OAuthProvider,
    code: string,
  ): Promise<{
    success: boolean;
    profile?: GoogleUserProfile | GitHubUserProfile;
    error?: string;
    errorCode?: string;
  }> {
    switch (provider) {
      case "google":
        return googleOAuthProvider.exchangeCode(code);
      case "github":
        return gitHubOAuthProvider.exchangeCode(code);
      default:
        return {
          success: false,
          error: "Unknown provider",
          errorCode: "UNKNOWN_PROVIDER",
        };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // AUTHENTICATION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Authenticate user via OAuth (login or signup)
   */
  private async authenticateWithOAuth(
    provider: OAuthProvider,
    profile: GoogleUserProfile | GitHubUserProfile,
  ): Promise<OAuthAuthResult> {
    const providerId = profile.id;
    const email = profile.email;
    const providerEnum =
      provider === "google"
        ? OAuthProviderType.GOOGLE
        : OAuthProviderType.GITHUB;

    // Check if OAuth provider is already linked
    const existingLink = await prisma.oAuthProvider.findUnique({
      where: {
        provider_providerId: {
          provider: providerEnum,
          providerId,
        },
      },
      include: {
        user: {
          include: {
            producer: true,
          },
        },
      },
    });

    if (existingLink) {
      // User has this OAuth linked - log them in
      const user = existingLink.user;

      if (!user.isActive) {
        return {
          success: false,
          error: "Account is deactivated",
          errorCode: "ACCOUNT_INACTIVE",
        };
      }

      // Check if 2FA is required
      if (user.twoFactorEnabled) {
        const tempToken = await this.generateTempToken(user.id);
        return {
          success: true,
          requires2FA: true,
          tempToken,
        };
      }

      // Generate tokens
      const tokens = await this.generateAuthTokens(user);

      logger.info("[OAuthService] OAuth login successful", {
        userId: user.id,
        provider,
      });

      return {
        success: true,
        isNewUser: false,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
      };
    }

    // Check if email exists (link to existing account or create new)
    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: { producer: true },
    });

    if (existingUser) {
      // Email exists - link OAuth and login
      await this.createOAuthLink(existingUser.id, provider, profile);

      if (!existingUser.isActive) {
        return {
          success: false,
          error: "Account is deactivated",
          errorCode: "ACCOUNT_INACTIVE",
        };
      }

      // Check if 2FA is required
      if (existingUser.twoFactorEnabled) {
        const tempToken = await this.generateTempToken(existingUser.id);
        return {
          success: true,
          requires2FA: true,
          tempToken,
        };
      }

      const tokens = await this.generateAuthTokens(existingUser);

      logger.info("[OAuthService] OAuth linked to existing account", {
        userId: existingUser.id,
        provider,
      });

      return {
        success: true,
        isNewUser: false,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: existingUser.id,
          email: existingUser.email,
          firstName: existingUser.firstName,
          lastName: existingUser.lastName,
          role: existingUser.role,
        },
      };
    }

    // Create new user
    const newUser = await this.createOAuthUser(provider, profile);
    const tokens = await this.generateAuthTokens(newUser);

    logger.info("[OAuthService] New user created via OAuth", {
      userId: newUser.id,
      provider,
    });

    return {
      success: true,
      isNewUser: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
      },
    };
  }

  /**
   * Create new user from OAuth profile
   */
  private async createOAuthUser(
    provider: OAuthProvider,
    profile: GoogleUserProfile | GitHubUserProfile,
  ): Promise<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    producer?: { id: string } | null;
  }> {
    let firstName: string;
    let lastName: string;

    if ("givenName" in profile) {
      // Google profile
      firstName = profile.givenName;
      lastName = profile.familyName;
    } else {
      // GitHub profile
      const nameParts = (profile.name || profile.login).split(" ");
      firstName = nameParts[0] || profile.login;
      lastName = nameParts.slice(1).join(" ") || "";
    }

    // Get avatar URL based on provider type (Google has 'picture', GitHub has 'avatarUrl')
    const avatarUrl =
      "picture" in profile
        ? profile.picture
        : (profile as GitHubUserProfile).avatarUrl;
    // Get display name based on provider type
    const displayName =
      "name" in profile && profile.name
        ? profile.name
        : "login" in profile
          ? (profile as GitHubUserProfile).login
          : firstName;

    const user = await prisma.user.create({
      data: {
        email: profile.email,
        firstName,
        lastName,
        role: UserRole.BUYER, // Default role for OAuth users
        passwordHash: null, // OAuth users don't have password
        isActive: true,
        oauthProviders: {
          create: {
            provider:
              provider === "google"
                ? OAuthProviderType.GOOGLE
                : OAuthProviderType.GITHUB,
            providerId: profile.id,
            email: profile.email,
            displayName,
            avatarUrl,
          },
        },
      },
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      producer: null,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ACCOUNT LINKING
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Link OAuth provider to existing account
   */
  private async linkAccount(
    userId: string,
    provider: OAuthProvider,
    profile: GoogleUserProfile | GitHubUserProfile,
  ): Promise<OAuthLinkResult> {
    const providerEnum =
      provider === "google"
        ? OAuthProviderType.GOOGLE
        : OAuthProviderType.GITHUB;

    // Check if already linked
    const existing = await prisma.oAuthProvider.findFirst({
      where: {
        userId,
        provider: providerEnum,
      },
    });

    if (existing) {
      return {
        success: false,
        error: `${provider} is already linked to your account`,
        errorCode: "ALREADY_LINKED",
      };
    }

    // Check if this provider ID is linked to another account
    const otherLink = await prisma.oAuthProvider.findUnique({
      where: {
        provider_providerId: {
          provider: providerEnum,
          providerId: profile.id,
        },
      },
    });

    if (otherLink) {
      return {
        success: false,
        error: `This ${provider} account is already linked to another user`,
        errorCode: "PROVIDER_IN_USE",
      };
    }

    await this.createOAuthLink(userId, provider, profile);

    logger.info("[OAuthService] OAuth account linked", {
      userId,
      provider,
      providerId: profile.id,
    });

    return {
      success: true,
      provider,
      providerId: profile.id,
    };
  }

  /**
   * Create OAuth link record
   */
  private async createOAuthLink(
    userId: string,
    provider: OAuthProvider,
    profile: GoogleUserProfile | GitHubUserProfile,
  ): Promise<void> {
    const providerEnum =
      provider === "google"
        ? OAuthProviderType.GOOGLE
        : OAuthProviderType.GITHUB;

    // Get avatar URL based on provider type (Google has 'picture', GitHub has 'avatarUrl')
    const avatarUrl =
      "picture" in profile
        ? profile.picture
        : (profile as GitHubUserProfile).avatarUrl;
    // Get display name based on provider type
    const displayName =
      "name" in profile && profile.name
        ? profile.name
        : "login" in profile
          ? (profile as GitHubUserProfile).login
          : "";

    await prisma.oAuthProvider.create({
      data: {
        userId,
        provider: providerEnum,
        providerId: profile.id,
        email: profile.email,
        displayName,
        avatarUrl,
      },
    });
  }

  /**
   * Unlink OAuth provider from account
   */
  async unlinkAccount(
    userId: string,
    provider: OAuthProvider,
  ): Promise<OAuthLinkResult> {
    const providerEnum =
      provider === "google"
        ? OAuthProviderType.GOOGLE
        : OAuthProviderType.GITHUB;

    // Check user has password or another OAuth method
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        oauthProviders: true,
      },
    });

    if (!user) {
      return {
        success: false,
        error: "User not found",
        errorCode: "USER_NOT_FOUND",
      };
    }

    // Ensure user can still login after unlinking
    const hasPassword = !!user.passwordHash;
    const otherProviders = user.oauthProviders.filter(
      (p) => p.provider !== providerEnum,
    );

    if (!hasPassword && otherProviders.length === 0) {
      return {
        success: false,
        error:
          "Cannot unlink - no other login method available. Set a password first.",
        errorCode: "NO_LOGIN_METHOD",
      };
    }

    // Remove link
    const deleteResult = await prisma.oAuthProvider.deleteMany({
      where: {
        userId,
        provider: providerEnum,
      },
    });

    if (deleteResult.count === 0) {
      return {
        success: false,
        error: `${provider} is not linked to your account`,
        errorCode: "NOT_LINKED",
      };
    }

    logger.info("[OAuthService] OAuth account unlinked", {
      userId,
      provider,
    });

    return {
      success: true,
      provider,
    };
  }

  /**
   * Get linked providers for a user
   */
  async getLinkedProviders(userId: string): Promise<LinkedProvider[]> {
    const providers = await prisma.oAuthProvider.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });

    return providers.map((p) => ({
      provider: p.provider.toLowerCase() as OAuthProvider,
      providerId: p.providerId,
      email: p.email,
      displayName: p.displayName,
      linkedAt: p.createdAt,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STATE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Create and store state parameter
   */
  private async createState(
    provider: OAuthProvider,
    action: "login" | "link",
    userId?: string,
    redirectUrl?: string,
  ): Promise<string> {
    const state = crypto.randomBytes(32).toString("hex");

    const stateData: OAuthState = {
      provider,
      action,
      userId,
      redirectUrl,
      createdAt: Date.now(),
    };

    await redisClient.client.setex(
      `oauth:state:${state}`,
      this.stateExpiry,
      JSON.stringify(stateData),
    );

    return state;
  }

  /**
   * Validate and consume state parameter
   */
  private async validateState(state: string): Promise<OAuthState | null> {
    const key = `oauth:state:${state}`;
    const data = await redisClient.client.get(key);

    if (!data) {
      return null;
    }

    // Delete state (single use)
    await redisClient.client.del(key);

    return JSON.parse(data) as OAuthState;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // TOKEN GENERATION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Generate auth tokens for user
   */
  private async generateAuthTokens(user: {
    id: string;
    email: string;
    role: UserRole;
    producer?: { id: string } | null;
  }): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Store refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt,
      },
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return { accessToken, refreshToken };
  }

  /**
   * Generate access token
   */
  private generateAccessToken(user: {
    id: string;
    email: string;
    role: UserRole;
    producer?: { id: string } | null;
  }): string {
    const payload = {
      sub: user.id,
      role: user.role,
      email: user.email,
      ...(user.producer && { producerId: user.producer.id }),
    };

    // Type assertion needed due to strict typing in @types/jsonwebtoken
    // ACCESS_TOKEN_TTL is guaranteed to be a valid string format (e.g., '15m')
    return jwt.sign(payload, JWT_PRIVATE_KEY, {
      algorithm: "RS256",
      expiresIn: ACCESS_TOKEN_TTL as jwt.SignOptions["expiresIn"],
      jwtid: crypto.randomUUID(),
    } as jwt.SignOptions);
  }

  /**
   * Generate refresh token
   */
  private generateRefreshToken(user: { id: string }): string {
    // Type assertion needed due to strict typing in @types/jsonwebtoken
    // REFRESH_TOKEN_TTL is guaranteed to be a valid string format (e.g., '7d')
    return jwt.sign({ sub: user.id }, JWT_PRIVATE_KEY, {
      algorithm: "RS256",
      expiresIn: REFRESH_TOKEN_TTL as jwt.SignOptions["expiresIn"],
      jwtid: crypto.randomUUID(),
    } as jwt.SignOptions);
  }

  /**
   * Generate temporary token for 2FA verification
   */
  private async generateTempToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString("hex");
    await redisClient.client.setex(
      `oauth:2fa:${token}`,
      300, // 5 minutes
      userId,
    );
    return token;
  }

  /**
   * Validate temporary token and get user ID
   */
  async validateTempToken(token: string): Promise<string | null> {
    const key = `oauth:2fa:${token}`;
    const userId = await redisClient.client.get(key);

    if (!userId) {
      return null;
    }

    // Delete token (single use)
    await redisClient.client.del(key);
    return userId;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECURE TOKEN EXCHANGE (prevents token exposure in URLs)
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Store tokens with a one-time authorization code
   * SECURITY: Tokens are never exposed in URLs, only a short-lived code
   *
   * @param accessToken - JWT access token
   * @param refreshToken - JWT refresh token
   * @param metadata - Additional metadata (isNewUser, etc.)
   * @returns One-time authorization code
   */
  async storeTokensForExchange(
    accessToken: string,
    refreshToken: string,
    metadata: {
      isNewUser?: boolean;
      requires2FA?: boolean;
      tempToken?: string;
    } = {},
  ): Promise<string> {
    const code = crypto.randomBytes(32).toString("hex");
    const key = `oauth:exchange:${code}`;

    const data = JSON.stringify({
      accessToken,
      refreshToken,
      ...metadata,
      createdAt: Date.now(),
    });

    // Store for 60 seconds only - code must be exchanged quickly
    await redisClient.client.setex(key, 60, data);

    logger.debug("[OAuthService] Token exchange code created", {
      codePrefix: code.substring(0, 8),
    });

    return code;
  }

  /**
   * Exchange authorization code for tokens
   * SECURITY: Code is single-use and expires quickly
   *
   * @param code - One-time authorization code
   * @returns Tokens and metadata, or null if invalid/expired
   */
  async exchangeCodeForTokens(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    isNewUser?: boolean;
    requires2FA?: boolean;
    tempToken?: string;
  } | null> {
    // Validate code format (must be 64 hex chars)
    if (!/^[a-f0-9]{64}$/i.test(code)) {
      logger.warn("[OAuthService] Invalid code format in token exchange");
      return null;
    }

    const key = `oauth:exchange:${code}`;
    const data = await redisClient.client.get(key);

    if (!data) {
      logger.warn("[OAuthService] Token exchange code not found or expired", {
        codePrefix: code.substring(0, 8),
      });
      return null;
    }

    // Delete code immediately (single-use)
    await redisClient.client.del(key);

    try {
      const parsed = JSON.parse(data);
      logger.debug("[OAuthService] Token exchange successful", {
        codePrefix: code.substring(0, 8),
      });
      return {
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken,
        isNewUser: parsed.isNewUser,
        requires2FA: parsed.requires2FA,
        tempToken: parsed.tempToken,
      };
    } catch (error) {
      logger.error("[OAuthService] Failed to parse token exchange data", {
        error,
      });
      return null;
    }
  }
}

// Export singleton instance
export const oAuthService = OAuthService.getInstance();

export default oAuthService;
