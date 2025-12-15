import Stripe from 'stripe';
import logger from '../../../shared/utils/logger.js';
export var StripeErrorCode;
(function (StripeErrorCode) {
    StripeErrorCode["CARD_DECLINED"] = "card_declined";
    StripeErrorCode["INSUFFICIENT_FUNDS"] = "insufficient_funds";
    StripeErrorCode["EXPIRED_CARD"] = "expired_card";
    StripeErrorCode["INVALID_NUMBER"] = "incorrect_number";
    StripeErrorCode["PROCESSING_ERROR"] = "processing_error";
    StripeErrorCode["RATE_LIMIT"] = "rate_limit";
})(StripeErrorCode || (StripeErrorCode = {}));
export class StripeProviderError extends Error {
    code;
    statusCode;
    stripeError;
    constructor(message, code, statusCode = 400, stripeError) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.stripeError = stripeError;
        this.name = 'StripeProviderError';
    }
}
export class StripeProvider {
    static instance = null;
    stripe = null;
    isConfigured = false;
    constructor() {
        this.initialize();
    }
    static getInstance() {
        if (!StripeProvider.instance) {
            StripeProvider.instance = new StripeProvider();
        }
        return StripeProvider.instance;
    }
    initialize() {
        const secretKey = process.env.STRIPE_SECRET_KEY;
        if (!secretKey) {
            logger.warn('[StripeProvider] Not configured - STRIPE_SECRET_KEY not set');
            return;
        }
        this.stripe = new Stripe(secretKey, {
            typescript: true,
            maxNetworkRetries: 3,
            timeout: 30000,
        });
        this.isConfigured = true;
        logger.info('[StripeProvider] Initialized successfully');
    }
    isAvailable() {
        return this.isConfigured && this.stripe !== null;
    }
    getClient() {
        if (!this.stripe) {
            throw new StripeProviderError('Stripe is not configured', 'STRIPE_NOT_CONFIGURED', 500);
        }
        return this.stripe;
    }
    async createCustomer(params) {
        try {
            const customer = await this.getClient().customers.create(params);
            logger.info('[StripeProvider] Customer created', {
                customerId: customer.id,
                email: customer.email,
            });
            return customer;
        }
        catch (error) {
            throw this.handleStripeError(error, 'createCustomer');
        }
    }
    async getCustomer(customerId) {
        try {
            const customer = await this.getClient().customers.retrieve(customerId);
            if (customer.deleted) {
                throw new StripeProviderError('Customer has been deleted', 'CUSTOMER_DELETED', 404);
            }
            return customer;
        }
        catch (error) {
            throw this.handleStripeError(error, 'getCustomer');
        }
    }
    async updateCustomer(customerId, params) {
        try {
            const customer = await this.getClient().customers.update(customerId, params);
            logger.info('[StripeProvider] Customer updated', { customerId });
            return customer;
        }
        catch (error) {
            throw this.handleStripeError(error, 'updateCustomer');
        }
    }
    async deleteCustomer(customerId) {
        try {
            await this.getClient().customers.del(customerId);
            logger.info('[StripeProvider] Customer deleted', { customerId });
        }
        catch (error) {
            throw this.handleStripeError(error, 'deleteCustomer');
        }
    }
    async attachPaymentMethod(paymentMethodId, customerId) {
        try {
            const paymentMethod = await this.getClient().paymentMethods.attach(paymentMethodId, { customer: customerId });
            logger.info('[StripeProvider] Payment method attached', {
                paymentMethodId,
                customerId,
            });
            return paymentMethod;
        }
        catch (error) {
            throw this.handleStripeError(error, 'attachPaymentMethod');
        }
    }
    async detachPaymentMethod(paymentMethodId) {
        try {
            await this.getClient().paymentMethods.detach(paymentMethodId);
            logger.info('[StripeProvider] Payment method detached', { paymentMethodId });
        }
        catch (error) {
            throw this.handleStripeError(error, 'detachPaymentMethod');
        }
    }
    async listPaymentMethods(customerId, type = 'card') {
        try {
            const paymentMethods = await this.getClient().paymentMethods.list({
                customer: customerId,
                type,
            });
            return paymentMethods.data;
        }
        catch (error) {
            throw this.handleStripeError(error, 'listPaymentMethods');
        }
    }
    async setDefaultPaymentMethod(customerId, paymentMethodId) {
        try {
            const customer = await this.getClient().customers.update(customerId, {
                invoice_settings: {
                    default_payment_method: paymentMethodId,
                },
            });
            logger.info('[StripeProvider] Default payment method set', {
                customerId,
                paymentMethodId,
            });
            return customer;
        }
        catch (error) {
            throw this.handleStripeError(error, 'setDefaultPaymentMethod');
        }
    }
    async createSubscription(params) {
        try {
            const subscription = await this.getClient().subscriptions.create(params);
            logger.info('[StripeProvider] Subscription created', {
                subscriptionId: subscription.id,
                customerId: params.customer,
                status: subscription.status,
            });
            return subscription;
        }
        catch (error) {
            throw this.handleStripeError(error, 'createSubscription');
        }
    }
    async getSubscription(subscriptionId) {
        try {
            return await this.getClient().subscriptions.retrieve(subscriptionId, {
                expand: ['latest_invoice', 'default_payment_method'],
            });
        }
        catch (error) {
            throw this.handleStripeError(error, 'getSubscription');
        }
    }
    async updateSubscription(subscriptionId, params) {
        try {
            const subscription = await this.getClient().subscriptions.update(subscriptionId, params);
            logger.info('[StripeProvider] Subscription updated', {
                subscriptionId,
                status: subscription.status,
            });
            return subscription;
        }
        catch (error) {
            throw this.handleStripeError(error, 'updateSubscription');
        }
    }
    async cancelSubscription(subscriptionId, immediately = false) {
        try {
            let subscription;
            if (immediately) {
                subscription = await this.getClient().subscriptions.cancel(subscriptionId);
            }
            else {
                subscription = await this.getClient().subscriptions.update(subscriptionId, {
                    cancel_at_period_end: true,
                });
            }
            logger.info('[StripeProvider] Subscription canceled', {
                subscriptionId,
                immediately,
                status: subscription.status,
            });
            return subscription;
        }
        catch (error) {
            throw this.handleStripeError(error, 'cancelSubscription');
        }
    }
    async resumeSubscription(subscriptionId) {
        try {
            const subscription = await this.getClient().subscriptions.update(subscriptionId, {
                cancel_at_period_end: false,
            });
            logger.info('[StripeProvider] Subscription resumed', { subscriptionId });
            return subscription;
        }
        catch (error) {
            throw this.handleStripeError(error, 'resumeSubscription');
        }
    }
    async createPaymentIntent(params) {
        try {
            const paymentIntent = await this.getClient().paymentIntents.create(params);
            logger.info('[StripeProvider] PaymentIntent created', {
                paymentIntentId: paymentIntent.id,
                amount: paymentIntent.amount,
                currency: paymentIntent.currency,
            });
            return paymentIntent;
        }
        catch (error) {
            throw this.handleStripeError(error, 'createPaymentIntent');
        }
    }
    async getPaymentIntent(paymentIntentId) {
        try {
            return await this.getClient().paymentIntents.retrieve(paymentIntentId);
        }
        catch (error) {
            throw this.handleStripeError(error, 'getPaymentIntent');
        }
    }
    async confirmPaymentIntent(paymentIntentId, params) {
        try {
            const paymentIntent = await this.getClient().paymentIntents.confirm(paymentIntentId, params);
            logger.info('[StripeProvider] PaymentIntent confirmed', {
                paymentIntentId,
                status: paymentIntent.status,
            });
            return paymentIntent;
        }
        catch (error) {
            throw this.handleStripeError(error, 'confirmPaymentIntent');
        }
    }
    async listInvoices(customerId, limit = 10) {
        try {
            const invoices = await this.getClient().invoices.list({
                customer: customerId,
                limit,
            });
            return invoices.data;
        }
        catch (error) {
            throw this.handleStripeError(error, 'listInvoices');
        }
    }
    async getInvoice(invoiceId) {
        try {
            return await this.getClient().invoices.retrieve(invoiceId);
        }
        catch (error) {
            throw this.handleStripeError(error, 'getInvoice');
        }
    }
    async getInvoicePdfUrl(invoiceId) {
        try {
            const invoice = await this.getInvoice(invoiceId);
            return invoice.invoice_pdf ?? null;
        }
        catch (error) {
            throw this.handleStripeError(error, 'getInvoicePdfUrl');
        }
    }
    async createUsageRecord(subscriptionItemId, quantity, _timestamp, action = 'increment') {
        const timestamp = _timestamp || Math.floor(Date.now() / 1000);
        logger.debug('[StripeProvider] Usage record tracked internally', {
            subscriptionItemId,
            quantity,
            action,
            timestamp,
        });
        return {
            subscriptionItemId,
            quantity,
            action,
            timestamp,
        };
    }
    async createPortalSession(customerId, returnUrl) {
        try {
            const session = await this.getClient().billingPortal.sessions.create({
                customer: customerId,
                return_url: returnUrl,
            });
            logger.info('[StripeProvider] Portal session created', {
                customerId,
                sessionUrl: session.url,
            });
            return session;
        }
        catch (error) {
            throw this.handleStripeError(error, 'createPortalSession');
        }
    }
    constructWebhookEvent(payload, signature) {
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!webhookSecret) {
            throw new StripeProviderError('Stripe webhook secret not configured', 'WEBHOOK_SECRET_NOT_CONFIGURED', 500);
        }
        try {
            return this.getClient().webhooks.constructEvent(payload, signature, webhookSecret);
        }
        catch (error) {
            const stripeError = error;
            logger.warn('[StripeProvider] Webhook signature verification failed', {
                error: stripeError.message,
            });
            throw new StripeProviderError('Invalid webhook signature', 'INVALID_WEBHOOK_SIGNATURE', 400, stripeError);
        }
    }
    async getPrice(priceId) {
        try {
            return await this.getClient().prices.retrieve(priceId, {
                expand: ['product'],
            });
        }
        catch (error) {
            throw this.handleStripeError(error, 'getPrice');
        }
    }
    async listPrices(productId) {
        try {
            const params = {
                active: true,
                expand: ['data.product'],
            };
            if (productId) {
                params.product = productId;
            }
            const prices = await this.getClient().prices.list(params);
            return prices.data;
        }
        catch (error) {
            throw this.handleStripeError(error, 'listPrices');
        }
    }
    handleStripeError(error, operation) {
        const stripeError = error;
        if (stripeError.type) {
            logger.error('[StripeProvider] Stripe API error', {
                operation,
                type: stripeError.type,
                code: stripeError.code,
                message: stripeError.message,
                param: stripeError.param,
            });
            switch (stripeError.type) {
                case 'StripeCardError':
                    throw new StripeProviderError(stripeError.message || 'Card error occurred', stripeError.code || 'card_error', 400, stripeError);
                case 'StripeRateLimitError':
                    throw new StripeProviderError('Too many requests to payment provider', 'rate_limit', 429, stripeError);
                case 'StripeInvalidRequestError':
                    throw new StripeProviderError(stripeError.message || 'Invalid request', 'invalid_request', 400, stripeError);
                case 'StripeAPIError':
                    throw new StripeProviderError('Payment provider error', 'api_error', 500, stripeError);
                case 'StripeConnectionError':
                    throw new StripeProviderError('Could not connect to payment provider', 'connection_error', 503, stripeError);
                case 'StripeAuthenticationError':
                    throw new StripeProviderError('Payment provider authentication failed', 'authentication_error', 500, stripeError);
                default:
                    throw new StripeProviderError(stripeError.message || 'Unknown payment error', 'unknown_error', 500, stripeError);
            }
        }
        logger.error('[StripeProvider] Unexpected error', {
            operation,
            error: error.message,
        });
        throw new StripeProviderError(error.message || 'An unexpected error occurred', 'unexpected_error', 500);
    }
}
export const stripeProvider = StripeProvider.getInstance();
export default stripeProvider;
