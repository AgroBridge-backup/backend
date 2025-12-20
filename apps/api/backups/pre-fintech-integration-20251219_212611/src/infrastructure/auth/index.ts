/**
 * @file Auth Module Index
 * @description Central export point for authentication services
 *
 * @author AgroBridge Engineering Team
 */

// Two-Factor Authentication
export {
  TwoFactorService,
  twoFactorService,
  type TwoFactorSecret,
  type BackupCodesResult,
  type TwoFactorVerifyResult,
  type TwoFactorStatus,
} from './TwoFactorService.js';

// OAuth Providers
export {
  GoogleOAuthProvider,
  googleOAuthProvider,
  type GoogleUserProfile,
  type GoogleTokens,
} from './oauth/GoogleOAuthProvider.js';

export {
  GitHubOAuthProvider,
  gitHubOAuthProvider,
  type GitHubUserProfile,
  type GitHubTokens,
} from './oauth/GitHubOAuthProvider.js';

// OAuth Service
export {
  OAuthService,
  oAuthService,
  type OAuthProvider,
  type OAuthAuthResult,
  type OAuthLinkResult,
  type LinkedProvider,
} from './oauth/OAuthService.js';
