import { PrismaClient } from '@prisma/client';
import { logger } from '../../infrastructure/logging/logger.js';
const prisma = new PrismaClient();
const config = {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'agrobridge_verify_2025',
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
    apiVersion: 'v18.0',
    baseUrl: 'https://graph.facebook.com',
    webhookPath: '/webhook/whatsapp',
    maxSessionDuration: 24 * 60,
    maxMessagesPerDay: 1000,
    supportedLanguages: ['es', 'en'],
};
export class WhatsAppService {
    baseUrl;
    messageCount = new Map();
    constructor() {
        this.baseUrl = `${config.baseUrl}/${config.apiVersion}/${config.phoneNumberId}`;
        if (!config.phoneNumberId || !config.accessToken) {
            logger.warn('[WhatsApp] Service not fully configured - missing credentials');
        }
    }
    async sendText(to, text) {
        return this.sendMessage({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: this.formatPhoneNumber(to),
            type: 'text',
            text: { body: text, preview_url: false },
        });
    }
    async sendButtons(to, body, buttons, header, footer) {
        const interactive = {
            type: 'button',
            body: { text: body },
            action: {
                buttons: buttons.slice(0, 3).map((btn) => ({
                    type: 'reply',
                    reply: { id: btn.id, title: btn.title.slice(0, 20) },
                })),
            },
        };
        if (header)
            interactive.header = { type: 'text', text: header };
        if (footer)
            interactive.footer = { text: footer };
        return this.sendMessage({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: this.formatPhoneNumber(to),
            type: 'interactive',
            interactive,
        });
    }
    async sendListMenu(to, body, buttonText, sections, header, footer) {
        const interactive = {
            type: 'list',
            body: { text: body },
            action: {
                button: buttonText,
                sections: sections.map((section) => ({
                    title: section.title,
                    rows: section.items.slice(0, 10).map((item) => ({
                        id: item.id,
                        title: `${item.emoji || ''} ${item.title}`.trim().slice(0, 24),
                        description: item.description?.slice(0, 72),
                    })),
                })),
            },
        };
        if (header)
            interactive.header = { type: 'text', text: header };
        if (footer)
            interactive.footer = { text: footer };
        return this.sendMessage({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: this.formatPhoneNumber(to),
            type: 'interactive',
            interactive,
        });
    }
    async sendTemplate(to, templateName, languageCode = 'es', parameters) {
        const template = {
            name: templateName,
            language: { code: languageCode },
        };
        if (parameters && parameters.length > 0) {
            template.components = [
                {
                    type: 'body',
                    parameters,
                },
            ];
        }
        return this.sendMessage({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: this.formatPhoneNumber(to),
            type: 'template',
            template,
        });
    }
    async sendMessage(payload) {
        const today = new Date().toISOString().split('T')[0];
        const dailyKey = `${today}`;
        const currentCount = this.messageCount.get(dailyKey) || 0;
        if (currentCount >= config.maxMessagesPerDay) {
            logger.warn('[WhatsApp] Daily message limit reached');
            return null;
        }
        try {
            const response = await fetch(`${this.baseUrl}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!response.ok) {
                logger.error('[WhatsApp] API Error:', {
                    status: response.status,
                    error: data.error,
                });
                await this.logMessageAttempt(payload.to, 'FAILED', data.error?.message);
                return null;
            }
            const messageId = data.messages?.[0]?.id;
            this.messageCount.set(dailyKey, currentCount + 1);
            await this.logMessageAttempt(payload.to, 'SENT', undefined, messageId);
            logger.info('[WhatsApp] Message sent', { to: payload.to, messageId });
            return messageId;
        }
        catch (error) {
            logger.error('[WhatsApp] Send failed:', error);
            await this.logMessageAttempt(payload.to, 'FAILED', error.message);
            return null;
        }
    }
    async markAsRead(messageId) {
        try {
            await fetch(`${this.baseUrl}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    status: 'read',
                    message_id: messageId,
                }),
            });
        }
        catch (error) {
            logger.warn('[WhatsApp] Failed to mark as read:', error);
        }
    }
    formatPhoneNumber(phone) {
        let cleaned = phone.replace(/\D/g, '');
        if (cleaned.startsWith('52') && cleaned.length === 12) {
            return cleaned;
        }
        if (cleaned.length === 10 && /^[1-9]/.test(cleaned)) {
            return `52${cleaned}`;
        }
        return cleaned;
    }
    async logMessageAttempt(to, status, error, messageId) {
        try {
            const preference = await prisma.notificationPreference.findFirst({
                where: { phoneNumber: { contains: to.slice(-10) } },
            });
            if (preference?.userId) {
                await prisma.notificationDeliveryLog.create({
                    data: {
                        notification: {
                            create: {
                                userId: preference.userId,
                                type: 'CUSTOM',
                                title: 'WhatsApp Bot Message',
                                body: 'Automated bot message',
                                channels: ['WHATSAPP'],
                                status: status === 'SENT' ? 'SENT' : 'FAILED',
                                priority: 'NORMAL',
                            },
                        },
                        channel: 'WHATSAPP',
                        status: status === 'SENT' ? 'SUCCESS' : 'FAILED',
                        providerId: messageId,
                        providerError: error,
                    },
                });
            }
        }
        catch (err) {
            logger.debug('[WhatsApp] Failed to log message attempt:', err);
        }
    }
    verifyWebhook(mode, token, challenge) {
        if (mode === 'subscribe' && token === config.verifyToken) {
            logger.info('[WhatsApp] Webhook verified');
            return challenge;
        }
        logger.warn('[WhatsApp] Webhook verification failed');
        return null;
    }
    getConfig() {
        return {
            phoneNumberId: config.phoneNumberId ? '***configured***' : 'NOT SET',
            accessToken: config.accessToken ? '***configured***' : 'NOT SET',
            apiVersion: config.apiVersion,
            maxMessagesPerDay: config.maxMessagesPerDay,
        };
    }
}
export const whatsAppService = new WhatsAppService();
