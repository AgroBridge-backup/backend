export const messages = {
    welcome: {
        es: (name) => `¡Hola ${name}! 👋\n\nSoy el asistente virtual de *AgroBridge*. Estoy aquí para ayudarte con tus anticipos de cosecha.\n\n¿Qué te gustaría hacer hoy?`,
        en: (name) => `Hello ${name}! 👋\n\nI'm the *AgroBridge* virtual assistant. I'm here to help you with your harvest advances.\n\nWhat would you like to do today?`,
    },
    mainMenu: {
        es: '📋 *Menú Principal*\n\nElige una opción:',
        en: '📋 *Main Menu*\n\nChoose an option:',
    },
    noEligibleOrders: {
        es: '😔 No tienes órdenes elegibles para anticipo en este momento.\n\nCuando tengas una orden confirmada por un comprador, podrás solicitar un anticipo.',
        en: '😔 You don\'t have any eligible orders for advance at this time.\n\nWhen you have an order confirmed by a buyer, you\'ll be able to request an advance.',
    },
    selectOrder: {
        es: '📦 *Órdenes Elegibles*\n\nSelecciona la orden para la cual quieres solicitar un anticipo:',
        en: '📦 *Eligible Orders*\n\nSelect the order for which you want to request an advance:',
    },
    advanceCalculation: {
        es: (data) => `
💰 *Cálculo de Anticipo*

📦 *Orden:* ${data.orderNumber}
💵 *Valor de la orden:* ${data.orderAmount}
📊 *Tu score crediticio:* ${data.creditScore}/100

━━━━━━━━━━━━━━━━━━━
*Propuesta de Anticipo:*
━━━━━━━━━━━━━━━━━━━

✅ Porcentaje aprobado: *${data.advancePercentage}%*
💵 Monto del anticipo: *${data.advanceAmount}*
📅 Comisión: *${data.feeAmount}* (${data.feePercentage}%)
💳 Recibirás: *${data.netAmount}*
📆 Fecha límite de pago: *${data.dueDate}*

¿Deseas confirmar este anticipo?`,
        en: (data) => `
💰 *Advance Calculation*

📦 *Order:* ${data.orderNumber}
💵 *Order value:* ${data.orderAmount}
📊 *Your credit score:* ${data.creditScore}/100

━━━━━━━━━━━━━━━━━━━
*Advance Proposal:*
━━━━━━━━━━━━━━━━━━━

✅ Approved percentage: *${data.advancePercentage}%*
💵 Advance amount: *${data.advanceAmount}*
📅 Fee: *${data.feeAmount}* (${data.feePercentage}%)
💳 You'll receive: *${data.netAmount}*
📆 Payment due date: *${data.dueDate}*

Do you want to confirm this advance?`,
    },
    advanceConfirmed: {
        es: (contractNumber, amount) => `
✅ *¡Anticipo Confirmado!*

Tu solicitud ha sido procesada exitosamente.

📄 *Contrato:* ${contractNumber}
💰 *Monto:* ${amount}

El dinero será depositado en tu cuenta en las próximas *24-48 horas*.

Recibirás una notificación cuando se realice el depósito. 🎉`,
        en: (contractNumber, amount) => `
✅ *Advance Confirmed!*

Your request has been processed successfully.

📄 *Contract:* ${contractNumber}
💰 *Amount:* ${amount}

The money will be deposited to your account within *24-48 hours*.

You'll receive a notification when the deposit is made. 🎉`,
    },
    advanceRejected: {
        es: (reason) => `
❌ *Solicitud No Aprobada*

Lamentamos informarte que tu solicitud de anticipo no fue aprobada.

📝 *Motivo:* ${reason}

Si tienes dudas, contacta a nuestro equipo de soporte.`,
        en: (reason) => `
❌ *Request Not Approved*

We regret to inform you that your advance request was not approved.

📝 *Reason:* ${reason}

If you have questions, contact our support team.`,
    },
    balanceSummary: {
        es: (data) => `
📊 *Resumen de tu Cuenta*

💰 *Anticipos Activos:* ${data.activeAdvances}
💵 *Saldo Pendiente:* ${data.totalPending}
📅 *Próximo Pago:* ${data.nextPaymentDate}
💳 *Monto Próximo Pago:* ${data.nextPaymentAmount}

━━━━━━━━━━━━━━━━━━━
${data.advances.map((a, i) => `${i + 1}. ${a.contractNumber} - ${a.remaining} (vence: ${a.dueDate})`).join('\n')}`,
        en: (data) => `
📊 *Your Account Summary*

💰 *Active Advances:* ${data.activeAdvances}
💵 *Pending Balance:* ${data.totalPending}
📅 *Next Payment:* ${data.nextPaymentDate}
💳 *Next Payment Amount:* ${data.nextPaymentAmount}

━━━━━━━━━━━━━━━━━━━
${data.advances.map((a, i) => `${i + 1}. ${a.contractNumber} - ${a.remaining} (due: ${a.dueDate})`).join('\n')}`,
    },
    noActiveAdvances: {
        es: '✨ No tienes anticipos activos en este momento.\n\n¡Tu historial está limpio! 👍',
        en: '✨ You don\'t have any active advances at this moment.\n\nYour history is clean! 👍',
    },
    paymentOptions: {
        es: `
💳 *Métodos de Pago*

Elige cómo deseas realizar tu pago:`,
        en: `
💳 *Payment Methods*

Choose how you want to make your payment:`,
    },
    paymentLink: {
        es: (amount, link) => `
💳 *Liga de Pago*

💵 *Monto a pagar:* ${amount}

Haz clic en el siguiente enlace para pagar de forma segura:
${link}

⚠️ Este enlace expira en 24 horas.`,
        en: (amount, link) => `
💳 *Payment Link*

💵 *Amount to pay:* ${amount}

Click the following link to pay securely:
${link}

⚠️ This link expires in 24 hours.`,
    },
    paymentReceived: {
        es: (amount, remaining) => `
✅ *Pago Recibido*

Hemos registrado tu pago de *${amount}*.

💰 *Saldo restante:* ${remaining}

¡Gracias por tu pago puntual! 🙏`,
        en: (amount, remaining) => `
✅ *Payment Received*

We've recorded your payment of *${amount}*.

💰 *Remaining balance:* ${remaining}

Thank you for your prompt payment! 🙏`,
    },
    reminderFriendly: {
        es: (name, amount, dueDate, daysLeft) => `
👋 ¡Hola ${name}!

Este es un recordatorio amigable de que tu próximo pago está cerca:

💰 *Monto:* ${amount}
📅 *Fecha límite:* ${dueDate}
⏰ *Faltan:* ${daysLeft} días

¿Necesitas ayuda con tu pago? Escribe "PAGAR" para ver opciones.`,
        en: (name, amount, dueDate, daysLeft) => `
👋 Hi ${name}!

This is a friendly reminder that your next payment is coming up:

💰 *Amount:* ${amount}
📅 *Due date:* ${dueDate}
⏰ *Days left:* ${daysLeft}

Need help with your payment? Type "PAY" to see options.`,
    },
    reminderDueToday: {
        es: (name, amount) => `
⚠️ *Pago Vence Hoy*

Hola ${name}, tu pago de *${amount}* vence *hoy*.

Para evitar cargos por mora, realiza tu pago antes de las 11:59 PM.

📲 Escribe "PAGAR" para generar tu liga de pago.`,
        en: (name, amount) => `
⚠️ *Payment Due Today*

Hi ${name}, your payment of *${amount}* is due *today*.

To avoid late fees, make your payment before 11:59 PM.

📲 Type "PAY" to generate your payment link.`,
    },
    reminderOverdue: {
        es: (name, amount, daysOverdue, lateFee) => `
🚨 *Pago Vencido*

Hola ${name}, tu pago está *${daysOverdue} días vencido*.

💰 *Monto original:* ${amount}
📈 *Cargo por mora:* ${lateFee}
💵 *Total a pagar:* calculando...

Para evitar más cargos y proteger tu historial crediticio, realiza tu pago lo antes posible.

📲 Escribe "PAGAR" o llámanos al soporte.`,
        en: (name, amount, daysOverdue, lateFee) => `
🚨 *Overdue Payment*

Hi ${name}, your payment is *${daysOverdue} days overdue*.

💰 *Original amount:* ${amount}
📈 *Late fee:* ${lateFee}
💵 *Total to pay:* calculating...

To avoid additional charges and protect your credit history, make your payment as soon as possible.

📲 Type "PAY" or call our support line.`,
    },
    supportMessage: {
        es: `
📞 *Soporte al Cliente*

Nuestro equipo está aquí para ayudarte:

📱 *WhatsApp:* +52 443 XXX XXXX
📧 *Email:* soporte@agrobridge.io
🕐 *Horario:* Lun-Vie 9:00 AM - 6:00 PM

Describe tu problema y un agente te contactará pronto.`,
        en: `
📞 *Customer Support*

Our team is here to help:

📱 *WhatsApp:* +52 443 XXX XXXX
📧 *Email:* support@agrobridge.io
🕐 *Hours:* Mon-Fri 9:00 AM - 6:00 PM

Describe your issue and an agent will contact you soon.`,
    },
    userNotFound: {
        es: '❌ No encontramos una cuenta asociada a este número.\n\nPor favor, regístrate en nuestra app o contacta a soporte.',
        en: '❌ We couldn\'t find an account associated with this number.\n\nPlease register in our app or contact support.',
    },
    genericError: {
        es: '😔 Lo sentimos, algo salió mal.\n\nPor favor intenta de nuevo o contacta a soporte si el problema persiste.',
        en: '😔 Sorry, something went wrong.\n\nPlease try again or contact support if the problem persists.',
    },
    notUnderstood: {
        es: '🤔 No entendí tu mensaje.\n\nEscribe "MENU" para ver las opciones disponibles o "AYUDA" para hablar con un agente.',
        en: '🤔 I didn\'t understand your message.\n\nType "MENU" to see available options or "HELP" to speak with an agent.',
    },
    goodbye: {
        es: '¡Hasta pronto! 👋\n\nSi necesitas algo más, escríbeme. Estoy aquí para ayudarte.',
        en: 'See you soon! 👋\n\nIf you need anything else, message me. I\'m here to help.',
    },
    thanks: {
        es: '¡De nada! 😊 ¿Hay algo más en lo que pueda ayudarte?',
        en: 'You\'re welcome! 😊 Is there anything else I can help you with?',
    },
};
export const menuOptions = {
    main: [
        { id: 'request_advance', title: 'Solicitar Anticipo', emoji: '💰', description: 'Solicita un anticipo sobre tu cosecha' },
        { id: 'check_balance', title: 'Ver Saldo', emoji: '📊', description: 'Consulta tu saldo y pagos pendientes' },
        { id: 'make_payment', title: 'Realizar Pago', emoji: '💳', description: 'Genera una liga de pago' },
        { id: 'support', title: 'Soporte', emoji: '📞', description: 'Habla con un agente' },
    ],
    mainEn: [
        { id: 'request_advance', title: 'Request Advance', emoji: '💰', description: 'Request an advance on your harvest' },
        { id: 'check_balance', title: 'Check Balance', emoji: '📊', description: 'Check your balance and pending payments' },
        { id: 'make_payment', title: 'Make Payment', emoji: '💳', description: 'Generate a payment link' },
        { id: 'support', title: 'Support', emoji: '📞', description: 'Talk to an agent' },
    ],
    confirmation: [
        { id: 'confirm_yes', title: 'Sí, confirmar', emoji: '✅' },
        { id: 'confirm_no', title: 'No, cancelar', emoji: '❌' },
    ],
    confirmationEn: [
        { id: 'confirm_yes', title: 'Yes, confirm', emoji: '✅' },
        { id: 'confirm_no', title: 'No, cancel', emoji: '❌' },
    ],
    paymentMethods: [
        { id: 'pay_spei', title: 'SPEI', emoji: '🏦', description: 'Transferencia bancaria' },
        { id: 'pay_card', title: 'Tarjeta', emoji: '💳', description: 'Pago con tarjeta' },
        { id: 'pay_oxxo', title: 'OXXO', emoji: '🏪', description: 'Pago en efectivo' },
    ],
};
export function getMessage(key, lang, ...args) {
    const template = messages[key]?.[lang];
    if (!template) {
        return messages.genericError[lang];
    }
    if (typeof template === 'function') {
        return template(...args);
    }
    return template;
}
export function getMenuOptions(menuKey, lang) {
    const key = lang === 'en' ? `${menuKey}En` : menuKey;
    return menuOptions[key] || menuOptions[menuKey] || [];
}
