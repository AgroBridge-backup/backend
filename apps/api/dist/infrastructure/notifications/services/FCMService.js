import * as admin from 'firebase-admin';
import logger from '../../../shared/utils/logger.js';
export class FCMService {
    static instance = null;
    app = null;
    messaging = null;
    initialized = false;
    constructor() {
    }
    static getInstance() {
        if (!FCMService.instance) {
            FCMService.instance = new FCMService();
        }
        return FCMService.instance;
    }
    initialize() {
        if (this.initialized)
            return;
        try {
            if (admin.apps.length > 0) {
                this.app = admin.app();
                this.messaging = admin.messaging(this.app);
                this.initialized = true;
                logger.info('[FCMService] Using existing Firebase app instance');
                return;
            }
            const projectId = process.env.FIREBASE_PROJECT_ID;
            const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
            const privateKey = process.env.FIREBASE_PRIVATE_KEY;
            if (!projectId || !clientEmail || !privateKey) {
                logger.warn('[FCMService] Firebase credentials not configured. FCM will be disabled.', {
                    hasProjectId: !!projectId,
                    hasClientEmail: !!clientEmail,
                    hasPrivateKey: !!privateKey,
                });
                return;
            }
            const serviceAccount = {
                projectId,
                clientEmail,
                privateKey: privateKey.replace(/\\n/g, '\n'),
            };
            this.app = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
            this.messaging = admin.messaging(this.app);
            this.initialized = true;
            logger.info('[FCMService] Firebase Admin SDK initialized successfully', {
                projectId,
                clientEmail: this.maskEmail(clientEmail),
            });
        }
        catch (error) {
            const err = error;
            logger.error('[FCMService] Failed to initialize Firebase Admin SDK', {
                error: err.message,
                stack: err.stack,
            });
        }
    }
    isAvailable() {
        this.initialize();
        return this.initialized && this.messaging !== null;
    }
    async sendToDevice(token, notification) {
        this.initialize();
        if (!this.messaging) {
            return {
                success: false,
                error: 'FCM service not initialized',
                errorCode: 'NOT_INITIALIZED',
            };
        }
        try {
            const message = this.buildMessage(token, notification);
            const startTime = Date.now();
            const messageId = await this.messaging.send(message);
            const latency = Date.now() - startTime;
            logger.info('[FCMService] Notification sent successfully', {
                messageId,
                token: this.maskToken(token),
                latency: `${latency}ms`,
                type: notification.type,
            });
            return {
                success: true,
                messageId,
                latency,
            };
        }
        catch (error) {
            return this.handleError(error, token);
        }
    }
    async sendToDevices(tokens, notification) {
        this.initialize();
        if (!this.messaging) {
            return {
                successCount: 0,
                failureCount: tokens.length,
                invalidTokens: [],
                avgLatency: 0,
                results: [],
            };
        }
        if (tokens.length === 0) {
            return {
                successCount: 0,
                failureCount: 0,
                invalidTokens: [],
                avgLatency: 0,
                results: [],
            };
        }
        const batches = this.chunkArray(tokens, 500);
        const allResults = [];
        const invalidTokens = [];
        const startTime = Date.now();
        for (const batch of batches) {
            try {
                const message = this.buildMulticastMessage(batch, notification);
                const result = await this.messaging.sendEachForMulticast(message);
                allResults.push(result);
                result.responses.forEach((response, index) => {
                    if (!response.success && this.isInvalidTokenError(response.error)) {
                        invalidTokens.push(batch[index]);
                    }
                });
            }
            catch (error) {
                const err = error;
                logger.error('[FCMService] Batch send failed', {
                    error: err.message,
                    batchSize: batch.length,
                });
            }
        }
        const totalLatency = Date.now() - startTime;
        const totalSuccess = allResults.reduce((sum, r) => sum + r.successCount, 0);
        const totalFailure = allResults.reduce((sum, r) => sum + r.failureCount, 0);
        logger.info('[FCMService] Batch send completed', {
            totalTokens: tokens.length,
            successCount: totalSuccess,
            failureCount: totalFailure,
            invalidTokens: invalidTokens.length,
            avgLatency: `${Math.round(totalLatency / batches.length)}ms`,
            type: notification.type,
        });
        return {
            successCount: totalSuccess,
            failureCount: totalFailure,
            invalidTokens,
            avgLatency: batches.length > 0 ? totalLatency / batches.length : 0,
            results: allResults.flatMap((r) => r.responses.map((resp, idx) => ({
                success: resp.success,
                messageId: resp.messageId,
                error: resp.error?.message,
            }))),
        };
    }
    async sendToTopic(topic, notification) {
        this.initialize();
        if (!this.messaging) {
            return {
                success: false,
                error: 'FCM service not initialized',
                errorCode: 'NOT_INITIALIZED',
            };
        }
        try {
            const message = this.buildTopicMessage(topic, notification);
            const startTime = Date.now();
            const messageId = await this.messaging.send(message);
            const latency = Date.now() - startTime;
            logger.info('[FCMService] Topic notification sent', {
                messageId,
                topic,
                latency: `${latency}ms`,
                type: notification.type,
            });
            return {
                success: true,
                messageId,
                latency,
            };
        }
        catch (error) {
            const err = error;
            logger.error('[FCMService] Topic send failed', {
                error: err.message,
                topic,
            });
            return {
                success: false,
                error: err.message,
                errorCode: error.code,
            };
        }
    }
    async subscribeToTopic(tokens, topic) {
        this.initialize();
        if (!this.messaging || tokens.length === 0)
            return;
        try {
            const response = await this.messaging.subscribeToTopic(tokens, topic);
            logger.info('[FCMService] Devices subscribed to topic', {
                topic,
                successCount: response.successCount,
                failureCount: response.failureCount,
            });
        }
        catch (error) {
            const err = error;
            logger.error('[FCMService] Failed to subscribe to topic', {
                error: err.message,
                topic,
                tokenCount: tokens.length,
            });
            throw error;
        }
    }
    async unsubscribeFromTopic(tokens, topic) {
        this.initialize();
        if (!this.messaging || tokens.length === 0)
            return;
        try {
            const response = await this.messaging.unsubscribeFromTopic(tokens, topic);
            logger.info('[FCMService] Devices unsubscribed from topic', {
                topic,
                successCount: response.successCount,
                failureCount: response.failureCount,
            });
        }
        catch (error) {
            const err = error;
            logger.error('[FCMService] Failed to unsubscribe from topic', {
                error: err.message,
                topic,
            });
            throw error;
        }
    }
    buildMessage(token, notification) {
        return {
            token,
            notification: {
                title: notification.title,
                body: notification.body,
                imageUrl: notification.imageUrl,
            },
            data: notification.data ? this.stringifyData(notification.data) : undefined,
            android: {
                priority: 'high',
                notification: {
                    channelId: this.getChannelId(notification.type),
                    sound: 'default',
                    color: '#2E7D32',
                    clickAction: 'FLUTTER_NOTIFICATION_CLICK',
                    defaultSound: true,
                    defaultVibrateTimings: true,
                },
                ttl: notification.ttl || 86400000,
            },
            apns: {
                payload: {
                    aps: {
                        alert: {
                            title: notification.title,
                            body: notification.body,
                        },
                        sound: 'default',
                        badge: notification.badge ?? 1,
                        contentAvailable: true,
                    },
                },
                fcmOptions: {
                    imageUrl: notification.imageUrl,
                },
            },
            webpush: {
                notification: {
                    title: notification.title,
                    body: notification.body,
                    icon: notification.imageUrl || '/icons/notification-icon.png',
                },
                fcmOptions: {
                    link: notification.data?.deepLink,
                },
            },
        };
    }
    buildMulticastMessage(tokens, notification) {
        return {
            tokens,
            notification: {
                title: notification.title,
                body: notification.body,
                imageUrl: notification.imageUrl,
            },
            data: notification.data ? this.stringifyData(notification.data) : undefined,
            android: {
                priority: 'high',
                notification: {
                    channelId: this.getChannelId(notification.type),
                    sound: 'default',
                    color: '#2E7D32',
                },
                ttl: notification.ttl || 86400000,
            },
            apns: {
                payload: {
                    aps: {
                        alert: {
                            title: notification.title,
                            body: notification.body,
                        },
                        sound: 'default',
                        badge: notification.badge ?? 1,
                    },
                },
            },
        };
    }
    buildTopicMessage(topic, notification) {
        const baseMessage = this.buildMessage('', notification);
        delete baseMessage.token;
        return {
            ...baseMessage,
            topic,
        };
    }
    getChannelId(type) {
        switch (type) {
            case 'SENSOR_ALERT':
            case 'SENSOR_WARNING':
                return 'agrobridge_alerts';
            case 'BATCH_CREATED':
            case 'BATCH_UPDATED':
            case 'BATCH_VERIFIED':
            case 'CERTIFICATE_READY':
                return 'agrobridge_batches';
            case 'ORDER_CREATED':
            case 'ORDER_CONFIRMED':
            case 'ORDER_SHIPPED':
            case 'ORDER_DELIVERED':
            case 'PAYMENT_RECEIVED':
            case 'PAYMENT_FAILED':
                return 'agrobridge_orders';
            case 'SYSTEM_ANNOUNCEMENT':
                return 'agrobridge_announcements';
            default:
                return 'agrobridge_default';
        }
    }
    stringifyData(data) {
        const stringData = {};
        for (const [key, value] of Object.entries(data)) {
            if (value !== undefined && value !== null) {
                stringData[key] = typeof value === 'string' ? value : JSON.stringify(value);
            }
        }
        return stringData;
    }
    handleError(error, token) {
        const err = error;
        const errorCode = err.code || 'UNKNOWN';
        const errorMessage = err.message || 'Unknown error';
        logger.error('[FCMService] Send failed', {
            errorCode,
            errorMessage,
            token: this.maskToken(token),
        });
        const invalidToken = this.isInvalidTokenError(err);
        const shouldRetry = this.shouldRetryError(err);
        return {
            success: false,
            error: errorMessage,
            errorCode,
            invalidToken,
            shouldRetry,
        };
    }
    isInvalidTokenError(error) {
        if (!error)
            return false;
        const invalidCodes = [
            'messaging/invalid-registration-token',
            'messaging/registration-token-not-registered',
            'messaging/invalid-argument',
            'messaging/unregistered',
        ];
        return invalidCodes.includes(error.code);
    }
    shouldRetryError(error) {
        if (!error)
            return false;
        const retryCodes = [
            'messaging/internal-error',
            'messaging/server-unavailable',
            'messaging/too-many-requests',
            'messaging/device-message-rate-exceeded',
        ];
        return retryCodes.includes(error.code);
    }
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
    maskToken(token) {
        if (token.length < 20)
            return '***';
        return `${token.substring(0, 10)}...${token.substring(token.length - 6)}`;
    }
    maskEmail(email) {
        const [local, domain] = email.split('@');
        if (!domain)
            return '***';
        return `${local.substring(0, 3)}...@${domain}`;
    }
}
export const fcmService = FCMService.getInstance();
export default fcmService;
