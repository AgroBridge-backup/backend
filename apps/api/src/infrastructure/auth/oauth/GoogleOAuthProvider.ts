/**
 * @file Google OAuth Provider
 * @description OAuth 2.0 integration with Google for authentication
 *
 * Features:
 * - OAuth 2.0 authorization code flow
 * - Token exchange and refresh
 * - User profile retrieval
 * - Secure state parameter validation
 *
 * @author AgroBridge Engineering Team
 */

import logger from '../../../shared/utils/logger.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Google OAuth configuration
 */
interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Google user profile from OAuth
 */
export interface GoogleUserProfile {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  givenName: string;
  familyName: string;
  picture?: string;
  locale?: string;
}

/**
 * Google OAuth tokens
 */
export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresIn: number;
  tokenType: string;
  scope: string;
}

/**
 * OAuth authentication result
 */
export interface OAuthResult {
  success: boolean;
  profile?: GoogleUserProfile;
  tokens?: GoogleTokens;
  error?: string;
  errorCode?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GOOGLE OAUTH PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Google OAuth Provider
 *
 * Handles OAuth 2.0 authentication with Google
 */
export class GoogleOAuthProvider {
  private static instance: GoogleOAuthProvider | null = null;
  private config: GoogleOAuthConfig | null = null;
  private readonly authUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  private readonly tokenUrl = 'https://oauth2.googleapis.com/token';
  private readonly userInfoUrl = 'https://www.googleapis.com/oauth2/v2/userinfo';

  private constructor() {
    this.initializeConfig();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): GoogleOAuthProvider {
    if (!GoogleOAuthProvider.instance) {
      GoogleOAuthProvider.instance = new GoogleOAuthProvider();
    }
    return GoogleOAuthProvider.instance;
  }

  /**
   * Initialize configuration from environment
   */
  private initializeConfig(): void {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_CALLBACK_URL;

    if (clientId && clientSecret && redirectUri) {
      this.config = {
        clientId,
        clientSecret,
        redirectUri,
      };

      logger.info('[GoogleOAuthProvider] Initialized', {
        redirectUri,
      });
    } else {
      logger.warn('[GoogleOAuthProvider] Not configured - missing credentials');
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
    scopes: string[] = ['openid', 'email', 'profile']
  ): string {
    if (!this.config) {
      throw new Error('Google OAuth not configured');
    }

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      state,
      access_type: 'offline', // Request refresh token
      prompt: 'consent', // Force consent to get refresh token
    });

    return `${this.authUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   *
   * @param code - Authorization code from callback
   * @returns OAuth tokens
   */
  async exchangeCode(code: string): Promise<OAuthResult> {
    if (!this.config) {
      return {
        success: false,
        error: 'Google OAuth not configured',
        errorCode: 'NOT_CONFIGURED',
      };
    }

    try {
      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          redirect_uri: this.config.redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        logger.error('[GoogleOAuthProvider] Token exchange failed', {
          status: response.status,
          error: data.error,
          description: data.error_description,
        });

        return {
          success: false,
          error: data.error_description || 'Token exchange failed',
          errorCode: data.error || 'TOKEN_ERROR',
        };
      }

      const tokens: GoogleTokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        idToken: data.id_token,
        expiresIn: data.expires_in,
        tokenType: data.token_type,
        scope: data.scope,
      };

      // Fetch user profile
      const profile = await this.getUserProfile(tokens.accessToken);

      if (!profile) {
        return {
          success: false,
          error: 'Failed to retrieve user profile',
          errorCode: 'PROFILE_ERROR',
        };
      }

      logger.info('[GoogleOAuthProvider] Authentication successful', {
        userId: profile.id,
        email: profile.email,
      });

      return {
        success: true,
        profile,
        tokens,
      };
    } catch (error) {
      const err = error as Error;
      logger.error('[GoogleOAuthProvider] Exchange error', {
        error: err.message,
      });

      return {
        success: false,
        error: err.message,
        errorCode: 'EXCHANGE_ERROR',
      };
    }
  }

  /**
   * Get user profile from access token
   *
   * @param accessToken - OAuth access token
   * @returns User profile
   */
  async getUserProfile(accessToken: string): Promise<GoogleUserProfile | null> {
    try {
      const response = await fetch(this.userInfoUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        logger.error('[GoogleOAuthProvider] Profile fetch failed', {
          status: response.status,
        });
        return null;
      }

      const data = await response.json();

      return {
        id: data.id,
        email: data.email,
        emailVerified: data.verified_email,
        name: data.name,
        givenName: data.given_name,
        familyName: data.family_name,
        picture: data.picture,
        locale: data.locale,
      };
    } catch (error) {
      logger.error('[GoogleOAuthProvider] Profile error', {
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Refresh access token using refresh token
   *
   * @param refreshToken - OAuth refresh token
   * @returns New tokens
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuthResult> {
    if (!this.config) {
      return {
        success: false,
        error: 'Google OAuth not configured',
        errorCode: 'NOT_CONFIGURED',
      };
    }

    try {
      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error_description || 'Token refresh failed',
          errorCode: data.error || 'REFRESH_ERROR',
        };
      }

      return {
        success: true,
        tokens: {
          accessToken: data.access_token,
          idToken: data.id_token,
          expiresIn: data.expires_in,
          tokenType: data.token_type,
          scope: data.scope,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        errorCode: 'REFRESH_ERROR',
      };
    }
  }

  /**
   * Revoke access token
   *
   * @param token - Access or refresh token to revoke
   */
  async revokeToken(token: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://oauth2.googleapis.com/revoke?token=${token}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return response.ok;
    } catch (error) {
      logger.error('[GoogleOAuthProvider] Revoke error', {
        error: (error as Error).message,
      });
      return false;
    }
  }
}

// Export singleton instance
export const googleOAuthProvider = GoogleOAuthProvider.getInstance();

export default googleOAuthProvider;
