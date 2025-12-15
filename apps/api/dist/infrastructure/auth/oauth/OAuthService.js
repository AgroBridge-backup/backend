import * as crypto from 'crypto';
import jwt from 'jsonwebtoken';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { OAuthProviderType, UserRole } from '@prisma/client';
import { googleOAuthProvider } from './GoogleOAuthProvider.js';
import { gitHubOAuthProvider } from './GitHubOAuthProvider.js';
import { redisClient } from '../../cache/RedisClient.js';
import { prisma } from '../../database/prisma/client.js';
import logger from '../../../shared/utils/logger.js';
const privateKeyPath = process.env.JWT_PRIVATE_KEY_PATH || './jwtRS256.key';
const resolvedPath = path.resolve(process.cwd(), privateKeyPath);
let JWT_PRIVATE_KEY;
try {
    JWT_PRIVATE_KEY = fs.readFileSync(resolvedPath, 'utf-8');
}
catch {
    logger.warn('[OAuthService] JWT private key not found, OAuth login will fail');
    JWT_PRIVATE_KEY = '';
}
const ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_TOKEN_TTL || '15m';
const REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_TOKEN_TTL || '7d';
export class OAuthService {
    static instance = null;
    stateExpiry = 600;
    constructor() { }
    static getInstance() {
        if (!OAuthService.instance) {
            OAuthService.instance = new OAuthService();
        }
        return OAuthService.instance;
    }
    async getLoginUrl(provider, redirectUrl) {
        const state = await this.createState(provider, 'login', undefined, redirectUrl);
        return this.getAuthorizationUrl(provider, state);
    }
    async getLinkUrl(provider, userId) {
        const state = await this.createState(provider, 'link', userId);
        return this.getAuthorizationUrl(provider, state);
    }
    getAuthorizationUrl(provider, state) {
        switch (provider) {
            case 'google':
                return googleOAuthProvider.getAuthorizationUrl(state);
            case 'github':
                return gitHubOAuthProvider.getAuthorizationUrl(state);
            default:
                throw new Error(`Unknown provider: ${provider}`);
        }
    }
    async handleCallback(code, state) {
        const stateData = await this.validateState(state);
        if (!stateData) {
            return {
                success: false,
                error: 'Invalid or expired state parameter',
                errorCode: 'INVALID_STATE',
            };
        }
        const result = await this.exchangeCode(stateData.provider, code);
        if (!result.success || !result.profile) {
            return {
                success: false,
                error: result.error || 'Failed to authenticate with provider',
                errorCode: result.errorCode || 'AUTH_FAILED',
            };
        }
        if (stateData.action === 'link') {
            return this.linkAccount(stateData.userId, stateData.provider, result.profile);
        }
        else {
            return this.authenticateWithOAuth(stateData.provider, result.profile);
        }
    }
    async exchangeCode(provider, code) {
        switch (provider) {
            case 'google':
                return googleOAuthProvider.exchangeCode(code);
            case 'github':
                return gitHubOAuthProvider.exchangeCode(code);
            default:
                return { success: false, error: 'Unknown provider', errorCode: 'UNKNOWN_PROVIDER' };
        }
    }
    async authenticateWithOAuth(provider, profile) {
        const providerId = profile.id;
        const email = profile.email;
        const providerEnum = provider === 'google' ? OAuthProviderType.GOOGLE : OAuthProviderType.GITHUB;
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
            const user = existingLink.user;
            if (!user.isActive) {
                return {
                    success: false,
                    error: 'Account is deactivated',
                    errorCode: 'ACCOUNT_INACTIVE',
                };
            }
            if (user.twoFactorEnabled) {
                const tempToken = await this.generateTempToken(user.id);
                return {
                    success: true,
                    requires2FA: true,
                    tempToken,
                };
            }
            const tokens = await this.generateAuthTokens(user);
            logger.info('[OAuthService] OAuth login successful', {
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
        const existingUser = await prisma.user.findUnique({
            where: { email },
            include: { producer: true },
        });
        if (existingUser) {
            await this.createOAuthLink(existingUser.id, provider, profile);
            if (!existingUser.isActive) {
                return {
                    success: false,
                    error: 'Account is deactivated',
                    errorCode: 'ACCOUNT_INACTIVE',
                };
            }
            if (existingUser.twoFactorEnabled) {
                const tempToken = await this.generateTempToken(existingUser.id);
                return {
                    success: true,
                    requires2FA: true,
                    tempToken,
                };
            }
            const tokens = await this.generateAuthTokens(existingUser);
            logger.info('[OAuthService] OAuth linked to existing account', {
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
        const newUser = await this.createOAuthUser(provider, profile);
        const tokens = await this.generateAuthTokens(newUser);
        logger.info('[OAuthService] New user created via OAuth', {
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
    async createOAuthUser(provider, profile) {
        let firstName;
        let lastName;
        if ('givenName' in profile) {
            firstName = profile.givenName;
            lastName = profile.familyName;
        }
        else {
            const nameParts = (profile.name || profile.login).split(' ');
            firstName = nameParts[0] || profile.login;
            lastName = nameParts.slice(1).join(' ') || '';
        }
        const avatarUrl = 'picture' in profile ? profile.picture : profile.avatarUrl;
        const displayName = 'name' in profile && profile.name ? profile.name : ('login' in profile ? profile.login : firstName);
        const user = await prisma.user.create({
            data: {
                email: profile.email,
                firstName,
                lastName,
                role: UserRole.BUYER,
                passwordHash: null,
                isActive: true,
                oauthProviders: {
                    create: {
                        provider: provider === 'google' ? OAuthProviderType.GOOGLE : OAuthProviderType.GITHUB,
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
    async linkAccount(userId, provider, profile) {
        const providerEnum = provider === 'google' ? OAuthProviderType.GOOGLE : OAuthProviderType.GITHUB;
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
                errorCode: 'ALREADY_LINKED',
            };
        }
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
                errorCode: 'PROVIDER_IN_USE',
            };
        }
        await this.createOAuthLink(userId, provider, profile);
        logger.info('[OAuthService] OAuth account linked', {
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
    async createOAuthLink(userId, provider, profile) {
        const providerEnum = provider === 'google' ? OAuthProviderType.GOOGLE : OAuthProviderType.GITHUB;
        const avatarUrl = 'picture' in profile ? profile.picture : profile.avatarUrl;
        const displayName = 'name' in profile && profile.name ? profile.name : ('login' in profile ? profile.login : '');
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
    async unlinkAccount(userId, provider) {
        const providerEnum = provider === 'google' ? OAuthProviderType.GOOGLE : OAuthProviderType.GITHUB;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                oauthProviders: true,
            },
        });
        if (!user) {
            return {
                success: false,
                error: 'User not found',
                errorCode: 'USER_NOT_FOUND',
            };
        }
        const hasPassword = !!user.passwordHash;
        const otherProviders = user.oauthProviders.filter(p => p.provider !== providerEnum);
        if (!hasPassword && otherProviders.length === 0) {
            return {
                success: false,
                error: 'Cannot unlink - no other login method available. Set a password first.',
                errorCode: 'NO_LOGIN_METHOD',
            };
        }
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
                errorCode: 'NOT_LINKED',
            };
        }
        logger.info('[OAuthService] OAuth account unlinked', {
            userId,
            provider,
        });
        return {
            success: true,
            provider,
        };
    }
    async getLinkedProviders(userId) {
        const providers = await prisma.oAuthProvider.findMany({
            where: { userId },
            orderBy: { createdAt: 'asc' },
        });
        return providers.map(p => ({
            provider: p.provider.toLowerCase(),
            providerId: p.providerId,
            email: p.email,
            displayName: p.displayName,
            linkedAt: p.createdAt,
        }));
    }
    async createState(provider, action, userId, redirectUrl) {
        const state = crypto.randomBytes(32).toString('hex');
        const stateData = {
            provider,
            action,
            userId,
            redirectUrl,
            createdAt: Date.now(),
        };
        await redisClient.client.setex(`oauth:state:${state}`, this.stateExpiry, JSON.stringify(stateData));
        return state;
    }
    async validateState(state) {
        const key = `oauth:state:${state}`;
        const data = await redisClient.client.get(key);
        if (!data) {
            return null;
        }
        await redisClient.client.del(key);
        return JSON.parse(data);
    }
    async generateAuthTokens(user) {
        const accessToken = this.generateAccessToken(user);
        const refreshToken = this.generateRefreshToken(user);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        await prisma.refreshToken.create({
            data: {
                userId: user.id,
                token: refreshToken,
                expiresAt,
            },
        });
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });
        return { accessToken, refreshToken };
    }
    generateAccessToken(user) {
        const payload = {
            sub: user.id,
            role: user.role,
            email: user.email,
            ...(user.producer && { producerId: user.producer.id }),
        };
        return jwt.sign(payload, JWT_PRIVATE_KEY, {
            algorithm: 'RS256',
            expiresIn: ACCESS_TOKEN_TTL,
            jwtid: crypto.randomUUID(),
        });
    }
    generateRefreshToken(user) {
        return jwt.sign({ sub: user.id }, JWT_PRIVATE_KEY, {
            algorithm: 'RS256',
            expiresIn: REFRESH_TOKEN_TTL,
            jwtid: crypto.randomUUID(),
        });
    }
    async generateTempToken(userId) {
        const token = crypto.randomBytes(32).toString('hex');
        await redisClient.client.setex(`oauth:2fa:${token}`, 300, userId);
        return token;
    }
    async validateTempToken(token) {
        const key = `oauth:2fa:${token}`;
        const userId = await redisClient.client.get(key);
        if (!userId) {
            return null;
        }
        await redisClient.client.del(key);
        return userId;
    }
    async storeTokensForExchange(accessToken, refreshToken, metadata = {}) {
        const code = crypto.randomBytes(32).toString('hex');
        const key = `oauth:exchange:${code}`;
        const data = JSON.stringify({
            accessToken,
            refreshToken,
            ...metadata,
            createdAt: Date.now(),
        });
        await redisClient.client.setex(key, 60, data);
        logger.debug('[OAuthService] Token exchange code created', {
            codePrefix: code.substring(0, 8),
        });
        return code;
    }
    async exchangeCodeForTokens(code) {
        if (!/^[a-f0-9]{64}$/i.test(code)) {
            logger.warn('[OAuthService] Invalid code format in token exchange');
            return null;
        }
        const key = `oauth:exchange:${code}`;
        const data = await redisClient.client.get(key);
        if (!data) {
            logger.warn('[OAuthService] Token exchange code not found or expired', {
                codePrefix: code.substring(0, 8),
            });
            return null;
        }
        await redisClient.client.del(key);
        try {
            const parsed = JSON.parse(data);
            logger.debug('[OAuthService] Token exchange successful', {
                codePrefix: code.substring(0, 8),
            });
            return {
                accessToken: parsed.accessToken,
                refreshToken: parsed.refreshToken,
                isNewUser: parsed.isNewUser,
                requires2FA: parsed.requires2FA,
                tempToken: parsed.tempToken,
            };
        }
        catch (error) {
            logger.error('[OAuthService] Failed to parse token exchange data', { error });
            return null;
        }
    }
}
export const oAuthService = OAuthService.getInstance();
export default oAuthService;
