import { PrismaClient } from '@prisma/client';
import { logger } from '../../../infrastructure/logging/logger.js';
import { whatsAppService } from '../whatsapp.service.js';
import { sessionManager } from './session.manager.js';
import { getMessage, getMenuOptions } from '../templates/messages.js';
const prisma = new PrismaClient();
export class MessageHandler {
    async handleIncoming(message, contact) {
        const phoneNumber = message.from;
        const userName = contact?.profile?.name || 'Usuario';
        try {
            const session = await sessionManager.getSession(phoneNumber);
            sessionManager.incrementMessageCount(phoneNumber);
            await whatsAppService.markAsRead(message.id);
            if (message.type === 'text' && message.text) {
                await this.handleTextMessage(phoneNumber, message.text.body, userName, session.state);
            }
            else if (message.type === 'interactive' && message.interactive) {
                await this.handleInteractiveReply(phoneNumber, message.interactive, userName);
            }
            else if (message.type === 'button' && message.button) {
                await this.handleButtonReply(phoneNumber, message.button.payload, userName);
            }
            else {
                await this.sendNotUnderstood(phoneNumber);
            }
        }
        catch (error) {
            logger.error('[MessageHandler] Error processing message:', error);
            await this.sendError(phoneNumber);
        }
    }
    async handleTextMessage(phone, text, userName, currentState) {
        const session = await sessionManager.getSession(phone);
        const lang = session.language;
        const intent = sessionManager.classifyIntent(text);
        logger.info('[MessageHandler] Text message', {
            phone: phone.slice(-4),
            intent,
            state: currentState,
        });
        switch (intent) {
            case 'GREETING':
                await this.sendWelcome(phone, userName, lang);
                break;
            case 'THANKS':
                await whatsAppService.sendText(phone, getMessage('thanks', lang));
                break;
            case 'REQUEST_ADVANCE':
                await this.handleAdvanceRequest(phone, userName);
                break;
            case 'CHECK_BALANCE':
                await this.handleBalanceCheck(phone);
                break;
            case 'MAKE_PAYMENT':
                await this.handlePaymentRequest(phone);
                break;
            case 'CUSTOMER_SUPPORT':
                await whatsAppService.sendText(phone, getMessage('supportMessage', lang));
                sessionManager.updateState(phone, 'CUSTOMER_SUPPORT');
                break;
            case 'UNKNOWN':
            default:
                if (/^(menu|menú|inicio|start)$/i.test(text.trim())) {
                    await this.sendMainMenu(phone, lang);
                }
                else if (/^(bye|adios|adiós|salir|exit|chao)$/i.test(text.trim())) {
                    await whatsAppService.sendText(phone, getMessage('goodbye', lang));
                    sessionManager.updateState(phone, 'IDLE');
                }
                else {
                    await this.sendNotUnderstood(phone);
                }
                break;
        }
    }
    async handleInteractiveReply(phone, interactive, userName) {
        const session = await sessionManager.getSession(phone);
        const lang = session.language;
        const replyId = interactive?.button_reply?.id ||
            interactive?.list_reply?.id ||
            '';
        logger.info('[MessageHandler] Interactive reply', {
            phone: phone.slice(-4),
            replyId,
            state: session.state,
        });
        switch (replyId) {
            case 'request_advance':
                await this.handleAdvanceRequest(phone, userName);
                break;
            case 'check_balance':
                await this.handleBalanceCheck(phone);
                break;
            case 'make_payment':
                await this.handlePaymentRequest(phone);
                break;
            case 'support':
                await whatsAppService.sendText(phone, getMessage('supportMessage', lang));
                break;
            case 'confirm_yes':
                await this.handleConfirmation(phone, true);
                break;
            case 'confirm_no':
                await this.handleConfirmation(phone, false);
                break;
            case 'pay_spei':
            case 'pay_card':
            case 'pay_oxxo':
                await this.handlePaymentMethod(phone, replyId);
                break;
            default:
                if (replyId.startsWith('order_')) {
                    const orderId = replyId.replace('order_', '');
                    await this.handleOrderSelection(phone, orderId);
                }
                else {
                    await this.sendNotUnderstood(phone);
                }
                break;
        }
    }
    async handleButtonReply(phone, payload, userName) {
        await this.handleInteractiveReply(phone, {
            type: 'button_reply',
            button_reply: { id: payload, title: '' },
        }, userName);
    }
    async sendWelcome(phone, userName, lang) {
        const session = await sessionManager.getSession(phone);
        if (!session.userId) {
            await whatsAppService.sendText(phone, getMessage('userNotFound', lang));
            return;
        }
        await whatsAppService.sendText(phone, getMessage('welcome', lang, userName));
        await this.sendMainMenu(phone, lang);
        sessionManager.updateState(phone, 'MAIN_MENU');
    }
    async sendMainMenu(phone, lang) {
        const options = getMenuOptions('main', lang);
        await whatsAppService.sendListMenu(phone, getMessage('mainMenu', lang), lang === 'es' ? 'Ver opciones' : 'View options', [{ title: lang === 'es' ? 'Opciones' : 'Options', items: options }]);
        sessionManager.updateState(phone, 'MAIN_MENU');
    }
    async handleAdvanceRequest(phone, userName) {
        const session = await sessionManager.getSession(phone);
        const lang = session.language;
        if (!session.producerId) {
            await whatsAppService.sendText(phone, getMessage('userNotFound', lang));
            return;
        }
        sessionManager.updateState(phone, 'REQUESTING_ADVANCE');
        const eligibleOrders = await prisma.order.findMany({
            where: {
                producerId: session.producerId,
                advanceEligible: true,
                advanceRequested: false,
                status: 'CONFIRMED',
            },
            orderBy: { totalAmount: 'desc' },
            take: 5,
        });
        if (eligibleOrders.length === 0) {
            await whatsAppService.sendText(phone, getMessage('noEligibleOrders', lang));
            await this.sendMainMenu(phone, lang);
            return;
        }
        const orderOptions = eligibleOrders.map((order) => ({
            id: `order_${order.id}`,
            title: order.orderNumber,
            description: `$${order.totalAmount.toNumber().toLocaleString()} MXN`,
            emoji: '📦',
        }));
        await whatsAppService.sendListMenu(phone, getMessage('selectOrder', lang), lang === 'es' ? 'Ver órdenes' : 'View orders', [{ title: lang === 'es' ? 'Órdenes Elegibles' : 'Eligible Orders', items: orderOptions }]);
        sessionManager.updateState(phone, 'SELECTING_ORDER');
    }
    async handleOrderSelection(phone, orderId) {
        const session = await sessionManager.getSession(phone);
        const lang = session.language;
        sessionManager.updateContext(phone, { selectedOrderId: orderId });
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { producer: true },
        });
        if (!order) {
            await whatsAppService.sendText(phone, getMessage('genericError', lang));
            return;
        }
        const creditScore = await prisma.creditScore.findFirst({
            where: { producerId: order.producerId },
        });
        const score = creditScore?.overallScore.toNumber() || 70;
        const advancePercentage = score >= 90 ? 85 : score >= 70 ? 80 : 75;
        const feePercentage = score >= 90 ? 2.0 : score >= 70 ? 2.5 : 3.0;
        const orderAmount = order.totalAmount.toNumber();
        const advanceAmount = orderAmount * (advancePercentage / 100);
        const feeAmount = advanceAmount * (feePercentage / 100);
        const netAmount = advanceAmount - feeAmount;
        const dueDate = new Date(order.expectedDeliveryDate);
        dueDate.setDate(dueDate.getDate() + 7);
        const data = {
            orderNumber: order.orderNumber,
            orderAmount: `$${orderAmount.toLocaleString()} MXN`,
            creditScore: Math.round(score),
            advancePercentage,
            advanceAmount: `$${advanceAmount.toLocaleString()} MXN`,
            feePercentage,
            feeAmount: `$${feeAmount.toLocaleString()} MXN`,
            netAmount: `$${netAmount.toLocaleString()} MXN`,
            dueDate: dueDate.toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US'),
        };
        sessionManager.updateContext(phone, {
            pendingAmount: netAmount,
            awaitingConfirmation: true,
        });
        await whatsAppService.sendText(phone, getMessage('advanceCalculation', lang, data));
        await whatsAppService.sendButtons(phone, lang === 'es' ? '¿Deseas confirmar este anticipo?' : 'Do you want to confirm this advance?', [
            { id: 'confirm_yes', title: lang === 'es' ? '✅ Sí, confirmar' : '✅ Yes, confirm' },
            { id: 'confirm_no', title: lang === 'es' ? '❌ No, cancelar' : '❌ No, cancel' },
        ]);
        sessionManager.updateState(phone, 'CONFIRMING_ADVANCE');
    }
    async handleConfirmation(phone, confirmed) {
        const session = await sessionManager.getSession(phone);
        const lang = session.language;
        if (session.state !== 'CONFIRMING_ADVANCE' || !session.context.selectedOrderId) {
            await this.sendMainMenu(phone, lang);
            return;
        }
        if (!confirmed) {
            await whatsAppService.sendText(phone, lang === 'es' ? '❌ Solicitud cancelada.' : '❌ Request cancelled.');
            await this.sendMainMenu(phone, lang);
            return;
        }
        try {
            const order = await prisma.order.findUnique({
                where: { id: session.context.selectedOrderId },
            });
            if (!order) {
                throw new Error('Order not found');
            }
            const count = await prisma.advanceContract.count();
            const contractNumber = `ACF-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
            const pool = await prisma.liquidityPool.findFirst({
                where: { status: 'ACTIVE' },
            });
            if (!pool) {
                throw new Error('No active liquidity pool');
            }
            const orderAmount = order.totalAmount.toNumber();
            const advancePercentage = 80;
            const advanceAmount = orderAmount * 0.8;
            const feePercentage = 2.5;
            const feeAmount = advanceAmount * 0.025;
            const dueDate = new Date(order.expectedDeliveryDate);
            dueDate.setDate(dueDate.getDate() + 7);
            const contract = await prisma.advanceContract.create({
                data: {
                    contractNumber,
                    orderId: order.id,
                    farmerId: order.producerId,
                    buyerId: order.buyerId,
                    poolId: pool.id,
                    currency: 'MXN',
                    orderAmount,
                    advancePercentage,
                    advanceAmount,
                    farmerFeePercentage: feePercentage,
                    farmerFeeAmount: feeAmount,
                    buyerFeePercentage: 1.0,
                    buyerFeeAmount: advanceAmount * 0.01,
                    implicitInterest: advanceAmount * 0.02,
                    platformFeeTotal: feeAmount + advanceAmount * 0.01,
                    costOfCapital: advanceAmount * 0.02,
                    operatingCosts: 100,
                    riskProvision: advanceAmount * 0.02,
                    totalRevenue: feeAmount + advanceAmount * 0.01,
                    grossProfit: feeAmount - 100,
                    profitMargin: 50,
                    expectedDeliveryDate: order.expectedDeliveryDate,
                    dueDate,
                    status: 'PENDING_APPROVAL',
                    riskTier: 'B',
                    creditScoreValue: 75,
                    riskAssessmentScore: 75,
                    remainingBalance: advanceAmount,
                },
            });
            await prisma.order.update({
                where: { id: order.id },
                data: {
                    advanceRequested: true,
                    advanceRequestedAt: new Date(),
                },
            });
            await whatsAppService.sendText(phone, getMessage('advanceConfirmed', lang, contractNumber, `$${advanceAmount.toLocaleString()} MXN`));
            logger.info('[MessageHandler] Advance created via WhatsApp', {
                contractNumber,
                phone: phone.slice(-4),
            });
        }
        catch (error) {
            logger.error('[MessageHandler] Failed to create advance:', error);
            await whatsAppService.sendText(phone, getMessage('genericError', lang));
        }
        sessionManager.updateContext(phone, {});
        sessionManager.updateState(phone, 'IDLE');
    }
    async handleBalanceCheck(phone) {
        const session = await sessionManager.getSession(phone);
        const lang = session.language;
        if (!session.producerId) {
            await whatsAppService.sendText(phone, getMessage('userNotFound', lang));
            return;
        }
        sessionManager.updateState(phone, 'CHECKING_BALANCE');
        const advances = await prisma.advanceContract.findMany({
            where: {
                farmerId: session.producerId,
                status: {
                    in: ['DISBURSED', 'ACTIVE', 'PARTIALLY_REPAID', 'OVERDUE'],
                },
            },
            orderBy: { dueDate: 'asc' },
        });
        if (advances.length === 0) {
            await whatsAppService.sendText(phone, getMessage('noActiveAdvances', lang));
            await this.sendMainMenu(phone, lang);
            return;
        }
        const totalPending = advances.reduce((sum, a) => sum + a.remainingBalance.toNumber(), 0);
        const nextAdvance = advances[0];
        const data = {
            activeAdvances: advances.length,
            totalPending: `$${totalPending.toLocaleString()} MXN`,
            nextPaymentDate: nextAdvance.dueDate.toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US'),
            nextPaymentAmount: `$${nextAdvance.remainingBalance.toNumber().toLocaleString()} MXN`,
            advances: advances.slice(0, 5).map((a) => ({
                contractNumber: a.contractNumber,
                remaining: `$${a.remainingBalance.toNumber().toLocaleString()}`,
                dueDate: a.dueDate.toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US'),
            })),
        };
        await whatsAppService.sendText(phone, getMessage('balanceSummary', lang, data));
        await this.sendMainMenu(phone, lang);
    }
    async handlePaymentRequest(phone) {
        const session = await sessionManager.getSession(phone);
        const lang = session.language;
        if (!session.producerId) {
            await whatsAppService.sendText(phone, getMessage('userNotFound', lang));
            return;
        }
        sessionManager.updateState(phone, 'MAKING_PAYMENT');
        const nextAdvance = await prisma.advanceContract.findFirst({
            where: {
                farmerId: session.producerId,
                status: { in: ['DISBURSED', 'ACTIVE', 'PARTIALLY_REPAID', 'OVERDUE'] },
            },
            orderBy: { dueDate: 'asc' },
        });
        if (!nextAdvance) {
            await whatsAppService.sendText(phone, getMessage('noActiveAdvances', lang));
            await this.sendMainMenu(phone, lang);
            return;
        }
        sessionManager.updateContext(phone, { selectedAdvanceId: nextAdvance.id });
        await whatsAppService.sendText(phone, getMessage('paymentOptions', lang));
        await whatsAppService.sendButtons(phone, `${lang === 'es' ? 'Monto a pagar' : 'Amount to pay'}: $${nextAdvance.remainingBalance.toNumber().toLocaleString()} MXN`, [
            { id: 'pay_spei', title: '🏦 SPEI' },
            { id: 'pay_card', title: '💳 Tarjeta' },
            { id: 'pay_oxxo', title: '🏪 OXXO' },
        ]);
    }
    async handlePaymentMethod(phone, method) {
        const session = await sessionManager.getSession(phone);
        const lang = session.language;
        if (!session.context.selectedAdvanceId) {
            await this.sendMainMenu(phone, lang);
            return;
        }
        const advance = await prisma.advanceContract.findUnique({
            where: { id: session.context.selectedAdvanceId },
        });
        if (!advance) {
            await whatsAppService.sendText(phone, getMessage('genericError', lang));
            return;
        }
        const amount = `$${advance.remainingBalance.toNumber().toLocaleString()} MXN`;
        const paymentLink = `https://pay.agrobridge.io/${advance.id}?method=${method.replace('pay_', '')}`;
        await whatsAppService.sendText(phone, getMessage('paymentLink', lang, amount, paymentLink));
        sessionManager.updateContext(phone, {});
        sessionManager.updateState(phone, 'IDLE');
    }
    async sendNotUnderstood(phone) {
        const session = await sessionManager.getSession(phone);
        await whatsAppService.sendText(phone, getMessage('notUnderstood', session.language));
    }
    async sendError(phone) {
        const session = await sessionManager.getSession(phone);
        await whatsAppService.sendText(phone, getMessage('genericError', session.language));
    }
}
export const messageHandler = new MessageHandler();
