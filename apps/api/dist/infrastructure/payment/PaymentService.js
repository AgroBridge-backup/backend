import { SubscriptionTier, SubscriptionStatus } from '@prisma/client';
import { stripeProvider } from './providers/StripeProvider.js';
import logger from '../../shared/utils/logger.js';
export const TIER_CONFIGS = {
    FREE: {
        tier: SubscriptionTier.FREE,
        name: 'Free',
        priceMonthly: 0,
        priceYearly: 0,
        batchesLimit: 10,
        apiCallsLimit: 100,
        storageLimitMb: 100,
    },
    BASIC: {
        tier: SubscriptionTier.BASIC,
        name: 'Basic',
        priceMonthly: 1900,
        priceYearly: 19000,
        batchesLimit: 100,
        apiCallsLimit: 1000,
        storageLimitMb: 1024,
        stripePriceIdMonthly: process.env.STRIPE_BASIC_MONTHLY_PRICE_ID,
        stripePriceIdYearly: process.env.STRIPE_BASIC_YEARLY_PRICE_ID,
    },
    PREMIUM: {
        tier: SubscriptionTier.PREMIUM,
        name: 'Premium',
        priceMonthly: 4900,
        priceYearly: 49000,
        batchesLimit: 1000,
        apiCallsLimit: 10000,
        storageLimitMb: 10240,
        stripePriceIdMonthly: process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID,
        stripePriceIdYearly: process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID,
    },
    ENTERPRISE: {
        tier: SubscriptionTier.ENTERPRISE,
        name: 'Enterprise',
        priceMonthly: 50000,
        priceYearly: 500000,
        batchesLimit: -1,
        apiCallsLimit: -1,
        storageLimitMb: -1,
        stripePriceIdMonthly: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID,
        stripePriceIdYearly: process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID,
    },
};
export class PaymentServiceError extends Error {
    code;
    statusCode;
    constructor(message, code, statusCode = 400) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.name = 'PaymentServiceError';
    }
}
export class PaymentService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    isAvailable() {
        return stripeProvider.isAvailable();
    }
    async getOrCreateCustomer(userId, email, name) {
        if (!this.isAvailable()) {
            throw new PaymentServiceError('Payment service not available', 'PAYMENTS_UNAVAILABLE', 503);
        }
        const existingSubscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });
        if (existingSubscription) {
            return existingSubscription.stripeCustomerId;
        }
        const customer = await stripeProvider.createCustomer({
            email,
            name,
            metadata: {
                userId,
                platform: 'agrobridge',
            },
        });
        const tierConfig = TIER_CONFIGS.FREE;
        await this.prisma.subscription.create({
            data: {
                userId,
                stripeCustomerId: customer.id,
                tier: SubscriptionTier.FREE,
                status: SubscriptionStatus.ACTIVE,
                batchesLimit: tierConfig.batchesLimit,
                apiCallsLimit: tierConfig.apiCallsLimit,
                storageLimitMb: tierConfig.storageLimitMb,
            },
        });
        logger.info('[PaymentService] Customer created', {
            userId,
            customerId: customer.id,
        });
        return customer.id;
    }
    async updateCustomer(userId, updates) {
        if (!this.isAvailable()) {
            throw new PaymentServiceError('Payment service not available', 'PAYMENTS_UNAVAILABLE', 503);
        }
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });
        if (!subscription) {
            throw new PaymentServiceError('No subscription found for user', 'SUBSCRIPTION_NOT_FOUND', 404);
        }
        await stripeProvider.updateCustomer(subscription.stripeCustomerId, updates);
        logger.info('[PaymentService] Customer updated', { userId });
    }
    async addPaymentMethod(userId, paymentMethodId, setAsDefault = true) {
        if (!this.isAvailable()) {
            throw new PaymentServiceError('Payment service not available', 'PAYMENTS_UNAVAILABLE', 503);
        }
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });
        if (!subscription) {
            throw new PaymentServiceError('No subscription found for user', 'SUBSCRIPTION_NOT_FOUND', 404);
        }
        const paymentMethod = await stripeProvider.attachPaymentMethod(paymentMethodId, subscription.stripeCustomerId);
        if (setAsDefault) {
            await stripeProvider.setDefaultPaymentMethod(subscription.stripeCustomerId, paymentMethodId);
        }
        logger.info('[PaymentService] Payment method added', {
            userId,
            paymentMethodId,
            setAsDefault,
        });
        return this.formatPaymentMethod(paymentMethod, setAsDefault);
    }
    async removePaymentMethod(userId, paymentMethodId) {
        if (!this.isAvailable()) {
            throw new PaymentServiceError('Payment service not available', 'PAYMENTS_UNAVAILABLE', 503);
        }
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });
        if (!subscription) {
            throw new PaymentServiceError('No subscription found for user', 'SUBSCRIPTION_NOT_FOUND', 404);
        }
        const paymentMethods = await stripeProvider.listPaymentMethods(subscription.stripeCustomerId);
        const belongs = paymentMethods.some((pm) => pm.id === paymentMethodId);
        if (!belongs) {
            throw new PaymentServiceError('Payment method not found for this user', 'PAYMENT_METHOD_NOT_FOUND', 404);
        }
        await stripeProvider.detachPaymentMethod(paymentMethodId);
        logger.info('[PaymentService] Payment method removed', {
            userId,
            paymentMethodId,
        });
    }
    async listPaymentMethods(userId) {
        if (!this.isAvailable()) {
            throw new PaymentServiceError('Payment service not available', 'PAYMENTS_UNAVAILABLE', 503);
        }
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });
        if (!subscription) {
            throw new PaymentServiceError('No subscription found for user', 'SUBSCRIPTION_NOT_FOUND', 404);
        }
        const [paymentMethods, customer] = await Promise.all([
            stripeProvider.listPaymentMethods(subscription.stripeCustomerId),
            stripeProvider.getCustomer(subscription.stripeCustomerId),
        ]);
        const defaultId = typeof customer.invoice_settings?.default_payment_method === 'string'
            ? customer.invoice_settings.default_payment_method
            : customer.invoice_settings?.default_payment_method?.id;
        return paymentMethods.map((pm) => this.formatPaymentMethod(pm, pm.id === defaultId));
    }
    async setDefaultPaymentMethod(userId, paymentMethodId) {
        if (!this.isAvailable()) {
            throw new PaymentServiceError('Payment service not available', 'PAYMENTS_UNAVAILABLE', 503);
        }
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });
        if (!subscription) {
            throw new PaymentServiceError('No subscription found for user', 'SUBSCRIPTION_NOT_FOUND', 404);
        }
        await stripeProvider.setDefaultPaymentMethod(subscription.stripeCustomerId, paymentMethodId);
        logger.info('[PaymentService] Default payment method set', {
            userId,
            paymentMethodId,
        });
    }
    async getSubscription(userId) {
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });
        if (!subscription) {
            return null;
        }
        return {
            id: subscription.id,
            userId: subscription.userId,
            tier: subscription.tier,
            status: subscription.status,
            stripeCustomerId: subscription.stripeCustomerId,
            stripeSubscriptionId: subscription.stripeSubscriptionId,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            batchesUsed: subscription.batchesUsed,
            batchesLimit: subscription.batchesLimit,
            apiCallsUsed: subscription.apiCallsUsed,
            apiCallsLimit: subscription.apiCallsLimit,
            storageUsedMb: subscription.storageUsedMb,
            storageLimitMb: subscription.storageLimitMb,
        };
    }
    async createSubscription(input) {
        if (!this.isAvailable()) {
            throw new PaymentServiceError('Payment service not available', 'PAYMENTS_UNAVAILABLE', 503);
        }
        const { userId, email, name, tier, paymentMethodId, billingCycle, trialDays } = input;
        const tierConfig = TIER_CONFIGS[tier];
        const priceId = billingCycle === 'yearly'
            ? tierConfig.stripePriceIdYearly
            : tierConfig.stripePriceIdMonthly;
        if (tier !== SubscriptionTier.FREE && !priceId) {
            throw new PaymentServiceError(`Price ID not configured for ${tier} ${billingCycle}`, 'PRICE_NOT_CONFIGURED', 500);
        }
        const customerId = await this.getOrCreateCustomer(userId, email, name);
        await stripeProvider.attachPaymentMethod(paymentMethodId, customerId);
        await stripeProvider.setDefaultPaymentMethod(customerId, paymentMethodId);
        const existingSubscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });
        if (!existingSubscription) {
            throw new PaymentServiceError('Subscription record not found', 'SUBSCRIPTION_NOT_FOUND', 404);
        }
        if (tier === SubscriptionTier.FREE) {
            throw new PaymentServiceError('Cannot create subscription for FREE tier', 'INVALID_TIER', 400);
        }
        if (existingSubscription.stripeSubscriptionId) {
            await stripeProvider.cancelSubscription(existingSubscription.stripeSubscriptionId, true);
        }
        const subscriptionParams = {
            customer: customerId,
            items: [{ price: priceId }],
            default_payment_method: paymentMethodId,
            metadata: {
                userId,
                tier,
                platform: 'agrobridge',
            },
        };
        if (trialDays && trialDays > 0) {
            subscriptionParams.trial_period_days = trialDays;
        }
        const stripeSubscription = await stripeProvider.createSubscription(subscriptionParams);
        const updatedSubscription = await this.prisma.subscription.update({
            where: { userId },
            data: {
                stripeSubscriptionId: stripeSubscription.id,
                stripePriceId: priceId,
                tier,
                status: this.mapStripeStatus(stripeSubscription.status),
                currentPeriodStart: new Date((stripeSubscription.items.data[0]?.current_period_start ?? Math.floor(Date.now() / 1000)) * 1000),
                currentPeriodEnd: new Date((stripeSubscription.items.data[0]?.current_period_end ?? Math.floor(Date.now() / 1000)) * 1000),
                cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
                trialEnd: stripeSubscription.trial_end
                    ? new Date(stripeSubscription.trial_end * 1000)
                    : null,
                batchesLimit: tierConfig.batchesLimit,
                apiCallsLimit: tierConfig.apiCallsLimit,
                storageLimitMb: tierConfig.storageLimitMb,
            },
        });
        logger.info('[PaymentService] Subscription created', {
            userId,
            tier,
            stripeSubscriptionId: stripeSubscription.id,
        });
        return {
            id: updatedSubscription.id,
            userId: updatedSubscription.userId,
            tier: updatedSubscription.tier,
            status: updatedSubscription.status,
            stripeCustomerId: updatedSubscription.stripeCustomerId,
            stripeSubscriptionId: updatedSubscription.stripeSubscriptionId,
            currentPeriodStart: updatedSubscription.currentPeriodStart,
            currentPeriodEnd: updatedSubscription.currentPeriodEnd,
            cancelAtPeriodEnd: updatedSubscription.cancelAtPeriodEnd,
            batchesUsed: updatedSubscription.batchesUsed,
            batchesLimit: updatedSubscription.batchesLimit,
            apiCallsUsed: updatedSubscription.apiCallsUsed,
            apiCallsLimit: updatedSubscription.apiCallsLimit,
            storageUsedMb: updatedSubscription.storageUsedMb,
            storageLimitMb: updatedSubscription.storageLimitMb,
        };
    }
    async updateSubscription(input) {
        if (!this.isAvailable()) {
            throw new PaymentServiceError('Payment service not available', 'PAYMENTS_UNAVAILABLE', 503);
        }
        const { userId, tier, billingCycle = 'monthly', prorationBehavior = 'create_prorations' } = input;
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });
        if (!subscription) {
            throw new PaymentServiceError('No subscription found for user', 'SUBSCRIPTION_NOT_FOUND', 404);
        }
        const tierConfig = TIER_CONFIGS[tier];
        const priceId = billingCycle === 'yearly'
            ? tierConfig.stripePriceIdYearly
            : tierConfig.stripePriceIdMonthly;
        if (tier === SubscriptionTier.FREE) {
            if (subscription.stripeSubscriptionId) {
                await stripeProvider.cancelSubscription(subscription.stripeSubscriptionId, false);
            }
            const updatedSubscription = await this.prisma.subscription.update({
                where: { userId },
                data: {
                    tier: SubscriptionTier.FREE,
                    cancelAtPeriodEnd: true,
                    batchesLimit: TIER_CONFIGS.FREE.batchesLimit,
                    apiCallsLimit: TIER_CONFIGS.FREE.apiCallsLimit,
                    storageLimitMb: TIER_CONFIGS.FREE.storageLimitMb,
                },
            });
            logger.info('[PaymentService] Subscription downgraded to FREE', { userId });
            return this.mapSubscriptionToData(updatedSubscription);
        }
        if (!priceId) {
            throw new PaymentServiceError(`Price ID not configured for ${tier} ${billingCycle}`, 'PRICE_NOT_CONFIGURED', 500);
        }
        if (!subscription.stripeSubscriptionId) {
            throw new PaymentServiceError('No active subscription to update', 'NO_ACTIVE_SUBSCRIPTION', 400);
        }
        const stripeSubscription = await stripeProvider.getSubscription(subscription.stripeSubscriptionId);
        const updatedStripeSubscription = await stripeProvider.updateSubscription(subscription.stripeSubscriptionId, {
            items: [
                {
                    id: stripeSubscription.items.data[0].id,
                    price: priceId,
                },
            ],
            proration_behavior: prorationBehavior,
            metadata: {
                userId,
                tier,
                platform: 'agrobridge',
            },
        });
        const updatedSubscription = await this.prisma.subscription.update({
            where: { userId },
            data: {
                stripePriceId: priceId,
                tier,
                status: this.mapStripeStatus(updatedStripeSubscription.status),
                currentPeriodStart: new Date((updatedStripeSubscription.items.data[0]?.current_period_start ?? Math.floor(Date.now() / 1000)) * 1000),
                currentPeriodEnd: new Date((updatedStripeSubscription.items.data[0]?.current_period_end ?? Math.floor(Date.now() / 1000)) * 1000),
                cancelAtPeriodEnd: updatedStripeSubscription.cancel_at_period_end,
                batchesLimit: tierConfig.batchesLimit,
                apiCallsLimit: tierConfig.apiCallsLimit,
                storageLimitMb: tierConfig.storageLimitMb,
            },
        });
        logger.info('[PaymentService] Subscription updated', {
            userId,
            tier,
            billingCycle,
        });
        return this.mapSubscriptionToData(updatedSubscription);
    }
    async cancelSubscription(userId, immediately = false) {
        if (!this.isAvailable()) {
            throw new PaymentServiceError('Payment service not available', 'PAYMENTS_UNAVAILABLE', 503);
        }
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });
        if (!subscription) {
            throw new PaymentServiceError('No subscription found for user', 'SUBSCRIPTION_NOT_FOUND', 404);
        }
        if (!subscription.stripeSubscriptionId) {
            throw new PaymentServiceError('No active subscription to cancel', 'NO_ACTIVE_SUBSCRIPTION', 400);
        }
        const stripeSubscription = await stripeProvider.cancelSubscription(subscription.stripeSubscriptionId, immediately);
        const updateData = {
            cancelAtPeriodEnd: !immediately,
            canceledAt: new Date(),
        };
        if (immediately) {
            updateData.status = SubscriptionStatus.CANCELED;
            updateData.tier = SubscriptionTier.FREE;
            updateData.stripeSubscriptionId = null;
            updateData.batchesLimit = TIER_CONFIGS.FREE.batchesLimit;
            updateData.apiCallsLimit = TIER_CONFIGS.FREE.apiCallsLimit;
            updateData.storageLimitMb = TIER_CONFIGS.FREE.storageLimitMb;
        }
        else {
            updateData.status = this.mapStripeStatus(stripeSubscription.status);
        }
        const updatedSubscription = await this.prisma.subscription.update({
            where: { userId },
            data: updateData,
        });
        logger.info('[PaymentService] Subscription canceled', {
            userId,
            immediately,
        });
        return this.mapSubscriptionToData(updatedSubscription);
    }
    async resumeSubscription(userId) {
        if (!this.isAvailable()) {
            throw new PaymentServiceError('Payment service not available', 'PAYMENTS_UNAVAILABLE', 503);
        }
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });
        if (!subscription) {
            throw new PaymentServiceError('No subscription found for user', 'SUBSCRIPTION_NOT_FOUND', 404);
        }
        if (!subscription.stripeSubscriptionId) {
            throw new PaymentServiceError('No subscription to resume', 'NO_ACTIVE_SUBSCRIPTION', 400);
        }
        if (!subscription.cancelAtPeriodEnd) {
            throw new PaymentServiceError('Subscription is not scheduled for cancellation', 'NOT_CANCELING', 400);
        }
        const stripeSubscription = await stripeProvider.resumeSubscription(subscription.stripeSubscriptionId);
        const updatedSubscription = await this.prisma.subscription.update({
            where: { userId },
            data: {
                cancelAtPeriodEnd: false,
                canceledAt: null,
                status: this.mapStripeStatus(stripeSubscription.status),
            },
        });
        logger.info('[PaymentService] Subscription resumed', { userId });
        return this.mapSubscriptionToData(updatedSubscription);
    }
    async createOneTimePayment(input) {
        if (!this.isAvailable()) {
            throw new PaymentServiceError('Payment service not available', 'PAYMENTS_UNAVAILABLE', 503);
        }
        const { userId, amount, currency = 'usd', description, paymentMethodId, metadata } = input;
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });
        if (!subscription) {
            throw new PaymentServiceError('No subscription found for user', 'SUBSCRIPTION_NOT_FOUND', 404);
        }
        const paymentIntentParams = {
            amount,
            currency,
            customer: subscription.stripeCustomerId,
            description,
            metadata: {
                userId,
                platform: 'agrobridge',
                type: 'one_time',
                ...metadata,
            },
        };
        if (paymentMethodId) {
            paymentIntentParams.payment_method = paymentMethodId;
            paymentIntentParams.confirm = true;
        }
        const paymentIntent = await stripeProvider.createPaymentIntent(paymentIntentParams);
        await this.prisma.payment.create({
            data: {
                subscriptionId: subscription.id,
                stripePaymentIntentId: paymentIntent.id,
                amount,
                currency,
                status: paymentIntent.status,
                description,
            },
        });
        logger.info('[PaymentService] One-time payment created', {
            userId,
            amount,
            paymentIntentId: paymentIntent.id,
        });
        return {
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
        };
    }
    async listInvoices(userId, limit = 10) {
        if (!this.isAvailable()) {
            throw new PaymentServiceError('Payment service not available', 'PAYMENTS_UNAVAILABLE', 503);
        }
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });
        if (!subscription) {
            throw new PaymentServiceError('No subscription found for user', 'SUBSCRIPTION_NOT_FOUND', 404);
        }
        const invoices = await stripeProvider.listInvoices(subscription.stripeCustomerId, limit);
        return invoices.map((invoice) => ({
            id: invoice.id,
            number: invoice.number,
            status: invoice.status,
            amount: invoice.amount_due,
            currency: invoice.currency,
            pdfUrl: invoice.invoice_pdf ?? null,
            hostedUrl: invoice.hosted_invoice_url ?? null,
            createdAt: new Date(invoice.created * 1000),
            paidAt: invoice.status_transitions?.paid_at
                ? new Date(invoice.status_transitions.paid_at * 1000)
                : null,
        }));
    }
    async getInvoicePdf(userId, invoiceId) {
        if (!this.isAvailable()) {
            throw new PaymentServiceError('Payment service not available', 'PAYMENTS_UNAVAILABLE', 503);
        }
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });
        if (!subscription) {
            throw new PaymentServiceError('No subscription found for user', 'SUBSCRIPTION_NOT_FOUND', 404);
        }
        const invoice = await stripeProvider.getInvoice(invoiceId);
        if (invoice.customer !== subscription.stripeCustomerId) {
            throw new PaymentServiceError('Invoice not found for this user', 'INVOICE_NOT_FOUND', 404);
        }
        return invoice.invoice_pdf ?? null;
    }
    async checkUsage(userId, type, amount = 1) {
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });
        if (!subscription) {
            return { allowed: false, used: 0, limit: 0, remaining: 0 };
        }
        let used;
        let limit;
        switch (type) {
            case 'batches':
                used = subscription.batchesUsed;
                limit = subscription.batchesLimit;
                break;
            case 'apiCalls':
                used = subscription.apiCallsUsed;
                limit = subscription.apiCallsLimit;
                break;
            case 'storage':
                used = subscription.storageUsedMb;
                limit = subscription.storageLimitMb;
                break;
        }
        if (limit === -1) {
            return { allowed: true, used, limit, remaining: -1 };
        }
        const remaining = limit - used;
        const allowed = remaining >= amount;
        return { allowed, used, limit, remaining };
    }
    async incrementUsage(userId, type, amount = 1) {
        const field = type === 'batches'
            ? 'batchesUsed'
            : type === 'apiCalls'
                ? 'apiCallsUsed'
                : 'storageUsedMb';
        await this.prisma.subscription.update({
            where: { userId },
            data: {
                [field]: { increment: amount },
            },
        });
        logger.debug('[PaymentService] Usage incremented', {
            userId,
            type,
            amount,
        });
    }
    async resetMonthlyUsage() {
        const result = await this.prisma.subscription.updateMany({
            data: {
                batchesUsed: 0,
                apiCallsUsed: 0,
            },
        });
        logger.info('[PaymentService] Monthly usage reset', {
            count: result.count,
        });
        return result.count;
    }
    async createPortalSession(userId, returnUrl) {
        if (!this.isAvailable()) {
            throw new PaymentServiceError('Payment service not available', 'PAYMENTS_UNAVAILABLE', 503);
        }
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });
        if (!subscription) {
            throw new PaymentServiceError('No subscription found for user', 'SUBSCRIPTION_NOT_FOUND', 404);
        }
        const session = await stripeProvider.createPortalSession(subscription.stripeCustomerId, returnUrl);
        logger.info('[PaymentService] Portal session created', {
            userId,
            sessionUrl: session.url,
        });
        return { url: session.url };
    }
    getTierConfigs() {
        return Object.values(TIER_CONFIGS);
    }
    getTierConfig(tier) {
        return TIER_CONFIGS[tier];
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
    formatPaymentMethod(pm, isDefault) {
        return {
            id: pm.id,
            brand: pm.card?.brand || 'unknown',
            last4: pm.card?.last4 || '****',
            expMonth: pm.card?.exp_month || 0,
            expYear: pm.card?.exp_year || 0,
            isDefault,
        };
    }
    mapSubscriptionToData(subscription) {
        return {
            id: subscription.id,
            userId: subscription.userId,
            tier: subscription.tier,
            status: subscription.status,
            stripeCustomerId: subscription.stripeCustomerId,
            stripeSubscriptionId: subscription.stripeSubscriptionId,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            batchesUsed: subscription.batchesUsed,
            batchesLimit: subscription.batchesLimit,
            apiCallsUsed: subscription.apiCallsUsed,
            apiCallsLimit: subscription.apiCallsLimit,
            storageUsedMb: subscription.storageUsedMb,
            storageLimitMb: subscription.storageLimitMb,
        };
    }
}
export function createPaymentService(prisma) {
    return new PaymentService(prisma);
}
