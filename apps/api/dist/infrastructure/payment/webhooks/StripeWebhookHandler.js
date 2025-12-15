import { SubscriptionTier, SubscriptionStatus } from '@prisma/client';
import { stripeProvider, StripeProviderError } from '../providers/StripeProvider.js';
import { TIER_CONFIGS } from '../PaymentService.js';
import logger from '../../../shared/utils/logger.js';
export class WebhookHandlerError extends Error {
    code;
    statusCode;
    constructor(message, code, statusCode = 400) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.name = 'WebhookHandlerError';
    }
}
export class StripeWebhookHandler {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async handleWebhook(payload, signature) {
        let event;
        try {
            event = stripeProvider.constructWebhookEvent(payload, signature);
        }
        catch (error) {
            if (error instanceof StripeProviderError) {
                throw new WebhookHandlerError(error.message, error.code, error.statusCode);
            }
            throw error;
        }
        logger.info('[StripeWebhook] Received event', {
            type: event.type,
            id: event.id,
        });
        try {
            switch (event.type) {
                case 'customer.subscription.created':
                    return await this.handleSubscriptionCreated(event);
                case 'customer.subscription.updated':
                    return await this.handleSubscriptionUpdated(event);
                case 'customer.subscription.deleted':
                    return await this.handleSubscriptionDeleted(event);
                case 'invoice.payment_succeeded':
                    return await this.handleInvoicePaymentSucceeded(event);
                case 'invoice.payment_failed':
                    return await this.handleInvoicePaymentFailed(event);
                case 'invoice.finalized':
                    return await this.handleInvoiceFinalized(event);
                case 'payment_intent.succeeded':
                    return await this.handlePaymentIntentSucceeded(event);
                case 'payment_intent.payment_failed':
                    return await this.handlePaymentIntentFailed(event);
                case 'customer.updated':
                    return await this.handleCustomerUpdated(event);
                case 'customer.deleted':
                    return await this.handleCustomerDeleted(event);
                case 'checkout.session.completed':
                    return await this.handleCheckoutSessionCompleted(event);
                default:
                    logger.debug('[StripeWebhook] Unhandled event type', { type: event.type });
                    return {
                        success: true,
                        eventType: event.type,
                        message: 'Event received but not processed',
                    };
            }
        }
        catch (error) {
            logger.error('[StripeWebhook] Error processing event', {
                type: event.type,
                id: event.id,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    async handleSubscriptionCreated(event) {
        const subscription = event.data.object;
        const customerId = typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id;
        const dbSubscription = await this.prisma.subscription.findUnique({
            where: { stripeCustomerId: customerId },
        });
        if (!dbSubscription) {
            logger.warn('[StripeWebhook] Subscription created for unknown customer', {
                customerId,
                subscriptionId: subscription.id,
            });
            return {
                success: true,
                eventType: event.type,
                message: 'Customer not found in database',
            };
        }
        const tier = this.getTierFromSubscription(subscription);
        const tierConfig = TIER_CONFIGS[tier];
        await this.prisma.subscription.update({
            where: { stripeCustomerId: customerId },
            data: {
                stripeSubscriptionId: subscription.id,
                stripePriceId: subscription.items.data[0]?.price?.id,
                tier,
                status: this.mapStripeStatus(subscription.status),
                currentPeriodStart: new Date((subscription.items.data[0]?.current_period_start ?? Math.floor(Date.now() / 1000)) * 1000),
                currentPeriodEnd: new Date((subscription.items.data[0]?.current_period_end ?? Math.floor(Date.now() / 1000)) * 1000),
                cancelAtPeriodEnd: subscription.cancel_at_period_end,
                trialEnd: subscription.trial_end
                    ? new Date(subscription.trial_end * 1000)
                    : null,
                batchesLimit: tierConfig.batchesLimit,
                apiCallsLimit: tierConfig.apiCallsLimit,
                storageLimitMb: tierConfig.storageLimitMb,
            },
        });
        logger.info('[StripeWebhook] Subscription created in database', {
            customerId,
            subscriptionId: subscription.id,
            tier,
        });
        return {
            success: true,
            eventType: event.type,
            message: 'Subscription created',
            data: { subscriptionId: subscription.id, tier },
        };
    }
    async handleSubscriptionUpdated(event) {
        const subscription = event.data.object;
        const customerId = typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id;
        const dbSubscription = await this.prisma.subscription.findUnique({
            where: { stripeCustomerId: customerId },
        });
        if (!dbSubscription) {
            logger.warn('[StripeWebhook] Subscription updated for unknown customer', {
                customerId,
                subscriptionId: subscription.id,
            });
            return {
                success: true,
                eventType: event.type,
                message: 'Customer not found in database',
            };
        }
        const tier = this.getTierFromSubscription(subscription);
        const tierConfig = TIER_CONFIGS[tier];
        await this.prisma.subscription.update({
            where: { stripeCustomerId: customerId },
            data: {
                stripePriceId: subscription.items.data[0]?.price?.id,
                tier,
                status: this.mapStripeStatus(subscription.status),
                currentPeriodStart: new Date((subscription.items.data[0]?.current_period_start ?? Math.floor(Date.now() / 1000)) * 1000),
                currentPeriodEnd: new Date((subscription.items.data[0]?.current_period_end ?? Math.floor(Date.now() / 1000)) * 1000),
                cancelAtPeriodEnd: subscription.cancel_at_period_end,
                canceledAt: subscription.canceled_at
                    ? new Date(subscription.canceled_at * 1000)
                    : null,
                trialEnd: subscription.trial_end
                    ? new Date(subscription.trial_end * 1000)
                    : null,
                batchesLimit: tierConfig.batchesLimit,
                apiCallsLimit: tierConfig.apiCallsLimit,
                storageLimitMb: tierConfig.storageLimitMb,
            },
        });
        logger.info('[StripeWebhook] Subscription updated', {
            customerId,
            subscriptionId: subscription.id,
            status: subscription.status,
            tier,
        });
        return {
            success: true,
            eventType: event.type,
            message: 'Subscription updated',
            data: { subscriptionId: subscription.id, status: subscription.status, tier },
        };
    }
    async handleSubscriptionDeleted(event) {
        const subscription = event.data.object;
        const customerId = typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id;
        const dbSubscription = await this.prisma.subscription.findUnique({
            where: { stripeCustomerId: customerId },
        });
        if (!dbSubscription) {
            logger.warn('[StripeWebhook] Subscription deleted for unknown customer', {
                customerId,
                subscriptionId: subscription.id,
            });
            return {
                success: true,
                eventType: event.type,
                message: 'Customer not found in database',
            };
        }
        const freeTier = TIER_CONFIGS.FREE;
        await this.prisma.subscription.update({
            where: { stripeCustomerId: customerId },
            data: {
                stripeSubscriptionId: null,
                stripePriceId: null,
                tier: SubscriptionTier.FREE,
                status: SubscriptionStatus.CANCELED,
                cancelAtPeriodEnd: false,
                canceledAt: new Date(),
                batchesLimit: freeTier.batchesLimit,
                apiCallsLimit: freeTier.apiCallsLimit,
                storageLimitMb: freeTier.storageLimitMb,
            },
        });
        logger.info('[StripeWebhook] Subscription deleted, reverted to FREE', {
            customerId,
            subscriptionId: subscription.id,
        });
        return {
            success: true,
            eventType: event.type,
            message: 'Subscription deleted, reverted to FREE tier',
            data: { subscriptionId: subscription.id },
        };
    }
    async handleInvoicePaymentSucceeded(event) {
        const invoice = event.data.object;
        const customerId = typeof invoice.customer === 'string'
            ? invoice.customer
            : invoice.customer?.id;
        if (!customerId) {
            logger.warn('[StripeWebhook] Invoice without customer', { invoiceId: invoice.id });
            return {
                success: true,
                eventType: event.type,
                message: 'Invoice has no customer',
            };
        }
        const dbSubscription = await this.prisma.subscription.findUnique({
            where: { stripeCustomerId: customerId },
        });
        if (!dbSubscription) {
            logger.warn('[StripeWebhook] Invoice payment for unknown customer', {
                customerId,
                invoiceId: invoice.id,
            });
            return {
                success: true,
                eventType: event.type,
                message: 'Customer not found in database',
            };
        }
        const invoiceWithPaymentIntent = invoice;
        const paymentIntentId = typeof invoiceWithPaymentIntent.payment_intent === 'string'
            ? invoiceWithPaymentIntent.payment_intent
            : invoiceWithPaymentIntent.payment_intent?.id;
        if (paymentIntentId) {
            await this.prisma.payment.upsert({
                where: { stripePaymentIntentId: paymentIntentId },
                create: {
                    subscriptionId: dbSubscription.id,
                    stripePaymentIntentId: paymentIntentId,
                    stripeInvoiceId: invoice.id,
                    amount: invoice.amount_paid,
                    currency: invoice.currency,
                    status: 'succeeded',
                    description: invoice.description || 'Subscription payment',
                    receiptUrl: invoice.hosted_invoice_url,
                    invoicePdf: invoice.invoice_pdf,
                },
                update: {
                    status: 'succeeded',
                    receiptUrl: invoice.hosted_invoice_url,
                    invoicePdf: invoice.invoice_pdf,
                },
            });
        }
        await this.prisma.subscription.update({
            where: { id: dbSubscription.id },
            data: {
                status: SubscriptionStatus.ACTIVE,
                batchesUsed: 0,
                apiCallsUsed: 0,
            },
        });
        logger.info('[StripeWebhook] Invoice payment succeeded', {
            customerId,
            invoiceId: invoice.id,
            amount: invoice.amount_paid,
        });
        return {
            success: true,
            eventType: event.type,
            message: 'Invoice payment recorded',
            data: { invoiceId: invoice.id, amount: invoice.amount_paid },
        };
    }
    async handleInvoicePaymentFailed(event) {
        const invoice = event.data.object;
        const customerId = typeof invoice.customer === 'string'
            ? invoice.customer
            : invoice.customer?.id;
        if (!customerId) {
            return {
                success: true,
                eventType: event.type,
                message: 'Invoice has no customer',
            };
        }
        const dbSubscription = await this.prisma.subscription.findUnique({
            where: { stripeCustomerId: customerId },
        });
        if (!dbSubscription) {
            return {
                success: true,
                eventType: event.type,
                message: 'Customer not found in database',
            };
        }
        const invoiceWithPaymentIntent = invoice;
        const paymentIntentId = typeof invoiceWithPaymentIntent.payment_intent === 'string'
            ? invoiceWithPaymentIntent.payment_intent
            : invoiceWithPaymentIntent.payment_intent?.id;
        if (paymentIntentId) {
            const failureMessage = invoice.last_finalization_error?.message;
            await this.prisma.payment.upsert({
                where: { stripePaymentIntentId: paymentIntentId },
                create: {
                    subscriptionId: dbSubscription.id,
                    stripePaymentIntentId: paymentIntentId,
                    stripeInvoiceId: invoice.id,
                    amount: invoice.amount_due,
                    currency: invoice.currency,
                    status: 'failed',
                    description: invoice.description || 'Subscription payment',
                    failureMessage,
                },
                update: {
                    status: 'failed',
                    failureMessage,
                },
            });
        }
        await this.prisma.subscription.update({
            where: { id: dbSubscription.id },
            data: {
                status: SubscriptionStatus.PAST_DUE,
            },
        });
        logger.warn('[StripeWebhook] Invoice payment failed', {
            customerId,
            invoiceId: invoice.id,
            amount: invoice.amount_due,
        });
        return {
            success: true,
            eventType: event.type,
            message: 'Payment failure recorded',
            data: { invoiceId: invoice.id, amount: invoice.amount_due },
        };
    }
    async handleInvoiceFinalized(event) {
        const invoice = event.data.object;
        logger.info('[StripeWebhook] Invoice finalized', {
            invoiceId: invoice.id,
            number: invoice.number,
            amount: invoice.amount_due,
        });
        return {
            success: true,
            eventType: event.type,
            message: 'Invoice finalized',
            data: { invoiceId: invoice.id, number: invoice.number },
        };
    }
    async handlePaymentIntentSucceeded(event) {
        const paymentIntent = event.data.object;
        const payment = await this.prisma.payment.findUnique({
            where: { stripePaymentIntentId: paymentIntent.id },
        });
        if (payment) {
            await this.prisma.payment.update({
                where: { id: payment.id },
                data: {
                    status: 'succeeded',
                    receiptUrl: paymentIntent.latest_charge
                        ? `https://dashboard.stripe.com/payments/${paymentIntent.latest_charge}`
                        : undefined,
                },
            });
        }
        logger.info('[StripeWebhook] Payment intent succeeded', {
            paymentIntentId: paymentIntent.id,
            amount: paymentIntent.amount,
        });
        return {
            success: true,
            eventType: event.type,
            message: 'Payment intent succeeded',
            data: { paymentIntentId: paymentIntent.id, amount: paymentIntent.amount },
        };
    }
    async handlePaymentIntentFailed(event) {
        const paymentIntent = event.data.object;
        const payment = await this.prisma.payment.findUnique({
            where: { stripePaymentIntentId: paymentIntent.id },
        });
        if (payment) {
            await this.prisma.payment.update({
                where: { id: payment.id },
                data: {
                    status: 'failed',
                    failureCode: paymentIntent.last_payment_error?.code,
                    failureMessage: paymentIntent.last_payment_error?.message,
                },
            });
        }
        logger.warn('[StripeWebhook] Payment intent failed', {
            paymentIntentId: paymentIntent.id,
            errorCode: paymentIntent.last_payment_error?.code,
        });
        return {
            success: true,
            eventType: event.type,
            message: 'Payment intent failed',
            data: {
                paymentIntentId: paymentIntent.id,
                errorCode: paymentIntent.last_payment_error?.code,
            },
        };
    }
    async handleCustomerUpdated(event) {
        const customer = event.data.object;
        logger.info('[StripeWebhook] Customer updated', {
            customerId: customer.id,
            email: customer.email,
        });
        return {
            success: true,
            eventType: event.type,
            message: 'Customer updated',
            data: { customerId: customer.id },
        };
    }
    async handleCustomerDeleted(event) {
        const customer = event.data.object;
        const dbSubscription = await this.prisma.subscription.findUnique({
            where: { stripeCustomerId: customer.id },
        });
        if (dbSubscription) {
            await this.prisma.subscription.update({
                where: { id: dbSubscription.id },
                data: {
                    status: SubscriptionStatus.CANCELED,
                    tier: SubscriptionTier.FREE,
                    stripeSubscriptionId: null,
                },
            });
        }
        logger.info('[StripeWebhook] Customer deleted', {
            customerId: customer.id,
        });
        return {
            success: true,
            eventType: event.type,
            message: 'Customer deleted',
            data: { customerId: customer.id },
        };
    }
    async handleCheckoutSessionCompleted(event) {
        const session = event.data.object;
        logger.info('[StripeWebhook] Checkout session completed', {
            sessionId: session.id,
            mode: session.mode,
            customerId: session.customer,
        });
        return {
            success: true,
            eventType: event.type,
            message: 'Checkout session completed',
            data: { sessionId: session.id, mode: session.mode },
        };
    }
    mapStripeStatus(status) {
        switch (status) {
            case 'active':
                return SubscriptionStatus.ACTIVE;
            case 'past_due':
                return SubscriptionStatus.PAST_DUE;
            case 'canceled':
                return SubscriptionStatus.CANCELED;
            case 'incomplete':
                return SubscriptionStatus.INCOMPLETE;
            case 'incomplete_expired':
                return SubscriptionStatus.INCOMPLETE_EXPIRED;
            case 'trialing':
                return SubscriptionStatus.TRIALING;
            case 'unpaid':
                return SubscriptionStatus.UNPAID;
            case 'paused':
                return SubscriptionStatus.PAUSED;
            default:
                return SubscriptionStatus.ACTIVE;
        }
    }
    getTierFromSubscription(subscription) {
        if (subscription.metadata?.tier) {
            const tier = subscription.metadata.tier.toUpperCase();
            if (Object.values(SubscriptionTier).includes(tier)) {
                return tier;
            }
        }
        const priceId = subscription.items.data[0]?.price?.id;
        if (priceId) {
            for (const [tier, config] of Object.entries(TIER_CONFIGS)) {
                if (config.stripePriceIdMonthly === priceId ||
                    config.stripePriceIdYearly === priceId) {
                    return tier;
                }
            }
        }
        return SubscriptionTier.FREE;
    }
}
export function createStripeWebhookHandler(prisma) {
    return new StripeWebhookHandler(prisma);
}
