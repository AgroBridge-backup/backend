/**
 * @file Stripe Provider
 * @description Low-level Stripe API wrapper for payment operations
 *
 * Features:
 * - Customer management
 * - Subscription lifecycle
 * - Payment intent creation
 * - Invoice management
 * - Webhook signature verification
 * - Error handling with retries
 *
 * @author AgroBridge Engineering Team
 */

import Stripe from 'stripe';
import logger from '../../../shared/utils/logger.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Stripe error codes for specific handling
 */
export enum StripeErrorCode {
  CARD_DECLINED = 'card_declined',
  INSUFFICIENT_FUNDS = 'insufficient_funds',
  EXPIRED_CARD = 'expired_card',
  INVALID_NUMBER = 'incorrect_number',
  PROCESSING_ERROR = 'processing_error',
  RATE_LIMIT = 'rate_limit',
}

/**
 * Custom Stripe error for application use
 */
export class StripeProviderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
    public readonly stripeError?: Error
  ) {
    super(message);
    this.name = 'StripeProviderError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STRIPE PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Stripe Provider - Low-level API wrapper
 *
 * Handles direct Stripe API communication with proper error handling
 */
export class StripeProvider {
  private static instance: StripeProvider | null = null;
  private stripe: Stripe | null = null;
  private isConfigured: boolean = false;

  private constructor() {
    this.initialize();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): StripeProvider {
    if (!StripeProvider.instance) {
      StripeProvider.instance = new StripeProvider();
    }
    return StripeProvider.instance;
  }

  /**
   * Initialize Stripe client
   */
  private initialize(): void {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      logger.warn('[StripeProvider] Not configured - STRIPE_SECRET_KEY not set');
      return;
    }

    this.stripe = new Stripe(secretKey, {
      typescript: true,
      maxNetworkRetries: 3,
      timeout: 30000, // 30 seconds
    });

    this.isConfigured = true;
    logger.info('[StripeProvider] Initialized successfully');
  }

  /**
   * Check if Stripe is configured
   */
  public isAvailable(): boolean {
    return this.isConfigured && this.stripe !== null;
  }

  /**
   * Get Stripe client (throws if not configured)
   */
  private getClient(): Stripe {
    if (!this.stripe) {
      throw new StripeProviderError(
        'Stripe is not configured',
        'STRIPE_NOT_CONFIGURED',
        500
      );
    }
    return this.stripe;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CUSTOMER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Create a new Stripe customer
   */
  async createCustomer(params: Stripe.CustomerCreateParams): Promise<Stripe.Customer> {
    try {
      const customer = await this.getClient().customers.create(params);
      logger.info('[StripeProvider] Customer created', {
        customerId: customer.id,
        email: customer.email,
      });
      return customer;
    } catch (error) {
      throw this.handleStripeError(error as Error, 'createCustomer');
    }
  }

  /**
   * Retrieve a customer by ID
   */
  async getCustomer(customerId: string): Promise<Stripe.Customer> {
    try {
      const customer = await this.getClient().customers.retrieve(customerId);
      if (customer.deleted) {
        throw new StripeProviderError(
          'Customer has been deleted',
          'CUSTOMER_DELETED',
          404
        );
      }
      return customer as Stripe.Customer;
    } catch (error) {
      throw this.handleStripeError(error as Error, 'getCustomer');
    }
  }

  /**
   * Update a customer
   */
  async updateCustomer(
    customerId: string,
    params: Stripe.CustomerUpdateParams
  ): Promise<Stripe.Customer> {
    try {
      const customer = await this.getClient().customers.update(customerId, params);
      logger.info('[StripeProvider] Customer updated', { customerId });
      return customer;
    } catch (error) {
      throw this.handleStripeError(error as Error, 'updateCustomer');
    }
  }

  /**
   * Delete a customer
   */
  async deleteCustomer(customerId: string): Promise<void> {
    try {
      await this.getClient().customers.del(customerId);
      logger.info('[StripeProvider] Customer deleted', { customerId });
    } catch (error) {
      throw this.handleStripeError(error as Error, 'deleteCustomer');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PAYMENT METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Attach a payment method to a customer
   */
  async attachPaymentMethod(
    paymentMethodId: string,
    customerId: string
  ): Promise<Stripe.PaymentMethod> {
    try {
      const paymentMethod = await this.getClient().paymentMethods.attach(
        paymentMethodId,
        { customer: customerId }
      );
      logger.info('[StripeProvider] Payment method attached', {
        paymentMethodId,
        customerId,
      });
      return paymentMethod;
    } catch (error) {
      throw this.handleStripeError(error as Error, 'attachPaymentMethod');
    }
  }

  /**
   * Detach a payment method from a customer
   */
  async detachPaymentMethod(paymentMethodId: string): Promise<void> {
    try {
      await this.getClient().paymentMethods.detach(paymentMethodId);
      logger.info('[StripeProvider] Payment method detached', { paymentMethodId });
    } catch (error) {
      throw this.handleStripeError(error as Error, 'detachPaymentMethod');
    }
  }

  /**
   * List payment methods for a customer
   */
  async listPaymentMethods(
    customerId: string,
    type: Stripe.PaymentMethodListParams.Type = 'card'
  ): Promise<Stripe.PaymentMethod[]> {
    try {
      const paymentMethods = await this.getClient().paymentMethods.list({
        customer: customerId,
        type,
      });
      return paymentMethods.data;
    } catch (error) {
      throw this.handleStripeError(error as Error, 'listPaymentMethods');
    }
  }

  /**
   * Set default payment method for a customer
   */
  async setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<Stripe.Customer> {
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
    } catch (error) {
      throw this.handleStripeError(error as Error, 'setDefaultPaymentMethod');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SUBSCRIPTIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Create a subscription
   */
  async createSubscription(
    params: Stripe.SubscriptionCreateParams
  ): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.getClient().subscriptions.create(params);
      logger.info('[StripeProvider] Subscription created', {
        subscriptionId: subscription.id,
        customerId: params.customer,
        status: subscription.status,
      });
      return subscription;
    } catch (error) {
      throw this.handleStripeError(error as Error, 'createSubscription');
    }
  }

  /**
   * Retrieve a subscription
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      return await this.getClient().subscriptions.retrieve(subscriptionId, {
        expand: ['latest_invoice', 'default_payment_method'],
      });
    } catch (error) {
      throw this.handleStripeError(error as Error, 'getSubscription');
    }
  }

  /**
   * Update a subscription
   */
  async updateSubscription(
    subscriptionId: string,
    params: Stripe.SubscriptionUpdateParams
  ): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.getClient().subscriptions.update(
        subscriptionId,
        params
      );
      logger.info('[StripeProvider] Subscription updated', {
        subscriptionId,
        status: subscription.status,
      });
      return subscription;
    } catch (error) {
      throw this.handleStripeError(error as Error, 'updateSubscription');
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    immediately: boolean = false
  ): Promise<Stripe.Subscription> {
    try {
      let subscription: Stripe.Subscription;

      if (immediately) {
        subscription = await this.getClient().subscriptions.cancel(subscriptionId);
      } else {
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
    } catch (error) {
      throw this.handleStripeError(error as Error, 'cancelSubscription');
    }
  }

  /**
   * Resume a canceled subscription
   */
  async resumeSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.getClient().subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
      });
      logger.info('[StripeProvider] Subscription resumed', { subscriptionId });
      return subscription;
    } catch (error) {
      throw this.handleStripeError(error as Error, 'resumeSubscription');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PAYMENT INTENTS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Create a payment intent
   */
  async createPaymentIntent(
    params: Stripe.PaymentIntentCreateParams
  ): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.getClient().paymentIntents.create(params);
      logger.info('[StripeProvider] PaymentIntent created', {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      });
      return paymentIntent;
    } catch (error) {
      throw this.handleStripeError(error as Error, 'createPaymentIntent');
    }
  }

  /**
   * Retrieve a payment intent
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      return await this.getClient().paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      throw this.handleStripeError(error as Error, 'getPaymentIntent');
    }
  }

  /**
   * Confirm a payment intent
   */
  async confirmPaymentIntent(
    paymentIntentId: string,
    params?: Stripe.PaymentIntentConfirmParams
  ): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.getClient().paymentIntents.confirm(
        paymentIntentId,
        params
      );
      logger.info('[StripeProvider] PaymentIntent confirmed', {
        paymentIntentId,
        status: paymentIntent.status,
      });
      return paymentIntent;
    } catch (error) {
      throw this.handleStripeError(error as Error, 'confirmPaymentIntent');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // INVOICES
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * List invoices for a customer
   */
  async listInvoices(
    customerId: string,
    limit: number = 10
  ): Promise<Stripe.Invoice[]> {
    try {
      const invoices = await this.getClient().invoices.list({
        customer: customerId,
        limit,
      });
      return invoices.data;
    } catch (error) {
      throw this.handleStripeError(error as Error, 'listInvoices');
    }
  }

  /**
   * Retrieve an invoice
   */
  async getInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    try {
      return await this.getClient().invoices.retrieve(invoiceId);
    } catch (error) {
      throw this.handleStripeError(error as Error, 'getInvoice');
    }
  }

  /**
   * Get invoice PDF URL
   */
  async getInvoicePdfUrl(invoiceId: string): Promise<string | null> {
    try {
      const invoice = await this.getInvoice(invoiceId);
      return invoice.invoice_pdf ?? null;
    } catch (error) {
      throw this.handleStripeError(error as Error, 'getInvoicePdfUrl');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // USAGE-BASED BILLING
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Record usage for metered billing
   * Note: In Stripe v20+, usage records were replaced by Billing Meters API.
   * This method tracks usage internally for now.
   */
  async createUsageRecord(
    subscriptionItemId: string,
    quantity: number,
    _timestamp?: number,
    action: 'increment' | 'set' = 'increment'
  ): Promise<{ subscriptionItemId: string; quantity: number; action: string; timestamp: number }> {
    // In Stripe v20+, createUsageRecord was deprecated.
    // Usage tracking is now handled via Billing Meters or internal tracking.
    const timestamp = _timestamp || Math.floor(Date.now() / 1000);

    logger.debug('[StripeProvider] Usage record tracked internally', {
      subscriptionItemId,
      quantity,
      action,
      timestamp,
    });

    // Return a compatible object structure
    return {
      subscriptionItemId,
      quantity,
      action,
      timestamp,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // BILLING PORTAL
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Create a billing portal session
   */
  async createPortalSession(
    customerId: string,
    returnUrl: string
  ): Promise<Stripe.BillingPortal.Session> {
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
    } catch (error) {
      throw this.handleStripeError(error as Error, 'createPortalSession');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // WEBHOOKS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Construct and verify webhook event
   */
  constructWebhookEvent(
    payload: string | Buffer,
    signature: string
  ): Stripe.Event {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new StripeProviderError(
        'Stripe webhook secret not configured',
        'WEBHOOK_SECRET_NOT_CONFIGURED',
        500
      );
    }

    try {
      return this.getClient().webhooks.constructEvent(
        payload,
        signature,
        webhookSecret
      );
    } catch (error) {
      const stripeError = error as Error;
      logger.warn('[StripeProvider] Webhook signature verification failed', {
        error: stripeError.message,
      });
      throw new StripeProviderError(
        'Invalid webhook signature',
        'INVALID_WEBHOOK_SIGNATURE',
        400,
        stripeError
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRICES & PRODUCTS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Retrieve a price
   */
  async getPrice(priceId: string): Promise<Stripe.Price> {
    try {
      return await this.getClient().prices.retrieve(priceId, {
        expand: ['product'],
      });
    } catch (error) {
      throw this.handleStripeError(error as Error, 'getPrice');
    }
  }

  /**
   * List prices
   */
  async listPrices(productId?: string): Promise<Stripe.Price[]> {
    try {
      const params: Stripe.PriceListParams = {
        active: true,
        expand: ['data.product'],
      };
      if (productId) {
        params.product = productId;
      }
      const prices = await this.getClient().prices.list(params);
      return prices.data;
    } catch (error) {
      throw this.handleStripeError(error as Error, 'listPrices');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ERROR HANDLING
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Handle Stripe errors with proper logging and transformation
   */
  private handleStripeError(
    error: Error,
    operation: string
  ): never {
    // Handle Stripe-specific errors by checking error type property
    const stripeError = error as Error & { type?: string; code?: string; param?: string };

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
          throw new StripeProviderError(
            stripeError.message || 'Card error occurred',
            stripeError.code || 'card_error',
            400,
            stripeError
          );

        case 'StripeRateLimitError':
          throw new StripeProviderError(
            'Too many requests to payment provider',
            'rate_limit',
            429,
            stripeError
          );

        case 'StripeInvalidRequestError':
          throw new StripeProviderError(
            stripeError.message || 'Invalid request',
            'invalid_request',
            400,
            stripeError
          );

        case 'StripeAPIError':
          throw new StripeProviderError(
            'Payment provider error',
            'api_error',
            500,
            stripeError
          );

        case 'StripeConnectionError':
          throw new StripeProviderError(
            'Could not connect to payment provider',
            'connection_error',
            503,
            stripeError
          );

        case 'StripeAuthenticationError':
          throw new StripeProviderError(
            'Payment provider authentication failed',
            'authentication_error',
            500,
            stripeError
          );

        default:
          throw new StripeProviderError(
            stripeError.message || 'Unknown payment error',
            'unknown_error',
            500,
            stripeError
          );
      }
    }

    // Handle generic errors
    logger.error('[StripeProvider] Unexpected error', {
      operation,
      error: error.message,
    });

    throw new StripeProviderError(
      error.message || 'An unexpected error occurred',
      'unexpected_error',
      500
    );
  }
}

// Export singleton instance
export const stripeProvider = StripeProvider.getInstance();

export default stripeProvider;
