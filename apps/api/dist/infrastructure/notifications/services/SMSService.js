import twilio from 'twilio';
import logger from '../../../shared/utils/logger.js';
export class SMSService {
    static instance = null;
    client = null;
    fromNumber;
    whatsappNumber;
    initialized = false;
    appUrl;
    constructor() {
        this.fromNumber = process.env.TWILIO_PHONE_NUMBER || '';
        this.whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER || null;
        this.appUrl = process.env.APP_URL || 'https://app.agrobridge.io';
    }
    static getInstance() {
        if (!SMSService.instance) {
            SMSService.instance = new SMSService();
        }
        return SMSService.instance;
    }
    initialize() {
        if (this.initialized)
            return;
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
        }
        catch (error) {
            const err = error;
            logger.error('[SMSService] Failed to initialize Twilio client', {
                error: err.message,
            });
        }
    }
    isAvailable() {
        this.initialize();
        return this.initialized && this.client !== null;
    }
    isWhatsAppAvailable() {
        return this.isAvailable() && !!this.whatsappNumber;
    }
    async sendSMS(to, body) {
        this.initialize();
        if (!this.client) {
            return {
                success: false,
                error: 'SMS service not initialized',
                errorCode: 'NOT_INITIALIZED',
            };
        }
        if (!this.isValidPhoneNumber(to)) {
            return {
                success: false,
                error: 'Invalid phone number format. Use E.164 format (+521234567890)',
                errorCode: 'INVALID_PHONE_NUMBER',
            };
        }
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
        }
        catch (error) {
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
    async sendWhatsApp(to, body) {
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
        }
        catch (error) {
            logger.error('[SMSService] WhatsApp send failed', {
                error: error.message,
                to: this.maskPhoneNumber(to),
            });
            logger.info('[SMSService] Falling back to SMS');
            return await this.sendSMS(to, body);
        }
    }
    async sendBatchSMS(recipients, body) {
        if (recipients.length === 0) {
            return {
                successCount: 0,
                failureCount: 0,
                avgLatency: 0,
                results: [],
            };
        }
        const results = await Promise.all(recipients.map((to) => this.sendSMS(to, body)));
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
    async sendSensorAlert(phoneNumber, details) {
        const message = `🚨 ALERTA AGROBRIDGE

${details.sensorType.toUpperCase()} excedió el umbral:
Valor actual: ${details.currentValue}${details.unit}
Umbral: ${details.threshold}${details.unit}
${details.location ? `Ubicación: ${details.location}` : ''}

Revisa tu app inmediatamente.

${this.appUrl}/sensors${details.batchId ? `?batchId=${details.batchId}` : ''}`;
        return await this.sendWhatsApp(phoneNumber, message);
    }
    async sendOrderConfirmation(phoneNumber, details) {
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
    async sendBatchCreatedSMS(phoneNumber, batchId, variety) {
        const message = `✅ Lote registrado - AgroBridge

Lote: ${batchId}
${variety ? `Variedad: ${variety}` : ''}

Tu lote ha sido registrado en la blockchain.

Ver: ${this.appUrl}/batches/${batchId}`;
        return await this.sendSMS(phoneNumber, message);
    }
    async sendCertificateReadySMS(phoneNumber, batchId) {
        const message = `🏆 Certificado listo - AgroBridge

Tu certificado blockchain para el lote ${batchId} está disponible.

Descargar: ${this.appUrl}/certificates/${batchId}`;
        return await this.sendWhatsApp(phoneNumber, message);
    }
    async sendVerificationCode(phoneNumber, code, expiresInMinutes = 10) {
        const message = `Tu código de verificación AgroBridge es: ${code}

Este código expira en ${expiresInMinutes} minutos.

No compartas este código con nadie.`;
        return await this.sendSMS(phoneNumber, message);
    }
    async getMessageStatus(messageId) {
        this.initialize();
        if (!this.client) {
            return 'unknown';
        }
        try {
            const message = await this.client.messages(messageId).fetch();
            return message.status;
        }
        catch (error) {
            logger.error('[SMSService] Failed to fetch message status', {
                error: error.message,
                messageId,
            });
            return 'unknown';
        }
    }
    isValidPhoneNumber(phoneNumber) {
        return /^\+[1-9]\d{7,14}$/.test(phoneNumber);
    }
    maskPhoneNumber(phoneNumber) {
        if (phoneNumber.length < 8)
            return '***';
        return `${phoneNumber.substring(0, 4)}***${phoneNumber.substring(phoneNumber.length - 2)}`;
    }
    maskAccountSid(accountSid) {
        if (accountSid.length < 10)
            return '***';
        return `${accountSid.substring(0, 6)}...${accountSid.substring(accountSid.length - 4)}`;
    }
}
export const smsService = SMSService.getInstance();
export default smsService;
