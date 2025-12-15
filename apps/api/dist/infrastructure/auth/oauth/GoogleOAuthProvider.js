import logger from '../../../shared/utils/logger.js';
export class GoogleOAuthProvider {
    static instance = null;
    config = null;
    authUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    tokenUrl = 'https://oauth2.googleapis.com/token';
    userInfoUrl = 'https://www.googleapis.com/oauth2/v2/userinfo';
    constructor() {
        this.initializeConfig();
    }
    static getInstance() {
        if (!GoogleOAuthProvider.instance) {
            GoogleOAuthProvider.instance = new GoogleOAuthProvider();
        }
        return GoogleOAuthProvider.instance;
    }
    initializeConfig() {
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
        }
        else {
            logger.warn('[GoogleOAuthProvider] Not configured - missing credentials');
        }
    }
    isAvailable() {
        return this.config !== null;
    }
    getAuthorizationUrl(state, scopes = ['openid', 'email', 'profile']) {
        if (!this.config) {
            throw new Error('Google OAuth not configured');
        }
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            response_type: 'code',
            scope: scopes.join(' '),
            state,
            access_type: 'offline',
            prompt: 'consent',
        });
        return `${this.authUrl}?${params.toString()}`;
    }
    async exchangeCode(code) {
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
            const tokens = {
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                idToken: data.id_token,
                expiresIn: data.expires_in,
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
            logger.info('[GoogleOAuthProvider] Authentication successful', {
                userId: profile.id,
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
    async getUserProfile(accessToken) {
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
        }
        catch (error) {
            logger.error('[GoogleOAuthProvider] Profile error', {
                error: error.message,
            });
            return null;
        }
    }
    async refreshAccessToken(refreshToken) {
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
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
                errorCode: 'REFRESH_ERROR',
            };
        }
    }
    async revokeToken(token) {
        try {
            const response = await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });
            return response.ok;
        }
        catch (error) {
            logger.error('[GoogleOAuthProvider] Revoke error', {
                error: error.message,
            });
            return false;
        }
    }
}
export const googleOAuthProvider = GoogleOAuthProvider.getInstance();
export default googleOAuthProvider;
