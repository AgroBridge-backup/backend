import logger from '../../../shared/utils/logger.js';
export class GitHubOAuthProvider {
    static instance = null;
    config = null;
    authUrl = 'https://github.com/login/oauth/authorize';
    tokenUrl = 'https://github.com/login/oauth/access_token';
    apiUrl = 'https://api.github.com';
    constructor() {
        this.initializeConfig();
    }
    static getInstance() {
        if (!GitHubOAuthProvider.instance) {
            GitHubOAuthProvider.instance = new GitHubOAuthProvider();
        }
        return GitHubOAuthProvider.instance;
    }
    initializeConfig() {
        const clientId = process.env.GITHUB_CLIENT_ID;
        const clientSecret = process.env.GITHUB_CLIENT_SECRET;
        const redirectUri = process.env.GITHUB_CALLBACK_URL;
        if (clientId && clientSecret && redirectUri) {
            this.config = {
                clientId,
                clientSecret,
                redirectUri,
            };
            logger.info('[GitHubOAuthProvider] Initialized', {
                redirectUri,
            });
        }
        else {
            logger.warn('[GitHubOAuthProvider] Not configured - missing credentials');
        }
    }
    isAvailable() {
        return this.config !== null;
    }
    getAuthorizationUrl(state, scopes = ['user:email', 'read:user']) {
        if (!this.config) {
            throw new Error('GitHub OAuth not configured');
        }
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            scope: scopes.join(' '),
            state,
            allow_signup: 'true',
        });
        return `${this.authUrl}?${params.toString()}`;
    }
    async exchangeCode(code) {
        if (!this.config) {
            return {
                success: false,
                error: 'GitHub OAuth not configured',
                errorCode: 'NOT_CONFIGURED',
            };
        }
        try {
            const response = await fetch(this.tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
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
                logger.error('[GitHubOAuthProvider] Token exchange failed', {
                    error: data.error,
                    description: data.error_description,
                });
                return {
                    success: false,
                    error: data.error_description || 'Token exchange failed',
                    errorCode: data.error,
                };
            }
            const tokens = {
                accessToken: data.access_token,
                tokenType: data.token_type,
                scope: data.scope,
            };
            const profile = await this.getUserProfile(tokens.accessToken);
            if (!profile) {
                return {
                    success: false,
                    error: 'Failed to retrieve user profile',
                    errorCode: 'PROFILE_ERROR',
                };
            }
            logger.info('[GitHubOAuthProvider] Authentication successful', {
                userId: profile.id,
                login: profile.login,
                email: profile.email,
            });
            return {
                success: true,
                profile,
                tokens,
            };
        }
        catch (error) {
            const err = error;
            logger.error('[GitHubOAuthProvider] Exchange error', {
                error: err.message,
            });
            return {
                success: false,
                error: err.message,
                errorCode: 'EXCHANGE_ERROR',
            };
        }
    }
    async getUserProfile(accessToken) {
        try {
            const userResponse = await fetch(`${this.apiUrl}/user`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: 'application/vnd.github.v3+json',
                },
            });
            if (!userResponse.ok) {
                logger.error('[GitHubOAuthProvider] User fetch failed', {
                    status: userResponse.status,
                });
                return null;
            }
            const userData = await userResponse.json();
            let primaryEmail = userData.email;
            let emailVerified = false;
            if (!primaryEmail) {
                const emailResult = await this.getUserEmails(accessToken);
                if (emailResult) {
                    primaryEmail = emailResult.email;
                    emailVerified = emailResult.verified;
                }
            }
            else {
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
        }
        catch (error) {
            logger.error('[GitHubOAuthProvider] Profile error', {
                error: error.message,
            });
            return null;
        }
    }
    async getUserEmails(accessToken) {
        try {
            const response = await fetch(`${this.apiUrl}/user/emails`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: 'application/vnd.github.v3+json',
                },
            });
            if (!response.ok) {
                return null;
            }
            const emails = await response.json();
            const primaryEmail = emails.find((e) => e.primary && e.verified);
            if (primaryEmail) {
                return { email: primaryEmail.email, verified: true };
            }
            const verifiedEmail = emails.find((e) => e.verified);
            if (verifiedEmail) {
                return { email: verifiedEmail.email, verified: true };
            }
            const anyPrimary = emails.find((e) => e.primary);
            if (anyPrimary) {
                return { email: anyPrimary.email, verified: false };
            }
            return null;
        }
        catch (error) {
            logger.error('[GitHubOAuthProvider] Email fetch error', {
                error: error.message,
            });
            return null;
        }
    }
    async validateToken(accessToken) {
        try {
            const response = await fetch(`${this.apiUrl}/user`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            return response.ok;
        }
        catch {
            return false;
        }
    }
    async revokeToken(accessToken) {
        if (!this.config) {
            return false;
        }
        try {
            const response = await fetch(`${this.apiUrl}/applications/${this.config.clientId}/token`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`,
                    Accept: 'application/vnd.github.v3+json',
                },
                body: JSON.stringify({ access_token: accessToken }),
            });
            return response.ok || response.status === 204;
        }
        catch (error) {
            logger.error('[GitHubOAuthProvider] Revoke error', {
                error: error.message,
            });
            return false;
        }
    }
}
export const gitHubOAuthProvider = GitHubOAuthProvider.getInstance();
export default gitHubOAuthProvider;
