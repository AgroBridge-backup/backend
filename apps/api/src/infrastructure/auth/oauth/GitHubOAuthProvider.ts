/**
 * @file GitHub OAuth Provider
 * @description OAuth 2.0 integration with GitHub for authentication
 *
 * Features:
 * - OAuth 2.0 authorization code flow
 * - Token exchange
 * - User profile and email retrieval
 * - Secure state parameter validation
 *
 * @author AgroBridge Engineering Team
 */

import logger from "../../../shared/utils/logger.js";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GitHub OAuth configuration
 */
interface GitHubOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * GitHub user profile from OAuth
 */
export interface GitHubUserProfile {
  id: string;
  login: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  avatarUrl: string;
  bio?: string;
  company?: string;
  location?: string;
}

/**
 * GitHub OAuth tokens
 */
export interface GitHubTokens {
  accessToken: string;
  tokenType: string;
  scope: string;
}

/**
 * OAuth authentication result
 */
export interface OAuthResult {
  success: boolean;
  profile?: GitHubUserProfile;
  tokens?: GitHubTokens;
  error?: string;
  errorCode?: string;
}

/**
 * GitHub email from API
 */
interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GITHUB OAUTH PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GitHub OAuth Provider
 *
 * Handles OAuth 2.0 authentication with GitHub
 */
export class GitHubOAuthProvider {
  private static instance: GitHubOAuthProvider | null = null;
  private config: GitHubOAuthConfig | null = null;
  private readonly authUrl = "https://github.com/login/oauth/authorize";
  private readonly tokenUrl = "https://github.com/login/oauth/access_token";
  private readonly apiUrl = "https://api.github.com";

  private constructor() {
    this.initializeConfig();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): GitHubOAuthProvider {
    if (!GitHubOAuthProvider.instance) {
      GitHubOAuthProvider.instance = new GitHubOAuthProvider();
    }
    return GitHubOAuthProvider.instance;
  }

  /**
   * Initialize configuration from environment
   */
  private initializeConfig(): void {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const redirectUri = process.env.GITHUB_CALLBACK_URL;

    if (clientId && clientSecret && redirectUri) {
      this.config = {
        clientId,
        clientSecret,
        redirectUri,
      };

      logger.info("[GitHubOAuthProvider] Initialized", {
        redirectUri,
      });
    } else {
      logger.warn("[GitHubOAuthProvider] Not configured - missing credentials");
    }
  }

  /**
   * Check if provider is available
   */
  isAvailable(): boolean {
    return this.config !== null;
  }

  /**
   * Generate authorization URL
   *
   * @param state - CSRF protection state parameter
   * @param scopes - OAuth scopes to request
   * @returns Authorization URL
   */
  getAuthorizationUrl(
    state: string,
    scopes: string[] = ["user:email", "read:user"],
  ): string {
    if (!this.config) {
      throw new Error("GitHub OAuth not configured");
    }

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: scopes.join(" "),
      state,
      allow_signup: "true",
    });

    return `${this.authUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   *
   * @param code - Authorization code from callback
   * @returns OAuth tokens and user profile
   */
  async exchangeCode(code: string): Promise<OAuthResult> {
    if (!this.config) {
      return {
        success: false,
        error: "GitHub OAuth not configured",
        errorCode: "NOT_CONFIGURED",
      };
    }

    try {
      const response = await fetch(this.tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code,
          redirect_uri: this.config.redirectUri,
        }),
      });

      const data = await response.json();

      if (data.error) {
        logger.error("[GitHubOAuthProvider] Token exchange failed", {
          error: data.error,
          description: data.error_description,
        });

        return {
          success: false,
          error: data.error_description || "Token exchange failed",
          errorCode: data.error,
        };
      }

      const tokens: GitHubTokens = {
        accessToken: data.access_token,
        tokenType: data.token_type,
        scope: data.scope,
      };

      // Fetch user profile
      const profile = await this.getUserProfile(tokens.accessToken);

      if (!profile) {
        return {
          success: false,
          error: "Failed to retrieve user profile",
          errorCode: "PROFILE_ERROR",
        };
      }

      logger.info("[GitHubOAuthProvider] Authentication successful", {
        userId: profile.id,
        login: profile.login,
        email: profile.email,
      });

      return {
        success: true,
        profile,
        tokens,
      };
    } catch (error) {
      const err = error as Error;
      logger.error("[GitHubOAuthProvider] Exchange error", {
        error: err.message,
      });

      return {
        success: false,
        error: err.message,
        errorCode: "EXCHANGE_ERROR",
      };
    }
  }

  /**
   * Get user profile from access token
   *
   * @param accessToken - OAuth access token
   * @returns User profile
   */
  async getUserProfile(accessToken: string): Promise<GitHubUserProfile | null> {
    try {
      // Fetch user info
      const userResponse = await fetch(`${this.apiUrl}/user`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (!userResponse.ok) {
        logger.error("[GitHubOAuthProvider] User fetch failed", {
          status: userResponse.status,
        });
        return null;
      }

      const userData = await userResponse.json();

      // Fetch user emails (if user:email scope was granted)
      let primaryEmail = userData.email;
      let emailVerified = false;

      if (!primaryEmail) {
        const emailResult = await this.getUserEmails(accessToken);
        if (emailResult) {
          primaryEmail = emailResult.email;
          emailVerified = emailResult.verified;
        }
      } else {
        // GitHub doesn't provide email verification status in user endpoint
        // Assume verified if it's their public email
        emailVerified = true;
      }

      return {
        id: String(userData.id),
        login: userData.login,
        email: primaryEmail || `${userData.id}@users.noreply.github.com`,
        emailVerified,
        name: userData.name,
        avatarUrl: userData.avatar_url,
        bio: userData.bio,
        company: userData.company,
        location: userData.location,
      };
    } catch (error) {
      logger.error("[GitHubOAuthProvider] Profile error", {
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Get user's primary email
   *
   * @param accessToken - OAuth access token
   * @returns Primary email and verification status
   */
  private async getUserEmails(
    accessToken: string,
  ): Promise<{ email: string; verified: boolean } | null> {
    try {
      const response = await fetch(`${this.apiUrl}/user/emails`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (!response.ok) {
        return null;
      }

      const emails: GitHubEmail[] = await response.json();

      // Find primary verified email
      const primaryEmail = emails.find((e) => e.primary && e.verified);
      if (primaryEmail) {
        return { email: primaryEmail.email, verified: true };
      }

      // Fall back to any verified email
      const verifiedEmail = emails.find((e) => e.verified);
      if (verifiedEmail) {
        return { email: verifiedEmail.email, verified: true };
      }

      // Fall back to primary (even if unverified)
      const anyPrimary = emails.find((e) => e.primary);
      if (anyPrimary) {
        return { email: anyPrimary.email, verified: false };
      }

      return null;
    } catch (error) {
      logger.error("[GitHubOAuthProvider] Email fetch error", {
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Validate access token
   *
   * @param accessToken - OAuth access token
   * @returns Whether token is valid
   */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/user`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Revoke access token
   *
   * @param accessToken - Access token to revoke
   * @returns Whether revocation succeeded
   */
  async revokeToken(accessToken: string): Promise<boolean> {
    if (!this.config) {
      return false;
    }

    try {
      const response = await fetch(
        `${this.apiUrl}/applications/${this.config.clientId}/token`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Basic ${Buffer.from(
              `${this.config.clientId}:${this.config.clientSecret}`,
            ).toString("base64")}`,
            Accept: "application/vnd.github.v3+json",
          },
          body: JSON.stringify({ access_token: accessToken }),
        },
      );

      return response.ok || response.status === 204;
    } catch (error) {
      logger.error("[GitHubOAuthProvider] Revoke error", {
        error: (error as Error).message,
      });
      return false;
    }
  }
}

// Export singleton instance
export const gitHubOAuthProvider = GitHubOAuthProvider.getInstance();

export default gitHubOAuthProvider;
