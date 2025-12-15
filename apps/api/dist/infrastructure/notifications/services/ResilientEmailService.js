import logger from '../../../shared/utils/logger.js';
import { emailService } from './EmailService.js';
import { sesProvider } from '../providers/SESProvider.js';
export class ResilientEmailService {
    static instance = null;
    config;
    sesStatus;
    sendgridStatus;
    constructor() {
        this.config = {
            maxRetries: 3,
            retryDelayMs: 1000,
            circuitBreakerThreshold: 5,
            circuitBreakerResetMs: 60000,
            primaryProvider: process.env.EMAIL_PRIMARY_PROVIDER || 'ses',
        };
        this.sesStatus = {
            name: 'ses',
            available: false,
            consecutiveFailures: 0,
            lastFailure: null,
            circuitOpen: false,
            circuitOpenUntil: null,
        };
        this.sendgridStatus = {
            name: 'sendgrid',
            available: false,
            consecutiveFailures: 0,
            lastFailure: null,
            circuitOpen: false,
            circuitOpenUntil: null,
        };
        this.initializeProviders();
    }
    static getInstance() {
        if (!ResilientEmailService.instance) {
            ResilientEmailService.instance = new ResilientEmailService();
        }
        return ResilientEmailService.instance;
    }
    initializeProviders() {
        this.sesStatus.available = sesProvider.isAvailable();
        this.sendgridStatus.available = emailService.isAvailable();
        logger.info('[ResilientEmailService] Providers initialized', {
            ses: this.sesStatus.available,
            sendgrid: this.sendgridStatus.available,
            primary: this.config.primaryProvider,
        });
    }
    isAvailable() {
        return this.sesStatus.available || this.sendgridStatus.available;
    }
    async getHealth() {
        let sesHealth = null;
        if (this.sesStatus.available) {
            sesHealth = await sesProvider.getHealth();
        }
        return {
            primaryProvider: this.config.primaryProvider,
            fallbackProvider: this.config.primaryProvider === 'ses' ? 'sendgrid' : 'ses',
            providers: {
                ses: {
                    available: this.sesStatus.available,
                    health: sesHealth,
                    circuitStatus: this.getCircuitStatus(this.sesStatus),
                },
                sendgrid: {
                    available: this.sendgridStatus.available,
                    circuitStatus: this.getCircuitStatus(this.sendgridStatus),
                },
            },
        };
    }
    getCircuitStatus(status) {
        if (!status.circuitOpen)
            return 'closed';
        if (status.circuitOpenUntil && new Date() > status.circuitOpenUntil)
            return 'half-open';
        return 'open';
    }
    isProviderAvailable(status) {
        if (!status.available)
            return false;
        const circuitStatus = this.getCircuitStatus(status);
        return circuitStatus === 'closed' || circuitStatus === 'half-open';
    }
    recordSuccess(status) {
        status.consecutiveFailures = 0;
        status.circuitOpen = false;
        status.circuitOpenUntil = null;
    }
    recordFailure(status) {
        status.consecutiveFailures++;
        status.lastFailure = new Date();
        if (status.consecutiveFailures >= this.config.circuitBreakerThreshold) {
            status.circuitOpen = true;
            status.circuitOpenUntil = new Date(Date.now() + this.config.circuitBreakerResetMs);
            logger.warn('[ResilientEmailService] Circuit breaker opened', {
                provider: status.name,
                failures: status.consecutiveFailures,
                resetAt: status.circuitOpenUntil.toISOString(),
            });
        }
    }
    async sendEmail(options) {
        const providers = this.getOrderedProviders();
        for (const provider of providers) {
            const result = await this.trySendWithProvider(provider, options);
            if (result.success) {
                return result;
            }
        }
        logger.error('[ResilientEmailService] All providers failed', {
            to: options.to,
            subject: options.subject,
        });
        return {
            success: false,
            error: 'All email providers failed',
            errorCode: 'ALL_PROVIDERS_FAILED',
        };
    }
    getOrderedProviders() {
        const primary = this.config.primaryProvider;
        const fallback = primary === 'ses' ? 'sendgrid' : 'ses';
        const providers = [];
        const primaryStatus = primary === 'ses' ? this.sesStatus : this.sendgridStatus;
        if (this.isProviderAvailable(primaryStatus)) {
            providers.push(primary);
        }
        const fallbackStatus = fallback === 'ses' ? this.sesStatus : this.sendgridStatus;
        if (this.isProviderAvailable(fallbackStatus)) {
            providers.push(fallback);
        }
        return providers;
    }
    async trySendWithProvider(provider, options) {
        const status = provider === 'ses' ? this.sesStatus : this.sendgridStatus;
        for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
            try {
                let result;
                if (provider === 'ses') {
                    result = await sesProvider.sendEmail(options);
                }
                else {
                    result = await emailService.sendEmail(options);
                }
                if (result.success) {
                    this.recordSuccess(status);
                    return {
                        ...result,
                        provider,
                        attempt,
                    };
                }
                if (this.isNonRetryableError(result.errorCode)) {
                    this.recordFailure(status);
                    return result;
                }
                if (attempt < this.config.maxRetries) {
                    await this.delay(this.config.retryDelayMs * Math.pow(2, attempt - 1));
                }
            }
            catch (error) {
                logger.error('[ResilientEmailService] Provider error', {
                    provider,
                    attempt,
                    error: error.message,
                });
                if (attempt === this.config.maxRetries) {
                    this.recordFailure(status);
                }
            }
        }
        this.recordFailure(status);
        return {
            success: false,
            error: `Provider ${provider} failed after ${this.config.maxRetries} attempts`,
            errorCode: 'MAX_RETRIES_EXCEEDED',
            provider,
        };
    }
    isNonRetryableError(errorCode) {
        const nonRetryableErrors = [
            'InvalidParameterValue',
            'MessageRejected',
            'MailFromDomainNotVerified',
            'AddressBlacklisted',
            'InvalidEmailAddress',
        ];
        return errorCode ? nonRetryableErrors.includes(errorCode) : false;
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    async sendBatchCreatedEmail(email, details) {
        return await emailService.sendBatchCreatedEmail(email, details);
    }
    async sendCertificateEmail(email, details, pdfBase64) {
        return await emailService.sendCertificateEmail(email, details, pdfBase64);
    }
    async sendSensorAlertEmail(email, details) {
        return await emailService.sendSensorAlertEmail(email, details);
    }
    async sendOrderConfirmationEmail(email, details) {
        return await emailService.sendOrderConfirmationEmail(email, details);
    }
    async sendWelcomeEmail(email, name) {
        return await emailService.sendWelcomeEmail(email, name);
    }
    async sendPasswordResetEmail(email, resetToken) {
        const appUrl = process.env.APP_URL || 'https://app.agrobridge.io';
        const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;
        const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Restablecer Contraseña - AgroBridge</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #1B5E20 0%, #2E7D32 100%); color: white; padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Restablecer Contraseña</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <p style="font-size: 16px; margin-bottom: 24px;">
                Hola,<br><br>
                Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón para crear una nueva.
              </p>
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" style="display: inline-block; background: #2E7D32; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0;">
                      Restablecer Contraseña
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin-top: 24px; color: #666; font-size: 14px;">
                Este enlace expirará en 1 hora. Si no solicitaste restablecer tu contraseña, puedes ignorar este correo.
              </p>
            </td>
          </tr>
          <tr>
            <td style="text-align: center; padding: 30px; color: #999; font-size: 14px; border-top: 1px solid #E0E0E0;">
              <p style="margin: 0;">&copy; ${new Date().getFullYear()} AgroBridge. Todos los derechos reservados.</p>
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
            subject: 'Restablecer contraseña - AgroBridge',
            html,
            categories: ['password-reset', 'transactional'],
        });
    }
    async sendVerificationEmail(email, verificationToken) {
        const appUrl = process.env.APP_URL || 'https://app.agrobridge.io';
        const verifyUrl = `${appUrl}/verify-email?token=${verificationToken}`;
        const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verificar Email - AgroBridge</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #1B5E20 0%, #2E7D32 100%); color: white; padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Verificar Email</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <p style="font-size: 16px; margin-bottom: 24px;">
                Hola,<br><br>
                Gracias por registrarte en AgroBridge. Por favor verifica tu email haciendo clic en el botón.
              </p>
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center">
                    <a href="${verifyUrl}" style="display: inline-block; background: #2E7D32; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0;">
                      Verificar Email
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin-top: 24px; color: #666; font-size: 14px;">
                Este enlace expirará en 24 horas.
              </p>
            </td>
          </tr>
          <tr>
            <td style="text-align: center; padding: 30px; color: #999; font-size: 14px; border-top: 1px solid #E0E0E0;">
              <p style="margin: 0;">&copy; ${new Date().getFullYear()} AgroBridge. Todos los derechos reservados.</p>
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
            subject: 'Verifica tu email - AgroBridge',
            html,
            categories: ['email-verification', 'transactional'],
        });
    }
    async send2FACodeEmail(email, code) {
        const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Código de Verificación - AgroBridge</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #1B5E20 0%, #2E7D32 100%); color: white; padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Código de Verificación</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px; text-align: center;">
              <p style="font-size: 16px; margin-bottom: 24px;">
                Tu código de verificación es:
              </p>
              <div style="background: #F5F5F5; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #2E7D32;">${code}</span>
              </div>
              <p style="color: #666; font-size: 14px;">
                Este código expirará en 10 minutos.
              </p>
            </td>
          </tr>
          <tr>
            <td style="text-align: center; padding: 30px; color: #999; font-size: 14px; border-top: 1px solid #E0E0E0;">
              <p style="margin: 0;">&copy; ${new Date().getFullYear()} AgroBridge. Todos los derechos reservados.</p>
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
            subject: `${code} - Código de verificación AgroBridge`,
            html,
            categories: ['2fa', 'transactional'],
        });
    }
}
export const resilientEmailService = ResilientEmailService.getInstance();
export default resilientEmailService;
