/**
 * @file Stripe Webhook Handler
 * @description Handles Stripe webhook events for payment processing
 *
 * Events handled:
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.payment_succeeded
 * - invoice.payment_failed
 * - payment_intent.succeeded
 * - payment_intent.payment_failed
 *
 * @author AgroBridge Engineering Team
 */

import { PrismaClient, SubscriptionTier, SubscriptionStatus } from '@prisma/client';
import Stripe from 'stripe';
import { stripeProvider, StripeProviderError } from '../providers/StripeProvider.js';
import { TIER_CONFIGS } from '../PaymentService.js';
import logger from '../../../shared/utils/logger.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Webhook event result
 */
export interface WebhookResult {
  success: boolean;
  eventType: string;
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Webhook handler error
 */
export class WebhookHandlerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'WebhookHandlerError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STRIPE WEBHOOK HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export class StripeWebhookHandler {
  constructor(private prisma: PrismaClient) {}

  /**
   * Process a Stripe webhook event
   */
  async handleWebhook(
    payload: string | Buffer,
    signature: string
  ): Promise<WebhookResult> {
    // Verify webhook signature and construct event
    let event: Stripe.Event;
    try {
      event = stripeProvider.constructWebhookEvent(payload, signature);
    } catch (error) {
      if (error instanceof StripeProviderError) {
        throw new WebhookHandlerError(
          error.message,
          error.code,
          error.statusCode
        );
      }
      throw error;
    }

    logger.info('[StripeWebhook] Received event', {
      type: event.type,
      id: event.id,
    });

    // Route to appropriate handler
    try {
      switch (event.type) {
        // Subscription events
        case 'customer.subscription.created':
          return await this.handleSubscriptionCreated(event);
        case 'customer.subscription.updated':
          return await this.handleSubscriptionUpdated(event);
        case 'customer.subscription.deleted':
          return await this.handleSubscriptionDeleted(event);

        // Invoice events
        case 'invoice.payment_succeeded':
          return await this.handleInvoicePaymentSucceeded(event);
        case 'invoice.payment_failed':
          return await this.handleInvoicePaymentFailed(event);
        case 'invoice.finalized':
          return await this.handleInvoiceFinalized(event);

        // Payment intent events
        case 'payment_intent.succeeded':
          return await this.handlePaymentIntentSucceeded(event);
        case 'payment_intent.payment_failed':
          return await this.handlePaymentIntentFailed(event);

        // Customer events
        case 'customer.updated':
          return await this.handleCustomerUpdated(event);
        case 'customer.deleted':
          return await this.handleCustomerDeleted(event);

        // Checkout session events
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
    } catch (error) {
      logger.error('[StripeWebhook] Error processing event', {
        type: event.type,
        id: event.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SUBSCRIPTION HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Handle subscription created event
   */
  private async handleSubscriptionCreated(event: Stripe.Event): Promise<WebhookResult> {
    const subscription = event.data.object as Stripe.Subscription;
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

    // Get tier from metadata
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

  /**
   * Handle subscription updated event
   */
  private async handleSubscriptionUpdated(event: Stripe.Event): Promise<WebhookResult> {
    const subscription = event.data.object as Stripe.Subscription;
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

    // Get tier from subscription
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

  /**
   * Handle subscription deleted event
   */
  private async handleSubscriptionDeleted(event: Stripe.Event): Promise<WebhookResult> {
    const subscription = event.data.object as Stripe.Subscription;
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

  // ═══════════════════════════════════════════════════════════════════════════════
  // INVOICE HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Handle invoice payment succeeded event
   */
  private async handleInvoicePaymentSucceeded(event: Stripe.Event): Promise<WebhookResult> {
    const invoice = event.data.object as Stripe.Invoice;
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

    // Record payment
    // In Stripe v20, payment_intent was moved. Access it with type assertion.
    const invoiceWithPaymentIntent = invoice as Stripe.Invoice & { payment_intent?: string | Stripe.PaymentIntent };
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

    // Reset usage counters on successful payment (new billing period)
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

  /**
   * Handle invoice payment failed event
   */
  private async handleInvoicePaymentFailed(event: Stripe.Event): Promise<WebhookResult> {
    const invoice = event.data.object as Stripe.Invoice;
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

    // Record failed payment
    // In Stripe v20, payment_intent was moved. Access it with type assertion.
    const invoiceWithPaymentIntent = invoice as Stripe.Invoice & { payment_intent?: string | Stripe.PaymentIntent };
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

    // Update subscription status
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

    // TODO: Send notification to user about failed payment

    return {
      success: true,
      eventType: event.type,
      message: 'Payment failure recorded',
      data: { invoiceId: invoice.id, amount: invoice.amount_due },
    };
  }

  /**
   * Handle invoice finalized event
   */
  private async handleInvoiceFinalized(event: Stripe.Event): Promise<WebhookResult> {
    const invoice = event.data.object as Stripe.Invoice;

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

  // ═══════════════════════════════════════════════════════════════════════════════
  // PAYMENT INTENT HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Handle payment intent succeeded event
   */
  private async handlePaymentIntentSucceeded(event: Stripe.Event): Promise<WebhookResult> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    // Update payment record if exists
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

  /**
   * Handle payment intent failed event
   */
  private async handlePaymentIntentFailed(event: Stripe.Event): Promise<WebhookResult> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    // Update payment record if exists
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

  // ═══════════════════════════════════════════════════════════════════════════════
  // CUSTOMER HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Handle customer updated event
   */
  private async handleCustomerUpdated(event: Stripe.Event): Promise<WebhookResult> {
    const customer = event.data.object as Stripe.Customer;

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

  /**
   * Handle customer deleted event
   */
  private async handleCustomerDeleted(event: Stripe.Event): Promise<WebhookResult> {
    const customer = event.data.object as unknown as Stripe.DeletedCustomer;

    const dbSubscription = await this.prisma.subscription.findUnique({
      where: { stripeCustomerId: customer.id },
    });

    if (dbSubscription) {
      // Don't delete the subscription record, just mark as inactive
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

  // ═══════════════════════════════════════════════════════════════════════════════
  // CHECKOUT SESSION HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Handle checkout session completed event
   */
  private async handleCheckoutSessionCompleted(event: Stripe.Event): Promise<WebhookResult> {
    const session = event.data.object as Stripe.Checkout.Session;

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

  // ═══════════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Map Stripe subscription status to our status
   */
  private mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
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

  /**
   * Get tier from Stripe subscription metadata or price ID
   */
  private getTierFromSubscription(subscription: Stripe.Subscription): SubscriptionTier {
    // Check metadata first
    if (subscription.metadata?.tier) {
      const tier = subscription.metadata.tier.toUpperCase() as SubscriptionTier;
      if (Object.values(SubscriptionTier).includes(tier)) {
        return tier;
      }
    }

    // Check price ID
    const priceId = subscription.items.data[0]?.price?.id;
    if (priceId) {
      for (const [tier, config] of Object.entries(TIER_CONFIGS)) {
        if (
          config.stripePriceIdMonthly === priceId ||
          config.stripePriceIdYearly === priceId
        ) {
          return tier as SubscriptionTier;
        }
      }
    }

    // Default to FREE
    return SubscriptionTier.FREE;
  }
}

// Export factory function
export function createStripeWebhookHandler(prisma: PrismaClient): StripeWebhookHandler {
  return new StripeWebhookHandler(prisma);
}
