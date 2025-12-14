import Bull from 'bull';
import { PrismaClient } from '@prisma/client';
import logger from '../../../shared/utils/logger.js';
import { fcmService } from '../services/FCMService.js';
import { apnsService } from '../services/APNsService.js';
import { emailService } from '../services/EmailService.js';
import { smsService } from '../services/SMSService.js';
const prisma = new PrismaClient();
export class NotificationQueue {
    static instance = null;
    queue = null;
    initialized = false;
    processing = false;
    constructor() {
    }
    static getInstance() {
        if (!NotificationQueue.instance) {
            NotificationQueue.instance = new NotificationQueue();
        }
        return NotificationQueue.instance;
    }
    initialize() {
        if (this.initialized)
            return;
        try {
            const redisConfig = {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                password: process.env.REDIS_PASSWORD || undefined,
                db: parseInt(process.env.REDIS_DB || '0'),
            };
            this.queue = new Bull('notifications', {
                redis: redisConfig,
                defaultJobOptions: {
                    attempts: parseInt(process.env.NOTIFICATION_RETRY_ATTEMPTS || '3'),
                    backoff: {
                        type: 'exponential',
                        delay: parseInt(process.env.NOTIFICATION_RETRY_DELAY || '2000'),
                    },
                    removeOnComplete: 100,
                    removeOnFail: 500,
                },
                limiter: {
                    max: parseInt(process.env.NOTIFICATION_RATE_LIMIT || '1000'),
                    duration: 60000,
                },
                settings: {
                    stalledInterval: 30000,
                    maxStalledCount: 1,
                },
            });
            this.setupEventHandlers();
            this.initialized = true;
            logger.info('[NotificationQueue] Queue initialized successfully', {
                redis: `${redisConfig.host}:${redisConfig.port}`,
                db: redisConfig.db,
            });
        }
        catch (error) {
            const err = error;
            logger.error('[NotificationQueue] Failed to initialize queue', {
                error: err.message,
                stack: err.stack,
            });
        }
    }
    setupEventHandlers() {
        if (!this.queue)
            return;
        this.queue.on('completed', (job, result) => {
            const duration = job.finishedOn && job.processedOn
                ? job.finishedOn - job.processedOn
                : 0;
            logger.info('[NotificationQueue] Job completed', {
                jobId: job.id,
                notificationId: job.data.notificationId,
                duration: `${duration}ms`,
                type: job.data.type,
            });
        });
        this.queue.on('failed', (job, error) => {
            logger.error('[NotificationQueue] Job failed', {
                jobId: job.id,
                notificationId: job.data.notificationId,
                error: error.message,
                attempts: job.attemptsMade,
                type: job.data.type,
            });
        });
        this.queue.on('stalled', (job) => {
            logger.warn('[NotificationQueue] Job stalled', {
                jobId: job.id,
                notificationId: job.data.notificationId,
            });
        });
        this.queue.on('error', (error) => {
            logger.error('[NotificationQueue] Queue error', {
                error: error.message,
            });
        });
        this.queue.on('waiting', (jobId) => {
            logger.debug('[NotificationQueue] Job waiting', { jobId });
        });
        this.queue.on('active', (job) => {
            logger.debug('[NotificationQueue] Job active', {
                jobId: job.id,
                notificationId: job.data.notificationId,
            });
        });
    }
    async startProcessing(concurrency = 10) {
        this.initialize();
        if (!this.queue || this.processing)
            return;
        this.processing = true;
        this.queue.process(concurrency, async (job) => {
            return await this.processNotification(job);
        });
        logger.info('[NotificationQueue] Started processing jobs', {
            concurrency,
        });
    }
    async enqueue(job, options) {
        this.initialize();
        if (!this.queue) {
            logger.error('[NotificationQueue] Queue not initialized');
            return null;
        }
        try {
            const jobOptions = {
                jobId: job.notificationId,
                priority: this.getPriorityNumber(job.priority),
                ...options,
            };
            const queuedJob = await this.queue.add(job, jobOptions);
            logger.info('[NotificationQueue] Job enqueued', {
                jobId: queuedJob.id,
                notificationId: job.notificationId,
                channels: job.channels,
                priority: job.priority,
            });
            return queuedJob.id;
        }
        catch (error) {
            const err = error;
            logger.error('[NotificationQueue] Failed to enqueue job', {
                error: err.message,
                notificationId: job.notificationId,
            });
            return null;
        }
    }
    async processNotification(job) {
        const { notificationId, userId, channels, title, body, data, type, priority } = job.data;
        logger.info('[NotificationQueue] Processing notification', {
            jobId: job.id,
            notificationId,
            channels,
            attempt: job.attemptsMade + 1,
        });
        try {
            await prisma.notification.update({
                where: { id: notificationId },
                data: {
                    status: 'SENT',
                    sentAt: new Date(),
                    retryCount: job.attemptsMade,
                },
            });
            const results = await Promise.allSettled([
                channels.includes('PUSH') ? this.sendPush(job.data) : Promise.resolve(null),
                channels.includes('EMAIL') ? this.sendEmail(job.data) : Promise.resolve(null),
                channels.includes('SMS') ? this.sendSMS(job.data) : Promise.resolve(null),
                channels.includes('WHATSAPP') ? this.sendWhatsApp(job.data) : Promise.resolve(null),
            ]);
            const channelResults = results.map((r, index) => {
                const channel = ['PUSH', 'EMAIL', 'SMS', 'WHATSAPP'][index];
                if (r.status === 'fulfilled' && r.value !== null) {
                    return { channel, success: r.value, error: null };
                }
                else if (r.status === 'rejected') {
                    return { channel, success: false, error: r.reason?.message || 'Unknown error' };
                }
                return null;
            }).filter(Boolean);
            const anySuccess = channelResults.some((r) => r?.success);
            const allFailed = channelResults.length > 0 && !anySuccess;
            for (const result of channelResults) {
                if (!result)
                    continue;
                await prisma.notificationDeliveryLog.create({
                    data: {
                        notificationId,
                        channel: result.channel,
                        status: result.success ? 'SUCCESS' : 'FAILED',
                        providerError: result.error || undefined,
                        attemptedAt: new Date(),
                        deliveredAt: result.success ? new Date() : undefined,
                        attempt: job.attemptsMade + 1,
                    },
                });
            }
            if (anySuccess) {
                await prisma.notification.update({
                    where: { id: notificationId },
                    data: {
                        status: 'DELIVERED',
                        deliveredAt: new Date(),
                    },
                });
                logger.info('[NotificationQueue] Notification delivered', {
                    notificationId,
                    successChannels: channelResults.filter((r) => r?.success).map((r) => r?.channel),
                });
            }
            else if (allFailed) {
                throw new Error('All channels failed');
            }
        }
        catch (error) {
            const err = error;
            logger.error('[NotificationQueue] Notification processing failed', {
                notificationId,
                error: err.message,
                attempt: job.attemptsMade + 1,
            });
            if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
                await prisma.notification.update({
                    where: { id: notificationId },
                    data: {
                        status: 'FAILED',
                        failedAt: new Date(),
                        errorMessage: err.message,
                    },
                });
            }
            throw error;
        }
    }
    async sendPush(job) {
        const { userId, title, body, data, type } = job;
        try {
            const devices = await prisma.deviceToken.findMany({
                where: {
                    userId,
                    active: true,
                },
            });
            if (devices.length === 0) {
                logger.warn('[NotificationQueue] No device tokens found', { userId });
                return false;
            }
            const iosTokens = devices
                .filter((d) => d.platform === 'IOS')
                .map((d) => d.token);
            const androidTokens = devices
                .filter((d) => d.platform === 'ANDROID' || d.platform === 'WEB')
                .map((d) => d.token);
            let anySuccess = false;
            if (iosTokens.length > 0 && apnsService.isAvailable()) {
                const result = await apnsService.sendToDevices(iosTokens, {
                    title,
                    body,
                    data: data || {},
                });
                if (result.successCount > 0)
                    anySuccess = true;
                if (result.invalidTokens.length > 0) {
                    await prisma.deviceToken.updateMany({
                        where: { token: { in: result.invalidTokens } },
                        data: { active: false },
                    });
                    logger.info('[NotificationQueue] Deactivated invalid APNs tokens', {
                        count: result.invalidTokens.length,
                    });
                }
            }
            if (androidTokens.length > 0 && fcmService.isAvailable()) {
                const result = await fcmService.sendToDevices(androidTokens, {
                    title,
                    body,
                    data: data || {},
                    type,
                });
                if (result.successCount > 0)
                    anySuccess = true;
                if (result.invalidTokens.length > 0) {
                    await prisma.deviceToken.updateMany({
                        where: { token: { in: result.invalidTokens } },
                        data: { active: false },
                    });
                    logger.info('[NotificationQueue] Deactivated invalid FCM tokens', {
                        count: result.invalidTokens.length,
                    });
                }
            }
            return anySuccess;
        }
        catch (error) {
            const err = error;
            logger.error('[NotificationQueue] Push notification failed', {
                error: err.message,
                userId,
            });
            return false;
        }
    }
    async sendEmail(job) {
        const { userId, title, body, data, type } = job;
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { email: true, firstName: true },
            });
            if (!user?.email) {
                logger.warn('[NotificationQueue] User has no email', { userId });
                return false;
            }
            if (!emailService.isAvailable()) {
                logger.warn('[NotificationQueue] Email service not available');
                return false;
            }
            const result = await emailService.sendEmail({
                to: user.email,
                subject: title,
                html: this.generateEmailHtml(title, body, data, type, user.firstName),
                categories: [type, 'notification'],
                customArgs: {
                    notificationType: type,
                    ...(data?.entityId && { entityId: data.entityId }),
                },
            });
            return result.success;
        }
        catch (error) {
            const err = error;
            logger.error('[NotificationQueue] Email notification failed', {
                error: err.message,
                userId,
            });
            return false;
        }
    }
    async sendSMS(job) {
        const { userId, body } = job;
        try {
            const preferences = await prisma.notificationPreference.findUnique({
                where: { userId },
                select: { phoneNumber: true, phoneVerified: true, smsEnabled: true },
            });
            if (!preferences?.phoneNumber || !preferences.smsEnabled) {
                logger.warn('[NotificationQueue] User has no verified phone or SMS disabled', { userId });
                return false;
            }
            if (!smsService.isAvailable()) {
                logger.warn('[NotificationQueue] SMS service not available');
                return false;
            }
            const result = await smsService.sendSMS(preferences.phoneNumber, body);
            return result.success;
        }
        catch (error) {
            const err = error;
            logger.error('[NotificationQueue] SMS notification failed', {
                error: err.message,
                userId,
            });
            return false;
        }
    }
    async sendWhatsApp(job) {
        const { userId, body } = job;
        try {
            const preferences = await prisma.notificationPreference.findUnique({
                where: { userId },
                select: { phoneNumber: true, whatsappEnabled: true },
            });
            if (!preferences?.phoneNumber || !preferences.whatsappEnabled) {
                logger.warn('[NotificationQueue] User has no phone or WhatsApp disabled', { userId });
                return false;
            }
            if (!smsService.isWhatsAppAvailable()) {
                logger.warn('[NotificationQueue] WhatsApp service not available');
                return false;
            }
            const result = await smsService.sendWhatsApp(preferences.phoneNumber, body);
            return result.success;
        }
        catch (error) {
            const err = error;
            logger.error('[NotificationQueue] WhatsApp notification failed', {
                error: err.message,
                userId,
            });
            return false;
        }
    }
    generateEmailHtml(title, body, data, type, userName) {
        const appUrl = process.env.APP_URL || 'https://app.agrobridge.io';
        return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #1B5E20 0%, #2E7D32 100%); color: white; padding: 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700;">${title}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px;">
              ${userName ? `<p style="margin-bottom: 16px;">Hola ${userName},</p>` : ''}
              <p style="margin-bottom: 24px;">${body}</p>
              ${data?.deepLink ? `
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center">
                    <a href="${appUrl}${data.deepLink}" style="display: inline-block; background: #2E7D32; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                      Ver Detalles
                    </a>
                  </td>
                </tr>
              </table>
              ` : ''}
            </td>
          </tr>
          <tr>
            <td style="text-align: center; padding: 20px; color: #999; font-size: 12px; border-top: 1px solid #E0E0E0;">
              <p style="margin: 0;">© ${new Date().getFullYear()} AgroBridge. Todos los derechos reservados.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
    }
    getPriorityNumber(priority) {
        switch (priority) {
            case 'CRITICAL':
                return 1;
            case 'HIGH':
                return 5;
            case 'LOW':
                return 15;
            default:
                return 10;
        }
    }
    async getStats() {
        this.initialize();
        if (!this.queue) {
            return {
                waiting: 0,
                active: 0,
                completed: 0,
                failed: 0,
                delayed: 0,
            };
        }
        const [waiting, active, completed, failed, delayed] = await Promise.all([
            this.queue.getWaitingCount(),
            this.queue.getActiveCount(),
            this.queue.getCompletedCount(),
            this.queue.getFailedCount(),
            this.queue.getDelayedCount(),
        ]);
        return { waiting, active, completed, failed, delayed };
    }
    async pause() {
        if (!this.queue)
            return;
        await this.queue.pause();
        logger.info('[NotificationQueue] Queue paused');
    }
    async resume() {
        if (!this.queue)
            return;
        await this.queue.resume();
        logger.info('[NotificationQueue] Queue resumed');
    }
    async clean(ageInHours = 24) {
        if (!this.queue)
            return;
        const timestamp = ageInHours * 60 * 60 * 1000;
        await Promise.all([
            this.queue.clean(timestamp, 'completed'),
            this.queue.clean(timestamp, 'failed'),
        ]);
        logger.info('[NotificationQueue] Queue cleaned', { ageInHours });
    }
    async shutdown() {
        if (!this.queue)
            return;
        await this.queue.close();
        this.queue = null;
        this.initialized = false;
        this.processing = false;
        logger.info('[NotificationQueue] Queue shutdown complete');
    }
    getQueue() {
        this.initialize();
        return this.queue;
    }
}
export const notificationQueue = NotificationQueue.getInstance();
export default notificationQueue;
