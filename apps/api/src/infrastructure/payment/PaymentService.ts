/**
 * @file Payment Service
 * @description High-level payment service for subscription management
 *
 * Features:
 * - Customer management
 * - Payment method operations
 * - Subscription lifecycle (create, update, cancel, resume)
 * - One-time payments
 * - Invoice retrieval
 * - Usage-based billing
 * - Billing portal access
 *
 * @author AgroBridge Engineering Team
 */

import { PrismaClient, SubscriptionTier, SubscriptionStatus } from '@prisma/client';
import Stripe from 'stripe';
import { stripeProvider, StripeProviderError } from './providers/StripeProvider.js';
import logger from '../../shared/utils/logger.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Subscription tier configuration
 */
export interface TierConfig {
  tier: SubscriptionTier;
  name: string;
  priceMonthly: number; // in cents
  priceYearly: number; // in cents
  batchesLimit: number;
  apiCallsLimit: number;
  storageLimitMb: number;
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
}

/**
 * Payment service configuration
 */
export const TIER_CONFIGS: Record<SubscriptionTier, TierConfig> = {
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
    priceMonthly: 1900, // $19/month
    priceYearly: 19000, // $190/year (save ~17%)
    batchesLimit: 100,
    apiCallsLimit: 1000,
    storageLimitMb: 1024, // 1 GB
    stripePriceIdMonthly: process.env.STRIPE_BASIC_MONTHLY_PRICE_ID,
    stripePriceIdYearly: process.env.STRIPE_BASIC_YEARLY_PRICE_ID,
  },
  PREMIUM: {
    tier: SubscriptionTier.PREMIUM,
    name: 'Premium',
    priceMonthly: 4900, // $49/month
    priceYearly: 49000, // $490/year (save ~17%)
    batchesLimit: 1000,
    apiCallsLimit: 10000,
    storageLimitMb: 10240, // 10 GB
    stripePriceIdMonthly: process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID,
    stripePriceIdYearly: process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID,
  },
  ENTERPRISE: {
    tier: SubscriptionTier.ENTERPRISE,
    name: 'Enterprise',
    priceMonthly: 50000, // $500/month
    priceYearly: 500000, // $5000/year (save ~17%)
    batchesLimit: -1, // unlimited
    apiCallsLimit: -1, // unlimited
    storageLimitMb: -1, // unlimited
    stripePriceIdMonthly: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID,
    stripePriceIdYearly: process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID,
  },
};

/**
 * Create subscription input
 */
export interface CreateSubscriptionInput {
  userId: string;
  email: string;
  name: string;
  tier: SubscriptionTier;
  paymentMethodId: string;
  billingCycle: 'monthly' | 'yearly';
  trialDays?: number;
}

/**
 * Update subscription input
 */
export interface UpdateSubscriptionInput {
  userId: string;
  tier: SubscriptionTier;
  billingCycle?: 'monthly' | 'yearly';
  prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice';
}

/**
 * Create one-time payment input
 */
export interface CreateOneTimePaymentInput {
  userId: string;
  amount: number; // in cents
  currency?: string;
  description: string;
  paymentMethodId?: string;
  metadata?: Record<string, string>;
}

/**
 * Subscription response data
 */
export interface SubscriptionData {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  batchesUsed: number;
  batchesLimit: number;
  apiCallsUsed: number;
  apiCallsLimit: number;
  storageUsedMb: number;
  storageLimitMb: number;
}

/**
 * Payment method data
 */
export interface PaymentMethodData {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

/**
 * Invoice data
 */
export interface InvoiceData {
  id: string;
  number: string | null;
  status: string | null;
  amount: number;
  currency: string;
  pdfUrl: string | null;
  hostedUrl: string | null;
  createdAt: Date;
  paidAt: Date | null;
}

/**
 * Payment service error
 */
export class PaymentServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'PaymentServiceError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class PaymentService {
  constructor(private prisma: PrismaClient) {}

  // ═══════════════════════════════════════════════════════════════════════════════
  // AVAILABILITY
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Check if payment service is available
   */
  isAvailable(): boolean {
    return stripeProvider.isAvailable();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CUSTOMER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Create or get Stripe customer for a user
   */
  async getOrCreateCustomer(
    userId: string,
    email: string,
    name: string
  ): Promise<string> {
    if (!this.isAvailable()) {
      throw new PaymentServiceError(
        'Payment service not available',
        'PAYMENTS_UNAVAILABLE',
        503
      );
    }

    // Check if user already has a subscription record with customer ID
    const existingSubscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (existingSubscription) {
      return existingSubscription.stripeCustomerId;
    }

    // Create new Stripe customer
    const customer = await stripeProvider.createCustomer({
      email,
      name,
      metadata: {
        userId,
        platform: 'agrobridge',
      },
    });

    // Create subscription record with FREE tier
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

  /**
   * Update customer details
   */
  async updateCustomer(
    userId: string,
    updates: { email?: string; name?: string }
  ): Promise<void> {
    if (!this.isAvailable()) {
      throw new PaymentServiceError(
        'Payment service not available',
        'PAYMENTS_UNAVAILABLE',
        503
      );
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new PaymentServiceError(
        'No subscription found for user',
        'SUBSCRIPTION_NOT_FOUND',
        404
      );
    }

    await stripeProvider.updateCustomer(subscription.stripeCustomerId, updates);

    logger.info('[PaymentService] Customer updated', { userId });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PAYMENT METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Add a payment method to user
   */
  async addPaymentMethod(
    userId: string,
    paymentMethodId: string,
    setAsDefault: boolean = true
  ): Promise<PaymentMethodData> {
    if (!this.isAvailable()) {
      throw new PaymentServiceError(
        'Payment service not available',
        'PAYMENTS_UNAVAILABLE',
        503
      );
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new PaymentServiceError(
        'No subscription found for user',
        'SUBSCRIPTION_NOT_FOUND',
        404
      );
    }

    // Attach payment method to customer
    const paymentMethod = await stripeProvider.attachPaymentMethod(
      paymentMethodId,
      subscription.stripeCustomerId
    );

    // Set as default if requested
    if (setAsDefault) {
      await stripeProvider.setDefaultPaymentMethod(
        subscription.stripeCustomerId,
        paymentMethodId
      );
    }

    logger.info('[PaymentService] Payment method added', {
      userId,
      paymentMethodId,
      setAsDefault,
    });

    return this.formatPaymentMethod(paymentMethod, setAsDefault);
  }

  /**
   * Remove a payment method
   */
  async removePaymentMethod(
    userId: string,
    paymentMethodId: string
  ): Promise<void> {
    if (!this.isAvailable()) {
      throw new PaymentServiceError(
        'Payment service not available',
        'PAYMENTS_UNAVAILABLE',
        503
      );
    }

    // Verify the payment method belongs to this user
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new PaymentServiceError(
        'No subscription found for user',
        'SUBSCRIPTION_NOT_FOUND',
        404
      );
    }

    const paymentMethods = await stripeProvider.listPaymentMethods(
      subscription.stripeCustomerId
    );

    const belongs = paymentMethods.some((pm) => pm.id === paymentMethodId);
    if (!belongs) {
      throw new PaymentServiceError(
        'Payment method not found for this user',
        'PAYMENT_METHOD_NOT_FOUND',
        404
      );
    }

    await stripeProvider.detachPaymentMethod(paymentMethodId);

    logger.info('[PaymentService] Payment method removed', {
      userId,
      paymentMethodId,
    });
  }

  /**
   * List payment methods for user
   */
  async listPaymentMethods(userId: string): Promise<PaymentMethodData[]> {
    if (!this.isAvailable()) {
      throw new PaymentServiceError(
        'Payment service not available',
        'PAYMENTS_UNAVAILABLE',
        503
      );
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new PaymentServiceError(
        'No subscription found for user',
        'SUBSCRIPTION_NOT_FOUND',
        404
      );
    }

    const [paymentMethods, customer] = await Promise.all([
      stripeProvider.listPaymentMethods(subscription.stripeCustomerId),
      stripeProvider.getCustomer(subscription.stripeCustomerId),
    ]);

    const defaultId =
      typeof customer.invoice_settings?.default_payment_method === 'string'
        ? customer.invoice_settings.default_payment_method
        : customer.invoice_settings?.default_payment_method?.id;

    return paymentMethods.map((pm) =>
      this.formatPaymentMethod(pm, pm.id === defaultId)
    );
  }

  /**
   * Set default payment method
   */
  async setDefaultPaymentMethod(
    userId: string,
    paymentMethodId: string
  ): Promise<void> {
    if (!this.isAvailable()) {
      throw new PaymentServiceError(
        'Payment service not available',
        'PAYMENTS_UNAVAILABLE',
        503
      );
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new PaymentServiceError(
        'No subscription found for user',
        'SUBSCRIPTION_NOT_FOUND',
        404
      );
    }

    await stripeProvider.setDefaultPaymentMethod(
      subscription.stripeCustomerId,
      paymentMethodId
    );

    logger.info('[PaymentService] Default payment method set', {
      userId,
      paymentMethodId,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SUBSCRIPTIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Get subscription for user
   */
  async getSubscription(userId: string): Promise<SubscriptionData | null> {
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

  /**
   * Create or upgrade subscription
   */
  async createSubscription(
    input: CreateSubscriptionInput
  ): Promise<SubscriptionData> {
    if (!this.isAvailable()) {
      throw new PaymentServiceError(
        'Payment service not available',
        'PAYMENTS_UNAVAILABLE',
        503
      );
    }

    const { userId, email, name, tier, paymentMethodId, billingCycle, trialDays } = input;

    // Get tier configuration
    const tierConfig = TIER_CONFIGS[tier];
    const priceId =
      billingCycle === 'yearly'
        ? tierConfig.stripePriceIdYearly
        : tierConfig.stripePriceIdMonthly;

    if (tier !== SubscriptionTier.FREE && !priceId) {
      throw new PaymentServiceError(
        `Price ID not configured for ${tier} ${billingCycle}`,
        'PRICE_NOT_CONFIGURED',
        500
      );
    }

    // Get or create customer
    const customerId = await this.getOrCreateCustomer(userId, email, name);

    // Attach payment method and set as default
    await stripeProvider.attachPaymentMethod(paymentMethodId, customerId);
    await stripeProvider.setDefaultPaymentMethod(customerId, paymentMethodId);

    // Check existing subscription
    const existingSubscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!existingSubscription) {
      throw new PaymentServiceError(
        'Subscription record not found',
        'SUBSCRIPTION_NOT_FOUND',
        404
      );
    }

    // If upgrading from FREE, create Stripe subscription
    if (tier === SubscriptionTier.FREE) {
      throw new PaymentServiceError(
        'Cannot create subscription for FREE tier',
        'INVALID_TIER',
        400
      );
    }

    // Cancel existing Stripe subscription if any
    if (existingSubscription.stripeSubscriptionId) {
      await stripeProvider.cancelSubscription(
        existingSubscription.stripeSubscriptionId,
        true
      );
    }

    // Create new Stripe subscription
    const subscriptionParams: Stripe.SubscriptionCreateParams = {
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

    // Update database
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

  /**
   * Update subscription tier
   */
  async updateSubscription(
    input: UpdateSubscriptionInput
  ): Promise<SubscriptionData> {
    if (!this.isAvailable()) {
      throw new PaymentServiceError(
        'Payment service not available',
        'PAYMENTS_UNAVAILABLE',
        503
      );
    }

    const { userId, tier, billingCycle = 'monthly', prorationBehavior = 'create_prorations' } = input;

    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new PaymentServiceError(
        'No subscription found for user',
        'SUBSCRIPTION_NOT_FOUND',
        404
      );
    }

    // Get tier configuration
    const tierConfig = TIER_CONFIGS[tier];
    const priceId =
      billingCycle === 'yearly'
        ? tierConfig.stripePriceIdYearly
        : tierConfig.stripePriceIdMonthly;

    // Downgrade to FREE - cancel subscription
    if (tier === SubscriptionTier.FREE) {
      if (subscription.stripeSubscriptionId) {
        await stripeProvider.cancelSubscription(
          subscription.stripeSubscriptionId,
          false // at period end
        );
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

    // Upgrade/change paid tier
    if (!priceId) {
      throw new PaymentServiceError(
        `Price ID not configured for ${tier} ${billingCycle}`,
        'PRICE_NOT_CONFIGURED',
        500
      );
    }

    if (!subscription.stripeSubscriptionId) {
      throw new PaymentServiceError(
        'No active subscription to update',
        'NO_ACTIVE_SUBSCRIPTION',
        400
      );
    }

    // Get current subscription from Stripe
    const stripeSubscription = await stripeProvider.getSubscription(
      subscription.stripeSubscriptionId
    );

    // Update subscription with new price
    const updatedStripeSubscription = await stripeProvider.updateSubscription(
      subscription.stripeSubscriptionId,
      {
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
      }
    );

    // Update database
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

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    userId: string,
    immediately: boolean = false
  ): Promise<SubscriptionData> {
    if (!this.isAvailable()) {
      throw new PaymentServiceError(
        'Payment service not available',
        'PAYMENTS_UNAVAILABLE',
        503
      );
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new PaymentServiceError(
        'No subscription found for user',
        'SUBSCRIPTION_NOT_FOUND',
        404
      );
    }

    if (!subscription.stripeSubscriptionId) {
      throw new PaymentServiceError(
        'No active subscription to cancel',
        'NO_ACTIVE_SUBSCRIPTION',
        400
      );
    }

    const stripeSubscription = await stripeProvider.cancelSubscription(
      subscription.stripeSubscriptionId,
      immediately
    );

    const updateData: Record<string, unknown> = {
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
    } else {
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

  /**
   * Resume a canceled subscription (before period end)
   */
  async resumeSubscription(userId: string): Promise<SubscriptionData> {
    if (!this.isAvailable()) {
      throw new PaymentServiceError(
        'Payment service not available',
        'PAYMENTS_UNAVAILABLE',
        503
      );
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new PaymentServiceError(
        'No subscription found for user',
        'SUBSCRIPTION_NOT_FOUND',
        404
      );
    }

    if (!subscription.stripeSubscriptionId) {
      throw new PaymentServiceError(
        'No subscription to resume',
        'NO_ACTIVE_SUBSCRIPTION',
        400
      );
    }

    if (!subscription.cancelAtPeriodEnd) {
      throw new PaymentServiceError(
        'Subscription is not scheduled for cancellation',
        'NOT_CANCELING',
        400
      );
    }

    const stripeSubscription = await stripeProvider.resumeSubscription(
      subscription.stripeSubscriptionId
    );

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

  // ═══════════════════════════════════════════════════════════════════════════════
  // ONE-TIME PAYMENTS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Create a one-time payment
   */
  async createOneTimePayment(
    input: CreateOneTimePaymentInput
  ): Promise<{ clientSecret: string; paymentIntentId: string }> {
    if (!this.isAvailable()) {
      throw new PaymentServiceError(
        'Payment service not available',
        'PAYMENTS_UNAVAILABLE',
        503
      );
    }

    const { userId, amount, currency = 'usd', description, paymentMethodId, metadata } = input;

    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new PaymentServiceError(
        'No subscription found for user',
        'SUBSCRIPTION_NOT_FOUND',
        404
      );
    }

    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
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

    // Record payment in database
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
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // INVOICES
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * List invoices for user
   */
  async listInvoices(userId: string, limit: number = 10): Promise<InvoiceData[]> {
    if (!this.isAvailable()) {
      throw new PaymentServiceError(
        'Payment service not available',
        'PAYMENTS_UNAVAILABLE',
        503
      );
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new PaymentServiceError(
        'No subscription found for user',
        'SUBSCRIPTION_NOT_FOUND',
        404
      );
    }

    const invoices = await stripeProvider.listInvoices(
      subscription.stripeCustomerId,
      limit
    );

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

  /**
   * Get invoice PDF URL
   */
  async getInvoicePdf(userId: string, invoiceId: string): Promise<string | null> {
    if (!this.isAvailable()) {
      throw new PaymentServiceError(
        'Payment service not available',
        'PAYMENTS_UNAVAILABLE',
        503
      );
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new PaymentServiceError(
        'No subscription found for user',
        'SUBSCRIPTION_NOT_FOUND',
        404
      );
    }

    // Verify invoice belongs to this customer
    const invoice = await stripeProvider.getInvoice(invoiceId);
    if (invoice.customer !== subscription.stripeCustomerId) {
      throw new PaymentServiceError(
        'Invoice not found for this user',
        'INVOICE_NOT_FOUND',
        404
      );
    }

    return invoice.invoice_pdf ?? null;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // USAGE TRACKING
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Check if user has usage capacity
   */
  async checkUsage(
    userId: string,
    type: 'batches' | 'apiCalls' | 'storage',
    amount: number = 1
  ): Promise<{ allowed: boolean; used: number; limit: number; remaining: number }> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      return { allowed: false, used: 0, limit: 0, remaining: 0 };
    }

    let used: number;
    let limit: number;

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

    // -1 means unlimited
    if (limit === -1) {
      return { allowed: true, used, limit, remaining: -1 };
    }

    const remaining = limit - used;
    const allowed = remaining >= amount;

    return { allowed, used, limit, remaining };
  }

  /**
   * Increment usage counter
   */
  async incrementUsage(
    userId: string,
    type: 'batches' | 'apiCalls' | 'storage',
    amount: number = 1
  ): Promise<void> {
    const field =
      type === 'batches'
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

  /**
   * Reset monthly usage counters (called by cron job)
   */
  async resetMonthlyUsage(): Promise<number> {
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

  // ═══════════════════════════════════════════════════════════════════════════════
  // BILLING PORTAL
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Create billing portal session
   */
  async createPortalSession(
    userId: string,
    returnUrl: string
  ): Promise<{ url: string }> {
    if (!this.isAvailable()) {
      throw new PaymentServiceError(
        'Payment service not available',
        'PAYMENTS_UNAVAILABLE',
        503
      );
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new PaymentServiceError(
        'No subscription found for user',
        'SUBSCRIPTION_NOT_FOUND',
        404
      );
    }

    const session = await stripeProvider.createPortalSession(
      subscription.stripeCustomerId,
      returnUrl
    );

    logger.info('[PaymentService] Portal session created', {
      userId,
      sessionUrl: session.url,
    });

    return { url: session.url };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // TIER INFORMATION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Get all tier configurations
   */
  getTierConfigs(): TierConfig[] {
    return Object.values(TIER_CONFIGS);
  }

  /**
   * Get specific tier configuration
   */
  getTierConfig(tier: SubscriptionTier): TierConfig {
    return TIER_CONFIGS[tier];
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
   * Format payment method for response
   */
  private formatPaymentMethod(
    pm: Stripe.PaymentMethod,
    isDefault: boolean
  ): PaymentMethodData {
    return {
      id: pm.id,
      brand: pm.card?.brand || 'unknown',
      last4: pm.card?.last4 || '****',
      expMonth: pm.card?.exp_month || 0,
      expYear: pm.card?.exp_year || 0,
      isDefault,
    };
  }

  /**
   * Map database subscription to SubscriptionData
   */
  private mapSubscriptionToData(subscription: {
    id: string;
    userId: string;
    tier: SubscriptionTier;
    status: SubscriptionStatus;
    stripeCustomerId: string;
    stripeSubscriptionId: string | null;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    batchesUsed: number;
    batchesLimit: number;
    apiCallsUsed: number;
    apiCallsLimit: number;
    storageUsedMb: number;
    storageLimitMb: number;
  }): SubscriptionData {
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

// Export singleton factory
export function createPaymentService(prisma: PrismaClient): PaymentService {
  return new PaymentService(prisma);
}
