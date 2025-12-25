/**
 * @file Email Service using SendGrid
 * @description Enterprise-grade transactional email service
 *
 * SendGrid Benefits (why we chose it):
 * 1. 99.99% uptime SLA
 * 2. Global infrastructure (low latency worldwide)
 * 3. Advanced analytics (opens, clicks, bounces)
 * 4. Webhook support (delivery tracking)
 * 5. Template versioning
 * 6. Reputation protection (dedicated IPs available)
 *
 * Cost at scale:
 * - 100K emails/month: ~$80
 * - 1M emails/month: ~$600
 *
 * @author AgroBridge Engineering Team
 * @see https://docs.sendgrid.com/api-reference
 */

import sgMail from '@sendgrid/mail';
import Handlebars from 'handlebars';
import logger from '../../../shared/utils/logger.js';
import type {
  EmailOptions,
  EmailSendResult,
  EmailAttachment,
  BatchNotificationDetails,
  CertificateNotificationDetails,
  SensorAlertDetails,
  OrderNotificationDetails,
} from '../types/index.js';

/**
 * Email Service using SendGrid
 *
 * Handles transactional emails with template support
 * Implements singleton pattern with lazy initialization
 */
export class EmailService {
  private static instance: EmailService | null = null;
  private initialized: boolean = false;
  private fromEmail: string;
  private fromName: string;
  private appUrl: string;

  private constructor() {
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL || 'notifications@agrobridge.io';
    this.fromName = process.env.SENDGRID_FROM_NAME || 'AgroBridge';
    this.appUrl = process.env.APP_URL || 'https://app.agrobridge.io';
  }

  /**
   * Get singleton instance of EmailService
   */
  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * Initialize SendGrid client
   */
  private initialize(): void {
    if (this.initialized) return;

    try {
      const apiKey = process.env.SENDGRID_API_KEY;

      if (!apiKey) {
        logger.warn('[EmailService] SendGrid API key not configured. Email will be disabled.');
        return;
      }

      sgMail.setApiKey(apiKey);
      this.registerHandlebarsHelpers();
      this.initialized = true;

      logger.info('[EmailService] SendGrid initialized successfully', {
        fromEmail: this.fromEmail,
        fromName: this.fromName,
      });
    } catch (error) {
      const err = error as Error;
      logger.error('[EmailService] Failed to initialize SendGrid', {
        error: err.message,
      });
    }
  }

  /**
   * Register Handlebars template helpers
   */
  private registerHandlebarsHelpers(): void {
    // Date formatting helper
    Handlebars.registerHelper('formatDate', (date: Date | string) => {
      const d = new Date(date);
      return d.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    });

    // Date and time formatting
    Handlebars.registerHelper('formatDateTime', (date: Date | string) => {
      const d = new Date(date);
      return d.toLocaleString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    });

    // Currency formatting helper
    Handlebars.registerHelper('formatCurrency', (amount: number) => {
      return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
      }).format(amount);
    });

    // Weight formatting
    Handlebars.registerHelper('formatWeight', (kg: number) => {
      return new Intl.NumberFormat('es-MX', {
        maximumFractionDigits: 2,
      }).format(kg) + ' kg';
    });

    // Conditional helper
    Handlebars.registerHelper('ifEquals', function(this: any, arg1: any, arg2: any, options: any) {
      return arg1 === arg2 ? options.fn(this) : options.inverse(this);
    });
  }

  /**
   * Check if email service is available
   */
  public isAvailable(): boolean {
    this.initialize();
    return this.initialized;
  }

  /**
   * Send email
   *
   * @param options - Email options
   * @returns Promise with send result
   */
  async sendEmail(options: EmailOptions): Promise<EmailSendResult> {
    this.initialize();

    if (!this.initialized) {
      return {
        success: false,
        error: 'Email service not initialized',
        errorCode: 'NOT_INITIALIZED',
      };
    }

    try {
      const msg: sgMail.MailDataRequired = {
        to: options.to,
        from: {
          email: this.fromEmail,
          name: this.fromName,
        },
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html),
      };

      // Add reply-to if provided
      if (options.replyTo) {
        msg.replyTo = options.replyTo;
      }

      // Add attachments if provided
      if (options.attachments && options.attachments.length > 0) {
        msg.attachments = options.attachments.map((att) => ({
          content: att.content,
          filename: att.filename,
          type: att.type,
          disposition: att.disposition,
          contentId: att.contentId,
        }));
      }

      // Add categories for analytics
      if (options.categories) {
        msg.categories = options.categories;
      }

      // Add custom args for webhook tracking
      if (options.customArgs) {
        msg.customArgs = options.customArgs;
      }

      // Schedule for later if sendAt provided
      if (options.sendAt) {
        msg.sendAt = options.sendAt;
      }

      const startTime = Date.now();
      const response = await sgMail.send(msg);
      const latency = Date.now() - startTime;

      const messageId = response[0]?.headers?.['x-message-id'];

      logger.info('[EmailService] Email sent successfully', {
        to: this.maskEmail(options.to),
        subject: options.subject,
        messageId,
        latency: `${latency}ms`,
      });

      return {
        success: true,
        messageId,
        latency,
        statusCode: response[0].statusCode,
      };
    } catch (error: any) {
      logger.error('[EmailService] Send failed', {
        error: error.message,
        to: this.maskEmail(options.to),
        subject: options.subject,
        statusCode: error.code,
      });

      return {
        success: false,
        error: error.message,
        errorCode: error.code,
        statusCode: error.code,
      };
    }
  }

  /**
   * Send batch created email
   */
  async sendBatchCreatedEmail(
    email: string,
    details: BatchNotificationDetails
  ): Promise<EmailSendResult> {
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lote Registrado - AgroBridge</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1B5E20 0%, #2E7D32 100%); color: white; padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Lote Registrado</h1>
              <p style="margin: 8px 0 0; opacity: 0.9;">Tu lote ha sido registrado en la blockchain</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <div style="display: inline-block; background: #E8F5E9; color: #2E7D32; padding: 6px 12px; border-radius: 6px; font-size: 14px; font-weight: 600; margin-bottom: 20px;">CONFIRMADO</div>

              <p style="font-size: 16px; margin-bottom: 24px;">
                Hola${details.producerName ? ` ${details.producerName}` : ''},<br><br>
                Tu lote <strong>${details.batchId}</strong> ha sido registrado exitosamente en la blockchain de AgroBridge.
              </p>

              <!-- Details Box -->
              <table role="presentation" style="width: 100%; background: #F5F5F5; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <tr>
                  <td style="padding: 12px 20px; border-bottom: 1px solid #E0E0E0;">
                    <span style="font-weight: 600; color: #666;">ID del Lote:</span>
                  </td>
                  <td style="padding: 12px 20px; border-bottom: 1px solid #E0E0E0; text-align: right;">
                    ${details.batchId}
                  </td>
                </tr>
                ${details.variety ? `
                <tr>
                  <td style="padding: 12px 20px; border-bottom: 1px solid #E0E0E0;">
                    <span style="font-weight: 600; color: #666;">Variedad:</span>
                  </td>
                  <td style="padding: 12px 20px; border-bottom: 1px solid #E0E0E0; text-align: right;">
                    ${details.variety}
                  </td>
                </tr>
                ` : ''}
                ${details.origin ? `
                <tr>
                  <td style="padding: 12px 20px; border-bottom: 1px solid #E0E0E0;">
                    <span style="font-weight: 600; color: #666;">Origen:</span>
                  </td>
                  <td style="padding: 12px 20px; border-bottom: 1px solid #E0E0E0; text-align: right;">
                    ${details.origin}
                  </td>
                </tr>
                ` : ''}
                ${details.weightKg ? `
                <tr>
                  <td style="padding: 12px 20px; border-bottom: 1px solid #E0E0E0;">
                    <span style="font-weight: 600; color: #666;">Peso:</span>
                  </td>
                  <td style="padding: 12px 20px; border-bottom: 1px solid #E0E0E0; text-align: right;">
                    ${new Intl.NumberFormat('es-MX').format(details.weightKg)} kg
                  </td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 12px 20px;">
                    <span style="font-weight: 600; color: #666;">Fecha:</span>
                  </td>
                  <td style="padding: 12px 20px; text-align: right;">
                    ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0;">
                Tu certificado blockchain estará listo en unos minutos y te avisaremos cuando puedas descargarlo.
              </p>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center">
                    <a href="${this.appUrl}/batches/${details.batchId}" style="display: inline-block; background: #2E7D32; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0;">
                      Ver Detalles del Lote
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="text-align: center; padding: 30px; color: #999; font-size: 14px; border-top: 1px solid #E0E0E0;">
              <p style="margin: 0;">© ${new Date().getFullYear()} AgroBridge. Todos los derechos reservados.</p>
              <p style="margin: 8px 0 0;">
                <a href="${this.appUrl}" style="color: #2E7D32; text-decoration: none;">Ir a AgroBridge</a> |
                <a href="${this.appUrl}/help" style="color: #2E7D32; text-decoration: none;">Ayuda</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    return await this.sendEmail({
      to: email,
      subject: `✅ Lote ${details.batchId} registrado exitosamente`,
      html,
      categories: ['batch-created', 'transactional'],
      customArgs: {
        batchId: details.batchId,
        type: 'batch-created',
      },
    });
  }

  /**
   * Send certificate ready email with PDF attachment
   */
  async sendCertificateEmail(
    email: string,
    details: CertificateNotificationDetails,
    pdfBase64?: string
  ): Promise<EmailSendResult> {
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Certificado Listo - AgroBridge</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1B5E20 0%, #2E7D32 100%); color: white; padding: 40px 30px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 16px;">🎉</div>
              <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Certificado Blockchain Listo</h1>
              <p style="margin: 8px 0 0; opacity: 0.9;">Tu certificado ya está disponible</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="font-size: 16px; margin-bottom: 24px;">
                Hola,<br><br>
                Tu certificado blockchain para el lote <strong>${details.batchId}</strong> está listo para descargar.
              </p>

              <!-- Certificate Box -->
              <table role="presentation" style="width: 100%; background: linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%); border-radius: 12px; padding: 30px; text-align: center; margin: 24px 0;">
                <tr>
                  <td>
                    <div style="font-size: 64px; margin-bottom: 16px;">🏆</div>
                    <h2 style="color: #1B5E20; margin-bottom: 12px;">Certificado Blockchain</h2>
                    <p style="color: #2E7D32; margin: 0;">Lote ${details.batchId}</p>
                    ${details.blockchainHash ? `
                    <p style="color: #666; font-size: 12px; margin-top: 12px; word-break: break-all;">
                      Hash: ${details.blockchainHash}
                    </p>
                    ` : ''}
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0;">
                Este certificado está registrado inmutablemente en la blockchain y puede ser verificado por cualquier persona.
              </p>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center">
                    <a href="${details.certificateUrl || `${this.appUrl}/certificates/${details.batchId}`}" style="display: inline-block; background: #2E7D32; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; box-shadow: 0 4px 12px rgba(46, 125, 50, 0.3);">
                      📥 Descargar Certificado
                    </a>
                  </td>
                </tr>
              </table>

              ${pdfBase64 ? `
              <p style="margin-top: 24px; color: #666; font-size: 14px; text-align: center;">
                También puedes encontrar tu certificado adjunto a este email.
              </p>
              ` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="text-align: center; padding: 30px; color: #999; font-size: 14px; border-top: 1px solid #E0E0E0;">
              <p style="margin: 0;">© ${new Date().getFullYear()} AgroBridge. Todos los derechos reservados.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const attachments: EmailAttachment[] = [];
    if (pdfBase64) {
      attachments.push({
        content: pdfBase64,
        filename: `certificado_${details.batchId}.pdf`,
        type: 'application/pdf',
        disposition: 'attachment',
      });
    }

    return await this.sendEmail({
      to: email,
      subject: `🏆 Certificado blockchain listo - Lote ${details.batchId}`,
      html,
      attachments,
      categories: ['certificate-ready', 'transactional'],
      customArgs: {
        batchId: details.batchId,
        type: 'certificate-ready',
      },
    });
  }

  /**
   * Send sensor alert email
   */
  async sendSensorAlertEmail(
    email: string,
    details: SensorAlertDetails
  ): Promise<EmailSendResult> {
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Alerta de Sensor - AgroBridge</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #C62828 0%, #D32F2F 100%); color: white; padding: 40px 30px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 16px;">🚨</div>
              <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Alerta de Sensor</h1>
              <p style="margin: 8px 0 0; opacity: 0.9;">Se ha excedido un umbral crítico</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <div style="display: inline-block; background: #FFEBEE; color: #C62828; padding: 6px 12px; border-radius: 6px; font-size: 14px; font-weight: 600; margin-bottom: 20px;">ACCIÓN REQUERIDA</div>

              <!-- Alert Details -->
              <table role="presentation" style="width: 100%; background: #FFF3E0; border: 2px solid #FF9800; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <tr>
                  <td style="padding: 12px 20px; border-bottom: 1px solid #FFE0B2;">
                    <span style="font-weight: 600; color: #E65100;">Sensor:</span>
                  </td>
                  <td style="padding: 12px 20px; border-bottom: 1px solid #FFE0B2; text-align: right; font-weight: bold;">
                    ${details.sensorType}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 20px; border-bottom: 1px solid #FFE0B2;">
                    <span style="font-weight: 600; color: #E65100;">Valor Actual:</span>
                  </td>
                  <td style="padding: 12px 20px; border-bottom: 1px solid #FFE0B2; text-align: right; font-weight: bold; color: #C62828; font-size: 18px;">
                    ${details.currentValue} ${details.unit}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 20px; border-bottom: 1px solid #FFE0B2;">
                    <span style="font-weight: 600; color: #E65100;">Umbral:</span>
                  </td>
                  <td style="padding: 12px 20px; border-bottom: 1px solid #FFE0B2; text-align: right;">
                    ${details.threshold} ${details.unit}
                  </td>
                </tr>
                ${details.location ? `
                <tr>
                  <td style="padding: 12px 20px; border-bottom: 1px solid #FFE0B2;">
                    <span style="font-weight: 600; color: #E65100;">Ubicación:</span>
                  </td>
                  <td style="padding: 12px 20px; border-bottom: 1px solid #FFE0B2; text-align: right;">
                    ${details.location}
                  </td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 12px 20px;">
                    <span style="font-weight: 600; color: #E65100;">Hora:</span>
                  </td>
                  <td style="padding: 12px 20px; text-align: right;">
                    ${new Date().toLocaleString('es-MX')}
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0;">
                Por favor revisa el sensor inmediatamente y toma las acciones necesarias para corregir la situación.
              </p>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center">
                    <a href="${this.appUrl}/sensors${details.batchId ? `?batchId=${details.batchId}` : ''}" style="display: inline-block; background: #C62828; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0;">
                      Ver Sensores
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="text-align: center; padding: 30px; color: #999; font-size: 14px; border-top: 1px solid #E0E0E0;">
              <p style="margin: 0;">© ${new Date().getFullYear()} AgroBridge. Todos los derechos reservados.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    return await this.sendEmail({
      to: email,
      subject: `🚨 ALERTA: ${details.sensorType} excedió el umbral (${details.currentValue}${details.unit})`,
      html,
      categories: ['sensor-alert', 'critical'],
      customArgs: {
        sensorType: details.sensorType,
        type: 'sensor-alert',
        ...(details.batchId && { batchId: details.batchId }),
      },
    });
  }

  /**
   * Send order confirmation email
   */
  async sendOrderConfirmationEmail(
    email: string,
    details: OrderNotificationDetails
  ): Promise<EmailSendResult> {
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Orden Confirmada - AgroBridge</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1B5E20 0%, #2E7D32 100%); color: white; padding: 40px 30px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
              <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Orden Confirmada</h1>
              <p style="margin: 8px 0 0; opacity: 0.9;">Tu orden ha sido procesada exitosamente</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="font-size: 16px; margin-bottom: 24px;">
                Hola,<br><br>
                Tu orden <strong>#${details.orderId}</strong> ha sido ${details.status === 'CONFIRMED' ? 'confirmada' : details.status.toLowerCase()}.
              </p>

              <!-- Order Details -->
              <table role="presentation" style="width: 100%; background: #F5F5F5; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <tr>
                  <td style="padding: 12px 20px; border-bottom: 1px solid #E0E0E0;">
                    <span style="font-weight: 600; color: #666;">Número de Orden:</span>
                  </td>
                  <td style="padding: 12px 20px; border-bottom: 1px solid #E0E0E0; text-align: right;">
                    #${details.orderId}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 20px; border-bottom: 1px solid #E0E0E0;">
                    <span style="font-weight: 600; color: #666;">Estado:</span>
                  </td>
                  <td style="padding: 12px 20px; border-bottom: 1px solid #E0E0E0; text-align: right;">
                    <span style="background: #E8F5E9; color: #2E7D32; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">${details.status}</span>
                  </td>
                </tr>
                ${details.total ? `
                <tr>
                  <td style="padding: 12px 20px;">
                    <span style="font-weight: 600; color: #666;">Total:</span>
                  </td>
                  <td style="padding: 12px 20px; text-align: right; font-weight: bold; font-size: 18px; color: #2E7D32;">
                    ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: details.currency || 'MXN' }).format(details.total)}
                  </td>
                </tr>
                ` : ''}
              </table>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center">
                    <a href="${details.trackingUrl || `${this.appUrl}/orders/${details.orderId}`}" style="display: inline-block; background: #2E7D32; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0;">
                      Ver Detalles de la Orden
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="text-align: center; padding: 30px; color: #999; font-size: 14px; border-top: 1px solid #E0E0E0;">
              <p style="margin: 0;">© ${new Date().getFullYear()} AgroBridge. Todos los derechos reservados.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    return await this.sendEmail({
      to: email,
      subject: `✅ Orden #${details.orderId} ${details.status === 'CONFIRMED' ? 'confirmada' : details.status.toLowerCase()}`,
      html,
      categories: ['order-confirmation', 'transactional'],
      customArgs: {
        orderId: details.orderId,
        status: details.status,
        type: 'order-confirmation',
      },
    });
  }

  /**
   * Send welcome email to new users
   */
  async sendWelcomeEmail(
    email: string,
    name: string
  ): Promise<EmailSendResult> {
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenido a AgroBridge</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1B5E20 0%, #2E7D32 100%); color: white; padding: 40px 30px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 16px;">🌱</div>
              <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Bienvenido a AgroBridge</h1>
              <p style="margin: 8px 0 0; opacity: 0.9;">Trazabilidad agrícola en blockchain</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="font-size: 16px; margin-bottom: 24px;">
                Hola <strong>${name}</strong>,<br><br>
                ¡Bienvenido a AgroBridge! Estamos emocionados de tenerte en nuestra plataforma de trazabilidad agrícola basada en blockchain.
              </p>

              <p style="margin: 24px 0;">
                Con AgroBridge podrás:
              </p>

              <ul style="margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 8px;">Registrar tus lotes en la blockchain</li>
                <li style="margin-bottom: 8px;">Obtener certificados verificables</li>
                <li style="margin-bottom: 8px;">Rastrear toda la cadena de suministro</li>
                <li style="margin-bottom: 8px;">Conectar con compradores internacionales</li>
              </ul>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center">
                    <a href="${this.appUrl}/dashboard" style="display: inline-block; background: #2E7D32; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0;">
                      Comenzar Ahora
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin-top: 24px; color: #666;">
                Si tienes alguna pregunta, no dudes en contactarnos en <a href="mailto:soporte@agrobridge.io" style="color: #2E7D32;">soporte@agrobridge.io</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="text-align: center; padding: 30px; color: #999; font-size: 14px; border-top: 1px solid #E0E0E0;">
              <p style="margin: 0;">© ${new Date().getFullYear()} AgroBridge. Todos los derechos reservados.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    return await this.sendEmail({
      to: email,
      subject: `🌱 Bienvenido a AgroBridge, ${name}!`,
      html,
      categories: ['welcome', 'onboarding'],
      customArgs: {
        type: 'welcome',
      },
    });
  }

  /**
   * Strip HTML tags for plain text version
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>.*<\/style>/gms, '')
      .replace(/<script[^>]*>.*<\/script>/gms, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Send farmer invitation email (B2B2C enrollment flow)
   */
  async sendFarmerInvitationEmail(
    email: string,
    details: {
      farmerName?: string;
      exportCompanyName: string;
      inviteToken: string;
      signupUrl: string;
      expiresAt: Date;
    }
  ): Promise<EmailSendResult> {
    const expiryDate = details.expiresAt.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitación a AgroBridge</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1B5E20 0%, #2E7D32 100%); color: white; padding: 40px 30px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 16px;">🌱</div>
              <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Invitación a AgroBridge</h1>
              <p style="margin: 8px 0 0; opacity: 0.9;">Plataforma de Certificación Orgánica</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="font-size: 16px; margin-bottom: 24px;">
                Hola${details.farmerName ? ` <strong>${details.farmerName}</strong>` : ''},<br><br>
                <strong>${details.exportCompanyName}</strong> te ha invitado a unirte a AgroBridge, la plataforma de certificación orgánica que conecta agricultores con mercados internacionales.
              </p>

              <!-- Benefits Box -->
              <table role="presentation" style="width: 100%; background: #E8F5E9; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <h3 style="color: #1B5E20; margin: 0 0 16px;">Con AgroBridge podrás:</h3>
                    <ul style="margin: 0; padding-left: 20px; color: #2E7D32;">
                      <li style="margin-bottom: 8px;">Registrar tus campos orgánicos</li>
                      <li style="margin-bottom: 8px;">Documentar inspecciones y prácticas agrícolas</li>
                      <li style="margin-bottom: 8px;">Obtener certificados con verificación blockchain</li>
                      <li style="margin-bottom: 8px;">Exportar a mercados de EE.UU. y Europa</li>
                    </ul>
                  </td>
                </tr>
              </table>

              <p style="text-align: center; font-size: 14px; color: #666; margin: 24px 0;">
                Tu código de invitación es:
              </p>

              <div style="background: #F5F5F5; border: 2px dashed #2E7D32; border-radius: 8px; padding: 20px; text-align: center; margin: 16px 0;">
                <span style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #1B5E20;">
                  ${details.inviteToken.substring(0, 8).toUpperCase()}
                </span>
              </div>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center">
                    <a href="${details.signupUrl}" style="display: inline-block; background: #2E7D32; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 24px 0; font-size: 16px; box-shadow: 0 4px 12px rgba(46, 125, 50, 0.3);">
                      Aceptar Invitación
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size: 13px; color: #999; text-align: center; margin-top: 24px;">
                Esta invitación expira el <strong>${expiryDate}</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="text-align: center; padding: 30px; color: #999; font-size: 14px; border-top: 1px solid #E0E0E0;">
              <p style="margin: 0;">© ${new Date().getFullYear()} AgroBridge. Todos los derechos reservados.</p>
              <p style="margin: 8px 0 0;">
                <a href="${this.appUrl}" style="color: #2E7D32; text-decoration: none;">Visitar AgroBridge</a> |
                <a href="${this.appUrl}/help" style="color: #2E7D32; text-decoration: none;">Ayuda</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    return await this.sendEmail({
      to: email,
      subject: `🌱 ${details.exportCompanyName} te invita a AgroBridge`,
      html,
      categories: ['farmer-invitation', 'b2b'],
      customArgs: {
        type: 'farmer-invitation',
        exportCompanyName: details.exportCompanyName,
      },
    });
  }

  /**
   * Send export company invoice email
   */
  async sendInvoiceEmail(
    email: string,
    details: {
      companyName: string;
      invoiceNumber: string;
      periodStart: Date;
      periodEnd: Date;
      total: number;
      currency: string;
      dueDate: Date;
      invoiceUrl: string;
    }
  ): Promise<EmailSendResult> {
    const formatCurrency = (amount: number) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: details.currency }).format(amount);

    const formatDate = (date: Date) =>
      date.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Factura AgroBridge - ${details.invoiceNumber}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="background: #1B5E20; color: white; padding: 30px; text-align: center;">
              <h1 style="margin: 0;">Factura ${details.invoiceNumber}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p>Hola <strong>${details.companyName}</strong>,</p>
              <p>Tu factura de AgroBridge está lista.</p>

              <table style="width: 100%; background: #F5F5F5; border-radius: 8px; margin: 24px 0;">
                <tr>
                  <td style="padding: 16px; border-bottom: 1px solid #E0E0E0;">Período</td>
                  <td style="padding: 16px; text-align: right; border-bottom: 1px solid #E0E0E0;">${formatDate(details.periodStart)} - ${formatDate(details.periodEnd)}</td>
                </tr>
                <tr>
                  <td style="padding: 16px; border-bottom: 1px solid #E0E0E0;">Fecha de vencimiento</td>
                  <td style="padding: 16px; text-align: right; border-bottom: 1px solid #E0E0E0;">${formatDate(details.dueDate)}</td>
                </tr>
                <tr>
                  <td style="padding: 16px; font-weight: bold;">Total a pagar</td>
                  <td style="padding: 16px; text-align: right; font-size: 20px; font-weight: bold; color: #1B5E20;">${formatCurrency(details.total)}</td>
                </tr>
              </table>

              <div style="text-align: center;">
                <a href="${details.invoiceUrl}" style="display: inline-block; background: #2E7D32; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                  Ver Factura Completa
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="text-align: center; padding: 20px; color: #999; font-size: 12px; border-top: 1px solid #E0E0E0;">
              © ${new Date().getFullYear()} AgroBridge
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    return await this.sendEmail({
      to: email,
      subject: `📄 Factura ${details.invoiceNumber} - AgroBridge`,
      html,
      categories: ['invoice', 'billing'],
      customArgs: {
        type: 'invoice',
        invoiceNumber: details.invoiceNumber,
      },
    });
  }

  /**
   * Mask email for logging (security)
   */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain || local.length < 3) return '***@***';
    return `${local.substring(0, 3)}...@${domain}`;
  }
}

// Export singleton instance
export const emailService = EmailService.getInstance();
export default emailService;
