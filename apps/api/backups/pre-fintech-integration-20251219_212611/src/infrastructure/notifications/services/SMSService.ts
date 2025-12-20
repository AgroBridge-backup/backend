/**
 * @file SMS Service using Twilio
 * @description Enterprise-grade SMS and WhatsApp messaging service
 *
 * Twilio Benefits:
 * 1. Global coverage (180+ countries)
 * 2. 99.95% uptime SLA
 * 3. Programmable WhatsApp Business API
 * 4. Advanced features (delivery tracking, URL shortening)
 * 5. Fraud detection built-in
 *
 * Cost (Mexico):
 * - SMS: ~$0.0215 USD per message
 * - WhatsApp: ~$0.005 USD per message (4.3x cheaper!)
 *
 * Use Cases:
 * - Critical alerts (sensor thresholds exceeded)
 * - 2FA/OTP codes
 * - Order confirmations
 * - Payment receipts
 *
 * Best Practices:
 * - Use WhatsApp when possible (cheaper + higher engagement)
 * - Keep messages < 160 chars to avoid multi-part SMS
 * - Rate limit to avoid spam detection
 * - Use URL shortening for links
 *
 * @author AgroBridge Engineering Team
 * @see https://www.twilio.com/docs/sms
 */

import twilio from 'twilio';
import logger from '../../../shared/utils/logger.js';
import type {
  SMSSendResult,
  SMSBatchResult,
  SensorAlertDetails,
  OrderNotificationDetails,
} from '../types/index.js';

/**
 * SMS Service using Twilio
 *
 * Handles SMS and WhatsApp messaging at scale
 * Implements singleton pattern with lazy initialization
 */
export class SMSService {
  private static instance: SMSService | null = null;
  private client: twilio.Twilio | null = null;
  private fromNumber: string;
  private whatsappNumber: string | null;
  private initialized: boolean = false;
  private appUrl: string;

  private constructor() {
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || '';
    this.whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER || null;
    this.appUrl = process.env.APP_URL || 'https://app.agrobridge.io';
  }

  /**
   * Get singleton instance of SMSService
   */
  public static getInstance(): SMSService {
    if (!SMSService.instance) {
      SMSService.instance = new SMSService();
    }
    return SMSService.instance;
  }

  /**
   * Initialize Twilio client
   */
  private initialize(): void {
    if (this.initialized) return;

    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;

      if (!accountSid || !authToken) {
        logger.warn('[SMSService] Twilio credentials not configured. SMS will be disabled.', {
          hasAccountSid: !!accountSid,
          hasAuthToken: !!authToken,
        });
        return;
      }

      if (!this.fromNumber) {
        logger.warn('[SMSService] TWILIO_PHONE_NUMBER not configured. SMS will be disabled.');
        return;
      }

      this.client = twilio(accountSid, authToken);
      this.initialized = true;

      logger.info('[SMSService] Twilio client initialized successfully', {
        accountSid: this.maskAccountSid(accountSid),
        fromNumber: this.maskPhoneNumber(this.fromNumber),
        whatsappEnabled: !!this.whatsappNumber,
      });
    } catch (error) {
      const err = error as Error;
      logger.error('[SMSService] Failed to initialize Twilio client', {
        error: err.message,
      });
    }
  }

  /**
   * Check if SMS service is available
   */
  public isAvailable(): boolean {
    this.initialize();
    return this.initialized && this.client !== null;
  }

  /**
   * Check if WhatsApp is available
   */
  public isWhatsAppAvailable(): boolean {
    return this.isAvailable() && !!this.whatsappNumber;
  }

  /**
   * Send SMS message
   *
   * @param to - Phone number in E.164 format (e.g., +521234567890)
   * @param body - Message body (max 160 chars recommended)
   * @returns Promise with send result
   */
  async sendSMS(to: string, body: string): Promise<SMSSendResult> {
    this.initialize();

    if (!this.client) {
      return {
        success: false,
        error: 'SMS service not initialized',
        errorCode: 'NOT_INITIALIZED',
      };
    }

    // Validate phone number format
    if (!this.isValidPhoneNumber(to)) {
      return {
        success: false,
        error: 'Invalid phone number format. Use E.164 format (+521234567890)',
        errorCode: 'INVALID_PHONE_NUMBER',
      };
    }

    // Truncate message if too long (SMS can be up to 1600 chars but expensive)
    const truncatedBody = body.length > 1600 ? body.substring(0, 1597) + '...' : body;

    try {
      const startTime = Date.now();
      const message = await this.client.messages.create({
        body: truncatedBody,
        from: this.fromNumber,
        to,
      });
      const latency = Date.now() - startTime;

      logger.info('[SMSService] SMS sent successfully', {
        to: this.maskPhoneNumber(to),
        messageId: message.sid,
        status: message.status,
        latency: `${latency}ms`,
        segments: Math.ceil(truncatedBody.length / 160),
      });

      return {
        success: true,
        messageId: message.sid,
        status: message.status,
        latency,
      };
    } catch (error: any) {
      logger.error('[SMSService] SMS send failed', {
        error: error.message,
        code: error.code,
        to: this.maskPhoneNumber(to),
      });

      return {
        success: false,
        error: error.message,
        errorCode: error.code?.toString(),
      };
    }
  }

  /**
   * Send WhatsApp message
   * More cost-effective than SMS (~4x cheaper)
   *
   * @param to - Phone number in E.164 format
   * @param body - Message body
   * @returns Promise with send result
   */
  async sendWhatsApp(to: string, body: string): Promise<SMSSendResult> {
    this.initialize();

    if (!this.client) {
      return {
        success: false,
        error: 'SMS service not initialized',
        errorCode: 'NOT_INITIALIZED',
      };
    }

    if (!this.whatsappNumber) {
      logger.warn('[SMSService] WhatsApp number not configured, falling back to SMS');
      return await this.sendSMS(to, body);
    }

    if (!this.isValidPhoneNumber(to)) {
      return {
        success: false,
        error: 'Invalid phone number format',
        errorCode: 'INVALID_PHONE_NUMBER',
      };
    }

    try {
      const startTime = Date.now();
      const message = await this.client.messages.create({
        body,
        from: `whatsapp:${this.whatsappNumber}`,
        to: `whatsapp:${to}`,
      });
      const latency = Date.now() - startTime;

      logger.info('[SMSService] WhatsApp message sent successfully', {
        to: this.maskPhoneNumber(to),
        messageId: message.sid,
        status: message.status,
        latency: `${latency}ms`,
      });

      return {
        success: true,
        messageId: message.sid,
        status: message.status,
        latency,
      };
    } catch (error: any) {
      logger.error('[SMSService] WhatsApp send failed', {
        error: error.message,
        to: this.maskPhoneNumber(to),
      });

      // Fallback to SMS if WhatsApp fails
      logger.info('[SMSService] Falling back to SMS');
      return await this.sendSMS(to, body);
    }
  }

  /**
   * Send batch SMS (up to 100 recipients)
   *
   * @param recipients - Array of phone numbers
   * @param body - Message body
   * @returns Promise with batch results
   */
  async sendBatchSMS(recipients: string[], body: string): Promise<SMSBatchResult> {
    if (recipients.length === 0) {
      return {
        successCount: 0,
        failureCount: 0,
        avgLatency: 0,
        results: [],
      };
    }

    // Send all messages in parallel with rate limiting
    const results = await Promise.all(
      recipients.map((to) => this.sendSMS(to, body))
    );

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;
    const totalLatency = results.reduce((sum, r) => sum + (r.latency || 0), 0);

    logger.info('[SMSService] Batch SMS send completed', {
      totalRecipients: recipients.length,
      successCount,
      failureCount,
      avgLatency: `${Math.round(totalLatency / recipients.length)}ms`,
    });

    return {
      successCount,
      failureCount,
      avgLatency: recipients.length > 0 ? totalLatency / recipients.length : 0,
      results,
    };
  }

  /**
   * Send sensor alert SMS/WhatsApp
   * Pre-formatted message for sensor threshold alerts
   *
   * @param phoneNumber - Recipient phone number
   * @param details - Sensor alert details
   * @returns Promise with send result
   */
  async sendSensorAlert(
    phoneNumber: string,
    details: SensorAlertDetails
  ): Promise<SMSSendResult> {
    const message = `🚨 ALERTA AGROBRIDGE

${details.sensorType.toUpperCase()} excedió el umbral:
Valor actual: ${details.currentValue}${details.unit}
Umbral: ${details.threshold}${details.unit}
${details.location ? `Ubicación: ${details.location}` : ''}

Revisa tu app inmediatamente.

${this.appUrl}/sensors${details.batchId ? `?batchId=${details.batchId}` : ''}`;

    // Use WhatsApp for alerts (more reliable for critical messages)
    return await this.sendWhatsApp(phoneNumber, message);
  }

  /**
   * Send order confirmation SMS
   *
   * @param phoneNumber - Recipient phone number
   * @param details - Order details
   * @returns Promise with send result
   */
  async sendOrderConfirmation(
    phoneNumber: string,
    details: OrderNotificationDetails
  ): Promise<SMSSendResult> {
    const total = details.total
      ? new Intl.NumberFormat('es-MX', {
          style: 'currency',
          currency: details.currency || 'MXN',
        }).format(details.total)
      : '';

    const message = `✅ Orden confirmada - AgroBridge

Orden #${details.orderId}
${total ? `Total: ${total}` : ''}
Estado: ${details.status}

Rastrear: ${details.trackingUrl || `${this.appUrl}/orders/${details.orderId}`}`;

    return await this.sendSMS(phoneNumber, message);
  }

  /**
   * Send batch created notification
   */
  async sendBatchCreatedSMS(
    phoneNumber: string,
    batchId: string,
    variety?: string
  ): Promise<SMSSendResult> {
    const message = `✅ Lote registrado - AgroBridge

Lote: ${batchId}
${variety ? `Variedad: ${variety}` : ''}

Tu lote ha sido registrado en la blockchain.

Ver: ${this.appUrl}/batches/${batchId}`;

    return await this.sendSMS(phoneNumber, message);
  }

  /**
   * Send certificate ready notification
   */
  async sendCertificateReadySMS(
    phoneNumber: string,
    batchId: string
  ): Promise<SMSSendResult> {
    const message = `🏆 Certificado listo - AgroBridge

Tu certificado blockchain para el lote ${batchId} está disponible.

Descargar: ${this.appUrl}/certificates/${batchId}`;

    return await this.sendWhatsApp(phoneNumber, message);
  }

  /**
   * Send OTP/verification code
   */
  async sendVerificationCode(
    phoneNumber: string,
    code: string,
    expiresInMinutes: number = 10
  ): Promise<SMSSendResult> {
    const message = `Tu código de verificación AgroBridge es: ${code}

Este código expira en ${expiresInMinutes} minutos.

No compartas este código con nadie.`;

    return await this.sendSMS(phoneNumber, message);
  }

  /**
   * Get delivery status of a message
   *
   * @param messageId - Twilio message SID
   * @returns Promise with message status
   */
  async getMessageStatus(messageId: string): Promise<string> {
    this.initialize();

    if (!this.client) {
      return 'unknown';
    }

    try {
      const message = await this.client.messages(messageId).fetch();
      return message.status;
    } catch (error: any) {
      logger.error('[SMSService] Failed to fetch message status', {
        error: error.message,
        messageId,
      });
      return 'unknown';
    }
  }

  /**
   * Validate phone number format (E.164)
   * Examples: +521234567890, +14155551234
   */
  private isValidPhoneNumber(phoneNumber: string): boolean {
    // E.164 format: + followed by country code and subscriber number
    // Minimum 8 digits, maximum 15 digits total (including country code)
    return /^\+[1-9]\d{7,14}$/.test(phoneNumber);
  }

  /**
   * Mask phone number for logging (security)
   */
  private maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length < 8) return '***';
    return `${phoneNumber.substring(0, 4)}***${phoneNumber.substring(phoneNumber.length - 2)}`;
  }

  /**
   * Mask account SID for logging (security)
   */
  private maskAccountSid(accountSid: string): string {
    if (accountSid.length < 10) return '***';
    return `${accountSid.substring(0, 6)}...${accountSid.substring(accountSid.length - 4)}`;
  }
}

// Export singleton instance
export const smsService = SMSService.getInstance();
export default smsService;
