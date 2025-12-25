import { logger } from '../logging/logger.js';
const messages = {
    invoiceCreated: {
        es: (data) => `
📄 *Nueva Factura Generada*

Folio: ${data.folio}
UUID: ${data.uuid}
Cliente: ${data.recipientName}
Total: $${data.total.toLocaleString('es-MX')} ${data.currency}
${data.blockchainHash ? `\n⛓️ Registrada en blockchain` : ''}
${data.pdfUrl ? `\n📎 PDF: ${data.pdfUrl}` : ''}

🔗 Verificar: ${data.verifyUrl}

_AgroBridge - Trazabilidad verificada_
`.trim(),
        en: (data) => `
📄 *New Invoice Generated*

Folio: ${data.folio}
UUID: ${data.uuid}
Client: ${data.recipientName}
Total: $${data.total.toLocaleString('en-US')} ${data.currency}
${data.blockchainHash ? `\n⛓️ Registered on blockchain` : ''}
${data.pdfUrl ? `\n📎 PDF: ${data.pdfUrl}` : ''}

🔗 Verify: ${data.verifyUrl}

_AgroBridge - Verified Traceability_
`.trim(),
    },
    invoiceDueReminder: {
        es: (data) => `
⏰ *Recordatorio: Factura por Vencer*

Folio: ${data.folio}
Monto: $${data.amount.toLocaleString('es-MX')} ${data.currency}
Vence: ${data.dueDate.toLocaleDateString('es-MX')}
Días restantes: ${data.daysRemaining}

Por favor realiza el pago a tiempo para mantener tu historial crediticio.

_AgroBridge_
`.trim(),
        en: (data) => `
⏰ *Reminder: Invoice Due Soon*

Folio: ${data.folio}
Amount: $${data.amount.toLocaleString('en-US')} ${data.currency}
Due: ${data.dueDate.toLocaleDateString('en-US')}
Days remaining: ${data.daysRemaining}

Please make payment on time to maintain your credit history.

_AgroBridge_
`.trim(),
    },
    invoiceOverdue: {
        es: (data) => `
🚨 *Factura Vencida*

Folio: ${data.folio}
Monto: $${data.amount.toLocaleString('es-MX')} ${data.currency}
Venció: ${data.dueDate.toLocaleDateString('es-MX')}
Días de retraso: ${data.daysOverdue}

Por favor contacta a tu representante para evitar cargos adicionales.

_AgroBridge_
`.trim(),
        en: (data) => `
🚨 *Invoice Overdue*

Folio: ${data.folio}
Amount: $${data.amount.toLocaleString('en-US')} ${data.currency}
Was due: ${data.dueDate.toLocaleDateString('en-US')}
Days overdue: ${data.daysOverdue}

Please contact your representative to avoid additional charges.

_AgroBridge_
`.trim(),
    },
    referralSuccess: {
        es: (data) => `
🎉 *¡Nuevo Referido Activo!*

${data.referredName} se unió usando tu código y ya está activo.

Tu recompensa: ${data.reward}
${data.blockchainProofUrl ? `\n⛓️ Prueba: ${data.blockchainProofUrl}` : ''}

¡Sigue compartiendo tu código para ganar más recompensas!

_AgroBridge_
`.trim(),
        en: (data) => `
🎉 *New Active Referral!*

${data.referredName} joined using your code and is now active.

Your reward: ${data.reward}
${data.blockchainProofUrl ? `\n⛓️ Proof: ${data.blockchainProofUrl}` : ''}

Keep sharing your code to earn more rewards!

_AgroBridge_
`.trim(),
    },
    referralActivated: {
        es: (data) => `
🏆 *¡Referido Completado!*

${data.referredName} alcanzó el hito de 30 días activos.

📊 Estadísticas:
• Referidos activos: ${data.totalActive}
• Tu posición en el leaderboard: #${data.leaderboardRank}

¡Sigue subiendo en el ranking!

_AgroBridge_
`.trim(),
        en: (data) => `
🏆 *Referral Completed!*

${data.referredName} reached the 30-day active milestone.

📊 Stats:
• Active referrals: ${data.totalActive}
• Your leaderboard position: #${data.leaderboardRank}

Keep climbing the ranks!

_AgroBridge_
`.trim(),
    },
};
export class WhatsAppNotificationService {
    whatsAppService;
    prisma;
    constructor(whatsAppService, prisma) {
        this.whatsAppService = whatsAppService;
        this.prisma = prisma;
    }
    async sendInvoiceCreatedNotification(phoneNumber, data, language = 'es') {
        const message = messages.invoiceCreated[language](data);
        const result = await this.whatsAppService.sendText(phoneNumber, message);
        if (result.success) {
            logger.info('Invoice notification sent', {
                folio: data.folio,
                phoneNumber: phoneNumber.slice(-4),
            });
        }
        return result;
    }
    async sendInvoiceDueReminder(phoneNumber, data, language = 'es') {
        const message = messages.invoiceDueReminder[language](data);
        const result = await this.whatsAppService.sendText(phoneNumber, message);
        if (result.success) {
            logger.info('Invoice due reminder sent', {
                folio: data.folio,
                daysRemaining: data.daysRemaining,
            });
        }
        return result;
    }
    async sendInvoiceOverdueNotification(phoneNumber, data, language = 'es') {
        const message = messages.invoiceOverdue[language](data);
        const result = await this.whatsAppService.sendText(phoneNumber, message);
        if (result.success) {
            logger.info('Invoice overdue notification sent', {
                folio: data.folio,
                daysOverdue: data.daysOverdue,
            });
        }
        return result;
    }
    async sendReferralSuccessNotification(phoneNumber, data, language = 'es') {
        const message = messages.referralSuccess[language](data);
        const result = await this.whatsAppService.sendText(phoneNumber, message);
        if (result.success) {
            logger.info('Referral success notification sent', {
                referredName: data.referredName,
            });
        }
        return result;
    }
    async sendReferralActivatedNotification(phoneNumber, data, language = 'es') {
        const message = messages.referralActivated[language](data);
        const result = await this.whatsAppService.sendText(phoneNumber, message);
        if (result.success) {
            logger.info('Referral activated notification sent', {
                referredName: data.referredName,
                totalActive: data.totalActive,
            });
        }
        return result;
    }
    async getUserPhoneNumber(userId) {
        const preference = await this.prisma.notificationPreference.findUnique({
            where: { userId },
        });
        if (preference?.phoneNumber && preference.whatsappEnabled) {
            return preference.phoneNumber;
        }
        return null;
    }
}
