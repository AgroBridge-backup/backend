import { SESClient, SendEmailCommand, SendRawEmailCommand, GetSendQuotaCommand, } from '@aws-sdk/client-ses';
import logger from '../../../shared/utils/logger.js';
export class SESProvider {
    client = null;
    config;
    initialized = false;
    constructor() {
        this.config = {
            region: process.env.AWS_SES_REGION || process.env.AWS_REGION || 'us-east-1',
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            fromEmail: process.env.AWS_SES_FROM_EMAIL || 'noreply@agrobridge.io',
            fromName: process.env.SENDGRID_FROM_NAME || 'AgroBridge',
            configurationSet: process.env.AWS_SES_CONFIGURATION_SET,
        };
    }
    initialize() {
        if (this.initialized)
            return;
        try {
            const clientConfig = {
                region: this.config.region,
            };
            if (this.config.accessKeyId && this.config.secretAccessKey) {
                clientConfig.credentials = {
                    accessKeyId: this.config.accessKeyId,
                    secretAccessKey: this.config.secretAccessKey,
                };
            }
            this.client = new SESClient(clientConfig);
            this.initialized = true;
            logger.info('[SESProvider] AWS SES initialized', {
                region: this.config.region,
                fromEmail: this.config.fromEmail,
            });
        }
        catch (error) {
            const err = error;
            logger.error('[SESProvider] Failed to initialize SES', {
                error: err.message,
            });
        }
    }
    isAvailable() {
        this.initialize();
        return this.initialized && this.client !== null;
    }
    async getHealth() {
        this.initialize();
        if (!this.client) {
            return {
                healthy: false,
                quotaMax24Hour: 0,
                quotaSentLast24Hours: 0,
                quotaMaxPerSecond: 0,
                percentUsed: 0,
            };
        }
        try {
            const command = new GetSendQuotaCommand({});
            const response = await this.client.send(command);
            const max24 = response.Max24HourSend || 0;
            const sent24 = response.SentLast24Hours || 0;
            const percentUsed = max24 > 0 ? (sent24 / max24) * 100 : 0;
            return {
                healthy: percentUsed < 90,
                quotaMax24Hour: max24,
                quotaSentLast24Hours: sent24,
                quotaMaxPerSecond: response.MaxSendRate || 0,
                percentUsed,
            };
        }
        catch (error) {
            logger.error('[SESProvider] Health check failed', {
                error: error.message,
            });
            return {
                healthy: false,
                quotaMax24Hour: 0,
                quotaSentLast24Hours: 0,
                quotaMaxPerSecond: 0,
                percentUsed: 0,
            };
        }
    }
    async sendEmail(options) {
        this.initialize();
        if (!this.client) {
            return {
                success: false,
                error: 'SES client not initialized',
                errorCode: 'NOT_INITIALIZED',
            };
        }
        try {
            const startTime = Date.now();
            if (options.attachments && options.attachments.length > 0) {
                return await this.sendRawEmail(options);
            }
            const input = {
                Source: `${this.config.fromName} <${this.config.fromEmail}>`,
                Destination: {
                    ToAddresses: [options.to],
                },
                Message: {
                    Subject: {
                        Data: options.subject,
                        Charset: 'UTF-8',
                    },
                    Body: {
                        Html: {
                            Data: options.html,
                            Charset: 'UTF-8',
                        },
                        Text: {
                            Data: options.text || this.stripHtml(options.html),
                            Charset: 'UTF-8',
                        },
                    },
                },
            };
            if (options.replyTo) {
                input.ReplyToAddresses = [options.replyTo];
            }
            if (this.config.configurationSet) {
                input.ConfigurationSetName = this.config.configurationSet;
            }
            if (options.categories) {
                input.Tags = options.categories.map((cat) => ({
                    Name: 'category',
                    Value: cat,
                }));
            }
            const command = new SendEmailCommand(input);
            const response = await this.client.send(command);
            const latency = Date.now() - startTime;
            logger.info('[SESProvider] Email sent successfully', {
                to: this.maskEmail(options.to),
                subject: options.subject,
                messageId: response.MessageId,
                latency: `${latency}ms`,
            });
            return {
                success: true,
                messageId: response.MessageId,
                latency,
                provider: 'ses',
            };
        }
        catch (error) {
            logger.error('[SESProvider] Send failed', {
                error: error.message,
                to: this.maskEmail(options.to),
                subject: options.subject,
                code: error.name,
            });
            return {
                success: false,
                error: error.message,
                errorCode: error.name,
                provider: 'ses',
            };
        }
    }
    async sendRawEmail(options) {
        if (!this.client) {
            return {
                success: false,
                error: 'SES client not initialized',
                errorCode: 'NOT_INITIALIZED',
            };
        }
        try {
            const startTime = Date.now();
            const boundary = `----=_Part_${Date.now().toString(36)}`;
            let rawMessage = '';
            rawMessage += `From: ${this.config.fromName} <${this.config.fromEmail}>\n`;
            rawMessage += `To: ${options.to}\n`;
            rawMessage += `Subject: =?UTF-8?B?${Buffer.from(options.subject).toString('base64')}?=\n`;
            rawMessage += `MIME-Version: 1.0\n`;
            rawMessage += `Content-Type: multipart/mixed; boundary="${boundary}"\n\n`;
            rawMessage += `--${boundary}\n`;
            rawMessage += `Content-Type: text/html; charset=UTF-8\n`;
            rawMessage += `Content-Transfer-Encoding: base64\n\n`;
            rawMessage += `${Buffer.from(options.html).toString('base64')}\n\n`;
            if (options.attachments) {
                for (const attachment of options.attachments) {
                    rawMessage += `--${boundary}\n`;
                    rawMessage += `Content-Type: ${attachment.type || 'application/octet-stream'}; name="${attachment.filename}"\n`;
                    rawMessage += `Content-Disposition: ${attachment.disposition || 'attachment'}; filename="${attachment.filename}"\n`;
                    rawMessage += `Content-Transfer-Encoding: base64\n`;
                    if (attachment.contentId) {
                        rawMessage += `Content-ID: <${attachment.contentId}>\n`;
                    }
                    rawMessage += `\n${attachment.content}\n\n`;
                }
            }
            rawMessage += `--${boundary}--`;
            const input = {
                RawMessage: {
                    Data: Buffer.from(rawMessage),
                },
            };
            if (this.config.configurationSet) {
                input.ConfigurationSetName = this.config.configurationSet;
            }
            const command = new SendRawEmailCommand(input);
            const response = await this.client.send(command);
            const latency = Date.now() - startTime;
            logger.info('[SESProvider] Raw email sent successfully', {
                to: this.maskEmail(options.to),
                subject: options.subject,
                messageId: response.MessageId,
                latency: `${latency}ms`,
                attachments: options.attachments?.length || 0,
            });
            return {
                success: true,
                messageId: response.MessageId,
                latency,
                provider: 'ses',
            };
        }
        catch (error) {
            logger.error('[SESProvider] Raw email send failed', {
                error: error.message,
                to: this.maskEmail(options.to),
                code: error.name,
            });
            return {
                success: false,
                error: error.message,
                errorCode: error.name,
                provider: 'ses',
            };
        }
    }
    stripHtml(html) {
        return html
            .replace(/<style[^>]*>.*<\/style>/gms, '')
            .replace(/<script[^>]*>.*<\/script>/gms, '')
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
    maskEmail(email) {
        const [local, domain] = email.split('@');
        if (!domain || local.length < 3)
            return '***@***';
        return `${local.substring(0, 3)}...@${domain}`;
    }
}
export const sesProvider = new SESProvider();
export default sesProvider;
