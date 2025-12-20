/**
 * WhatsApp Cloud API Service
 * Handles all communication with Meta's WhatsApp Business API
 * @module whatsapp-bot/whatsapp.service
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../../infrastructure/logging/logger.js';
import {
  SendMessageRequest,
  InteractiveMessage,
  TemplateMessage,
  WhatsAppConfig,
  MenuOption,
} from './types/index.js';

const prisma = new PrismaClient();

// ============================================================================
// CONFIGURATION
// ============================================================================

const config: WhatsAppConfig = {
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'agrobridge_verify_2025',
  businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
  apiVersion: 'v18.0',
  baseUrl: 'https://graph.facebook.com',
  webhookPath: '/webhook/whatsapp',
  maxSessionDuration: 24 * 60, // 24 hours
  maxMessagesPerDay: 1000, // Meta's free tier limit
  supportedLanguages: ['es', 'en'],
};

// ============================================================================
// MAIN SERVICE CLASS
// ============================================================================

export class WhatsAppService {
  private readonly baseUrl: string;
  private messageCount: Map<string, number> = new Map(); // Rate limiting

  constructor() {
    this.baseUrl = `${config.baseUrl}/${config.apiVersion}/${config.phoneNumberId}`;

    if (!config.phoneNumberId || !config.accessToken) {
      logger.warn('[WhatsApp] Service not fully configured - missing credentials');
    }
  }

  // ==========================================================================
  // SENDING MESSAGES
  // ==========================================================================

  /**
   * Send a text message
   */
  async sendText(to: string, text: string): Promise<string | null> {
    return this.sendMessage({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.formatPhoneNumber(to),
      type: 'text',
      text: { body: text, preview_url: false },
    });
  }

  /**
   * Send interactive buttons (max 3 buttons)
   */
  async sendButtons(
    to: string,
    body: string,
    buttons: Array<{ id: string; title: string }>,
    header?: string,
    footer?: string
  ): Promise<string | null> {
    const interactive: InteractiveMessage = {
      type: 'button',
      body: { text: body },
      action: {
        buttons: buttons.slice(0, 3).map((btn) => ({
          type: 'reply' as const,
          reply: { id: btn.id, title: btn.title.slice(0, 20) },
        })),
      },
    };

    if (header) interactive.header = { type: 'text', text: header };
    if (footer) interactive.footer = { text: footer };

    return this.sendMessage({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.formatPhoneNumber(to),
      type: 'interactive',
      interactive,
    });
  }

  /**
   * Send interactive list menu (up to 10 items per section)
   */
  async sendListMenu(
    to: string,
    body: string,
    buttonText: string,
    sections: Array<{ title: string; items: MenuOption[] }>,
    header?: string,
    footer?: string
  ): Promise<string | null> {
    const interactive: InteractiveMessage = {
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

    if (header) interactive.header = { type: 'text', text: header };
    if (footer) interactive.footer = { text: footer };

    return this.sendMessage({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.formatPhoneNumber(to),
      type: 'interactive',
      interactive,
    });
  }

  /**
   * Send a template message (for notifications outside 24h window)
   */
  async sendTemplate(
    to: string,
    templateName: string,
    languageCode: string = 'es',
    parameters?: Array<{ type: 'text'; text: string }>
  ): Promise<string | null> {
    const template: TemplateMessage = {
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

  // ==========================================================================
  // CORE API METHODS
  // ==========================================================================

  /**
   * Send any message type via Meta Graph API
   */
  private async sendMessage(payload: SendMessageRequest): Promise<string | null> {
    // Rate limiting check
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

        // Log to database for monitoring
        await this.logMessageAttempt(payload.to, 'FAILED', data.error?.message);
        return null;
      }

      const messageId = data.messages?.[0]?.id;

      // Update rate limit counter
      this.messageCount.set(dailyKey, currentCount + 1);

      // Log success
      await this.logMessageAttempt(payload.to, 'SENT', undefined, messageId);

      logger.info('[WhatsApp] Message sent', { to: payload.to, messageId });
      return messageId;

    } catch (error) {
      logger.error('[WhatsApp] Send failed:', error);
      await this.logMessageAttempt(payload.to, 'FAILED', (error as Error).message);
      return null;
    }
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string): Promise<void> {
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
    } catch (error) {
      logger.warn('[WhatsApp] Failed to mark as read:', error);
    }
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Format phone number to E.164 format
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-digits
    let cleaned = phone.replace(/\D/g, '');

    // Handle Mexican numbers
    if (cleaned.startsWith('52') && cleaned.length === 12) {
      return cleaned; // Already formatted
    }

    if (cleaned.length === 10 && /^[1-9]/.test(cleaned)) {
      // Mexican mobile without country code
      return `52${cleaned}`;
    }

    // Return as-is if already looks like international
    return cleaned;
  }

  /**
   * Log message attempt for monitoring
   */
  private async logMessageAttempt(
    to: string,
    status: 'SENT' | 'FAILED' | 'DELIVERED',
    error?: string,
    messageId?: string
  ): Promise<void> {
    try {
      // Find user by phone
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
    } catch (err) {
      // Non-critical, just log
      logger.debug('[WhatsApp] Failed to log message attempt:', err);
    }
  }

  /**
   * Verify webhook signature from Meta
   */
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    if (mode === 'subscribe' && token === config.verifyToken) {
      logger.info('[WhatsApp] Webhook verified');
      return challenge;
    }
    logger.warn('[WhatsApp] Webhook verification failed');
    return null;
  }

  /**
   * Get configuration (for health checks)
   */
  getConfig(): Partial<WhatsAppConfig> {
    return {
      phoneNumberId: config.phoneNumberId ? '***configured***' : 'NOT SET',
      accessToken: config.accessToken ? '***configured***' : 'NOT SET',
      apiVersion: config.apiVersion,
      maxMessagesPerDay: config.maxMessagesPerDay,
    };
  }
}

// Export singleton instance
export const whatsAppService = new WhatsAppService();
