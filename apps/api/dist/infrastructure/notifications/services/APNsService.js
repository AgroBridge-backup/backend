import apn from '@parse/node-apn';
import * as fs from 'fs';
import * as path from 'path';
import logger from '../../../shared/utils/logger.js';
export class APNsService {
    static instance = null;
    provider = null;
    isProduction;
    bundleId;
    initialized = false;
    constructor() {
        this.isProduction = process.env.APNS_PRODUCTION === 'true';
        this.bundleId = process.env.APNS_BUNDLE_ID || 'com.agrobridge.app';
    }
    static getInstance() {
        if (!APNsService.instance) {
            APNsService.instance = new APNsService();
        }
        return APNsService.instance;
    }
    initialize() {
        if (this.initialized)
            return;
        try {
            const keyPath = process.env.APNS_KEY_PATH;
            const keyId = process.env.APNS_KEY_ID;
            const teamId = process.env.APNS_TEAM_ID;
            if (!keyPath || !keyId || !teamId) {
                logger.warn('[APNsService] APNs credentials not configured. APNs will be disabled.', {
                    hasKeyPath: !!keyPath,
                    hasKeyId: !!keyId,
                    hasTeamId: !!teamId,
                });
                return;
            }
            const fullKeyPath = path.resolve(keyPath);
            if (!fs.existsSync(fullKeyPath)) {
                logger.warn('[APNsService] APNs key file not found. APNs will be disabled.', {
                    keyPath: fullKeyPath,
                });
                return;
            }
            const options = {
                token: {
                    key: fullKeyPath,
                    keyId,
                    teamId,
                },
                production: this.isProduction,
            };
            this.provider = new apn.Provider(options);
            this.initialized = true;
            logger.info('[APNsService] APNs provider initialized successfully', {
                environment: this.isProduction ? 'production' : 'development',
                bundleId: this.bundleId,
                keyId,
            });
        }
        catch (error) {
            const err = error;
            logger.error('[APNsService] Failed to initialize APNs provider', {
                error: err.message,
                stack: err.stack,
            });
        }
    }
    isAvailable() {
        this.initialize();
        return this.initialized && this.provider !== null;
    }
    async sendToDevice(deviceToken, notification) {
        this.initialize();
        if (!this.provider) {
            return {
                success: false,
                error: 'APNs service not initialized',
                errorCode: 'NOT_INITIALIZED',
            };
        }
        if (!this.isValidToken(deviceToken)) {
            return {
                success: false,
                error: 'Invalid device token format. Expected 64 hex characters.',
                errorCode: 'INVALID_TOKEN_FORMAT',
                invalidToken: true,
            };
        }
        try {
            const apnNotification = this.buildNotification(notification);
            const startTime = Date.now();
            const result = await this.provider.send(apnNotification, deviceToken);
            const latency = Date.now() - startTime;
            if (result.failed.length > 0) {
                const failure = result.failed[0];
                const errorReason = failure.response?.reason || 'Unknown error';
                const errorStatus = failure.status;
                logger.error('[APNsService] Send failed', {
                    deviceToken: this.maskToken(deviceToken),
                    reason: errorReason,
                    status: errorStatus,
                });
                return {
                    success: false,
                    error: errorReason,
                    errorCode: String(errorStatus),
                    invalidToken: this.isInvalidTokenError(errorReason),
                    latency,
                };
            }
            const messageId = result.sent[0]?.device;
            logger.info('[APNsService] Notification sent successfully', {
                deviceToken: this.maskToken(deviceToken),
                messageId,
                latency: `${latency}ms`,
            });
            return {
                success: true,
                messageId,
                latency,
            };
        }
        catch (error) {
            const err = error;
            logger.error('[APNsService] Send error', {
                error: err.message,
                deviceToken: this.maskToken(deviceToken),
            });
            return {
                success: false,
                error: err.message,
            };
        }
    }
    async sendToDevices(deviceTokens, notification) {
        this.initialize();
        if (!this.provider) {
            return {
                successCount: 0,
                failureCount: deviceTokens.length,
                invalidTokens: [],
                avgLatency: 0,
            };
        }
        if (deviceTokens.length === 0) {
            return {
                successCount: 0,
                failureCount: 0,
                invalidTokens: [],
                avgLatency: 0,
            };
        }
        const validTokens = deviceTokens.filter((t) => this.isValidToken(t));
        const invalidFormatTokens = deviceTokens.filter((t) => !this.isValidToken(t));
        if (validTokens.length === 0) {
            return {
                successCount: 0,
                failureCount: deviceTokens.length,
                invalidTokens: invalidFormatTokens,
                avgLatency: 0,
            };
        }
        const apnNotification = this.buildNotification(notification);
        const startTime = Date.now();
        try {
            const result = await this.provider.send(apnNotification, validTokens);
            const totalLatency = Date.now() - startTime;
            const invalidTokens = [...invalidFormatTokens];
            result.failed.forEach((failure) => {
                const reason = failure.response?.reason;
                if (reason && this.isInvalidTokenError(reason)) {
                    invalidTokens.push(failure.device);
                }
            });
            logger.info('[APNsService] Batch send completed', {
                totalTokens: deviceTokens.length,
                successCount: result.sent.length,
                failureCount: result.failed.length,
                invalidTokens: invalidTokens.length,
                avgLatency: `${Math.round(totalLatency / validTokens.length)}ms`,
            });
            return {
                successCount: result.sent.length,
                failureCount: result.failed.length + invalidFormatTokens.length,
                invalidTokens,
                avgLatency: validTokens.length > 0 ? totalLatency / validTokens.length : 0,
            };
        }
        catch (error) {
            const err = error;
            logger.error('[APNsService] Batch send error', {
                error: err.message,
                tokenCount: validTokens.length,
            });
            return {
                successCount: 0,
                failureCount: deviceTokens.length,
                invalidTokens: invalidFormatTokens,
                avgLatency: 0,
            };
        }
    }
    async sendSilentNotification(deviceToken, data) {
        this.initialize();
        if (!this.provider) {
            return {
                success: false,
                error: 'APNs service not initialized',
                errorCode: 'NOT_INITIALIZED',
            };
        }
        if (!this.isValidToken(deviceToken)) {
            return {
                success: false,
                error: 'Invalid device token format',
                errorCode: 'INVALID_TOKEN_FORMAT',
                invalidToken: true,
            };
        }
        try {
            const notification = new apn.Notification();
            notification.contentAvailable = true;
            notification.pushType = 'background';
            notification.priority = 5;
            notification.topic = this.bundleId;
            notification.payload = data;
            notification.expiry = Math.floor(Date.now() / 1000) + 3600;
            const startTime = Date.now();
            const result = await this.provider.send(notification, deviceToken);
            const latency = Date.now() - startTime;
            if (result.failed.length > 0) {
                const failure = result.failed[0];
                return {
                    success: false,
                    error: failure.response?.reason || 'Unknown error',
                    invalidToken: this.isInvalidTokenError(failure.response?.reason),
                    latency,
                };
            }
            logger.info('[APNsService] Silent notification sent', {
                deviceToken: this.maskToken(deviceToken),
                latency: `${latency}ms`,
            });
            return {
                success: true,
                latency,
            };
        }
        catch (error) {
            const err = error;
            logger.error('[APNsService] Silent notification failed', {
                error: err.message,
                deviceToken: this.maskToken(deviceToken),
            });
            return {
                success: false,
                error: err.message,
            };
        }
    }
    buildNotification(payload) {
        const notification = new apn.Notification();
        notification.alert = {
            title: payload.title,
            body: payload.body,
        };
        notification.sound = payload.sound || 'default';
        if (payload.badge !== undefined) {
            notification.badge = payload.badge;
        }
        if (payload.category) {
            notification.category = payload.category;
        }
        if (payload.data) {
            notification.payload = payload.data;
        }
        if (payload.threadId) {
            notification.threadId = payload.threadId;
        }
        notification.pushType = 'alert';
        notification.priority = payload.priority || 10;
        notification.topic = this.bundleId;
        const ttl = payload.ttl || 86400;
        notification.expiry = Math.floor(Date.now() / 1000) + ttl;
        if (payload.contentAvailable) {
            notification.contentAvailable = true;
        }
        if (payload.mutableContent) {
            notification.mutableContent = true;
        }
        return notification;
    }
    isValidToken(token) {
        const cleanToken = token.replace(/[\s-]/g, '');
        return /^[0-9a-f]{64}$/i.test(cleanToken);
    }
    isInvalidTokenError(reason) {
        if (!reason)
            return false;
        const invalidReasons = [
            'BadDeviceToken',
            'Unregistered',
            'DeviceTokenNotForTopic',
            'InvalidProviderToken',
            'ExpiredProviderToken',
        ];
        return invalidReasons.includes(reason);
    }
    maskToken(token) {
        if (token.length < 20)
            return '***';
        return `${token.substring(0, 10)}...${token.substring(token.length - 6)}`;
    }
    shutdown() {
        if (this.provider) {
            this.provider.shutdown();
            this.provider = null;
            this.initialized = false;
            logger.info('[APNsService] Provider shutdown complete');
        }
    }
}
export const apnsService = APNsService.getInstance();
export default apnsService;
