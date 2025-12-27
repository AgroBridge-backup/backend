/**
 * @file StripeWebhookHandler Unit Tests
 * @description Comprehensive tests for Stripe webhook event handling
 *
 * Coverage targets:
 * - Webhook signature verification
 * - Subscription events (created, updated, deleted)
 * - Invoice events (payment_succeeded, payment_failed)
 * - Payment intent events
 * - Customer events
 * - Idempotency handling
 * - Error scenarios
 *
 * @author AgroBridge Engineering Team
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { PrismaClient, SubscriptionTier, SubscriptionStatus } from '@prisma/client';
import Stripe from 'stripe';
import {
  StripeWebhookHandler,
  WebhookHandlerError,
  WebhookResult,
  createStripeWebhookHandler,
} from '../../../src/infrastructure/payment/webhooks/StripeWebhookHandler.js';

// ═══════════════════════════════════════════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════════════════════════════════════════

// Mock Stripe Provider
vi.mock('../../../src/infrastructure/payment/providers/StripeProvider.js', () => ({
  stripeProvider: {
    isAvailable: vi.fn().mockReturnValue(true),
    constructWebhookEvent: vi.fn(),
  },
  StripeProviderError: class StripeProviderError extends Error {
    constructor(
      message: string,
      public readonly code: string,
      public readonly statusCode: number = 400
    ) {
      super(message);
      this.name = 'StripeProviderError';
    }
  },
}));

// Mock PaymentService TIER_CONFIGS
vi.mock('../../../src/infrastructure/payment/PaymentService.js', () => ({
  TIER_CONFIGS: {
    FREE: {
      tier: 'FREE',
      name: 'Free',
      priceMonthly: 0,
      priceYearly: 0,
      batchesLimit: 10,
      apiCallsLimit: 100,
      storageLimitMb: 100,
    },
    BASIC: {
      tier: 'BASIC',
      name: 'Basic',
      priceMonthly: 1900,
      priceYearly: 19000,
      batchesLimit: 100,
      apiCallsLimit: 1000,
      storageLimitMb: 1024,
      stripePriceIdMonthly: 'price_basic_monthly',
      stripePriceIdYearly: 'price_basic_yearly',
    },
    PREMIUM: {
      tier: 'PREMIUM',
      name: 'Premium',
      priceMonthly: 4900,
      priceYearly: 49000,
      batchesLimit: 1000,
      apiCallsLimit: 10000,
      storageLimitMb: 10240,
      stripePriceIdMonthly: 'price_premium_monthly',
      stripePriceIdYearly: 'price_premium_yearly',
    },
    ENTERPRISE: {
      tier: 'ENTERPRISE',
      name: 'Enterprise',
      priceMonthly: 50000,
      priceYearly: 500000,
      batchesLimit: -1,
      apiCallsLimit: -1,
      storageLimitMb: -1,
      stripePriceIdMonthly: 'price_enterprise_monthly',
      stripePriceIdYearly: 'price_enterprise_yearly',
    },
  },
}));

// Mock Logger
vi.mock('../../../src/shared/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { stripeProvider, StripeProviderError } from '../../../src/infrastructure/payment/providers/StripeProvider.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TEST FIXTURES
// ═══════════════════════════════════════════════════════════════════════════════

const createMockPrisma = () => {
  return {
    subscription: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
    },
    payment: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
  } as unknown as PrismaClient;
};

const mockSubscriptionRecord = {
  id: 'sub_db_123',
  userId: 'user_123',
  stripeCustomerId: 'cus_123',
  stripeSubscriptionId: 'sub_stripe_123',
  stripePriceId: 'price_basic_monthly',
  tier: SubscriptionTier.BASIC,
  status: SubscriptionStatus.ACTIVE,
  currentPeriodStart: new Date('2024-01-01'),
  currentPeriodEnd: new Date('2024-02-01'),
  cancelAtPeriodEnd: false,
  canceledAt: null,
  trialEnd: null,
  batchesUsed: 5,
  batchesLimit: 100,
  apiCallsUsed: 50,
  apiCallsLimit: 1000,
  storageUsedMb: 100,
  storageLimitMb: 1024,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const createMockEvent = (type: string, data: Record<string, unknown>): Stripe.Event => ({
  id: `evt_${Date.now()}`,
  object: 'event',
  api_version: '2023-10-16',
  created: Math.floor(Date.now() / 1000),
  livemode: false,
  pending_webhooks: 0,
  request: { id: 'req_123', idempotency_key: null },
  type: type as Stripe.Event.Type,
  data: {
    object: data,
  },
} as Stripe.Event);

const mockStripeSubscription: Partial<Stripe.Subscription> = {
  id: 'sub_stripe_123',
  customer: 'cus_123',
  status: 'active',
  cancel_at_period_end: false,
  trial_end: null,
  canceled_at: null,
  items: {
    object: 'list',
    data: [
      {
        id: 'si_123',
        object: 'subscription_item',
        price: {
          id: 'price_basic_monthly',
          object: 'price',
          active: true,
          currency: 'usd',
          product: 'prod_123',
          type: 'recurring',
          unit_amount: 1900,
        } as Stripe.Price,
        quantity: 1,
        subscription: 'sub_stripe_123',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      } as Stripe.SubscriptionItem,
    ],
    has_more: false,
    url: '/v1/subscription_items',
  },
  metadata: {
    userId: 'user_123',
    tier: 'BASIC',
    platform: 'agrobridge',
  },
};

const mockInvoice: Partial<Stripe.Invoice> = {
  id: 'in_123',
  object: 'invoice',
  customer: 'cus_123',
  status: 'paid',
  amount_due: 1900,
  amount_paid: 1900,
  currency: 'usd',
  number: 'INV-001',
  invoice_pdf: 'https://stripe.com/invoice.pdf',
  hosted_invoice_url: 'https://stripe.com/invoice',
  created: Math.floor(Date.now() / 1000),
  description: 'Subscription payment',
  status_transitions: {
    paid_at: Math.floor(Date.now() / 1000),
  } as Stripe.Invoice.StatusTransitions,
};

const mockPaymentIntent: Partial<Stripe.PaymentIntent> = {
  id: 'pi_123',
  object: 'payment_intent',
  amount: 1900,
  currency: 'usd',
  status: 'succeeded',
  customer: 'cus_123',
  latest_charge: 'ch_123',
  metadata: {},
};

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════════════════════

describe('StripeWebhookHandler', () => {
  let webhookHandler: StripeWebhookHandler;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrisma();
    webhookHandler = new StripeWebhookHandler(mockPrisma);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // WEBHOOK SIGNATURE VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Webhook Signature Verification', () => {
    it('should verify valid webhook signature', async () => {
      const event = createMockEvent('customer.subscription.created', mockStripeSubscription);
      (stripeProvider.constructWebhookEvent as Mock).mockReturnValue(event);
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);
      mockPrisma.subscription.update = vi.fn().mockResolvedValue(mockSubscriptionRecord);

      const result = await webhookHandler.handleWebhook('payload', 'valid_signature');

      expect(result.success).toBe(true);
      expect(stripeProvider.constructWebhookEvent).toHaveBeenCalledWith('payload', 'valid_signature');
    });

    it('should throw error for invalid signature', async () => {
      (stripeProvider.constructWebhookEvent as Mock).mockImplementation(() => {
        throw new StripeProviderError('Invalid webhook signature', 'INVALID_WEBHOOK_SIGNATURE', 400);
      });

      await expect(
        webhookHandler.handleWebhook('payload', 'invalid_signature')
      ).rejects.toThrow(WebhookHandlerError);
    });

    it('should throw error when webhook secret is not configured', async () => {
      (stripeProvider.constructWebhookEvent as Mock).mockImplementation(() => {
        throw new StripeProviderError(
          'Stripe webhook secret not configured',
          'WEBHOOK_SECRET_NOT_CONFIGURED',
          500
        );
      });

      await expect(
        webhookHandler.handleWebhook('payload', 'signature')
      ).rejects.toThrow(WebhookHandlerError);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SUBSCRIPTION EVENTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('customer.subscription.created', () => {
    it('should create subscription record in database', async () => {
      const event = createMockEvent('customer.subscription.created', mockStripeSubscription);
      (stripeProvider.constructWebhookEvent as Mock).mockReturnValue(event);
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);
      mockPrisma.subscription.update = vi.fn().mockResolvedValue(mockSubscriptionRecord);

      const result = await webhookHandler.handleWebhook('payload', 'signature');

      expect(result).toMatchObject({
        success: true,
        eventType: 'customer.subscription.created',
        message: 'Subscription created',
      });
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { stripeCustomerId: 'cus_123' },
        data: expect.objectContaining({
          stripeSubscriptionId: 'sub_stripe_123',
          tier: SubscriptionTier.BASIC,
          status: SubscriptionStatus.ACTIVE,
        }),
      });
    });

    it('should handle unknown customer gracefully', async () => {
      const event = createMockEvent('customer.subscription.created', mockStripeSubscription);
      (stripeProvider.constructWebhookEvent as Mock).mockReturnValue(event);
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(null);

      const result = await webhookHandler.handleWebhook('payload', 'signature');

      expect(result).toMatchObject({
        success: true,
        message: 'Customer not found in database',
      });
      expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
    });

    it('should set trial end date if present', async () => {
      const subscriptionWithTrial = {
        ...mockStripeSubscription,
        trial_end: Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60, // 14 days from now
      };
      const event = createMockEvent('customer.subscription.created', subscriptionWithTrial);
      (stripeProvider.constructWebhookEvent as Mock).mockReturnValue(event);
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);
      mockPrisma.subscription.update = vi.fn().mockResolvedValue(mockSubscriptionRecord);

      await webhookHandler.handleWebhook('payload', 'signature');

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            trialEnd: expect.any(Date),
          }),
        })
      );
    });
  });

  describe('customer.subscription.updated', () => {
    it('should update subscription tier and status', async () => {
      const updatedSubscription = {
        ...mockStripeSubscription,
        metadata: { ...mockStripeSubscription.metadata, tier: 'PREMIUM' },
        items: {
          ...mockStripeSubscription.items,
          data: [
            {
              ...mockStripeSubscription.items!.data[0],
              price: { id: 'price_premium_monthly' },
            },
          ],
        },
      };
      const event = createMockEvent('customer.subscription.updated', updatedSubscription);
      (stripeProvider.constructWebhookEvent as Mock).mockReturnValue(event);
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);
      mockPrisma.subscription.update = vi.fn().mockResolvedValue({
        ...mockSubscriptionRecord,
        tier: SubscriptionTier.PREMIUM,
      });

      const result = await webhookHandler.handleWebhook('payload', 'signature');

      expect(result.success).toBe(true);
      expect(result.data?.tier).toBe(SubscriptionTier.PREMIUM);
    });

    it('should handle subscription cancellation scheduled', async () => {
      const cancelingSubscription = {
        ...mockStripeSubscription,
        cancel_at_period_end: true,
        canceled_at: Math.floor(Date.now() / 1000),
      };
      const event = createMockEvent('customer.subscription.updated', cancelingSubscription);
      (stripeProvider.constructWebhookEvent as Mock).mockReturnValue(event);
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);
      mockPrisma.subscription.update = vi.fn().mockResolvedValue({
        ...mockSubscriptionRecord,
        cancelAtPeriodEnd: true,
      });

      await webhookHandler.handleWebhook('payload', 'signature');

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cancelAtPeriodEnd: true,
            canceledAt: expect.any(Date),
          }),
        })
      );
    });

    it('should update subscription status to past_due', async () => {
      const pastDueSubscription = {
        ...mockStripeSubscription,
        status: 'past_due',
      };
      const event = createMockEvent('customer.subscription.updated', pastDueSubscription);
      (stripeProvider.constructWebhookEvent as Mock).mockReturnValue(event);
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);
      mockPrisma.subscription.update = vi.fn().mockResolvedValue({
        ...mockSubscriptionRecord,
        status: SubscriptionStatus.PAST_DUE,
      });

      await webhookHandler.handleWebhook('payload', 'signature');

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: SubscriptionStatus.PAST_DUE,
          }),
        })
      );
    });
  });

  describe('customer.subscription.deleted', () => {
    it('should revert subscription to FREE tier', async () => {
      const event = createMockEvent('customer.subscription.deleted', mockStripeSubscription);
      (stripeProvider.constructWebhookEvent as Mock).mockReturnValue(event);
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);
      mockPrisma.subscription.update = vi.fn().mockResolvedValue({
        ...mockSubscriptionRecord,
        tier: SubscriptionTier.FREE,
        status: SubscriptionStatus.CANCELED,
      });

      const result = await webhookHandler.handleWebhook('payload', 'signature');

      expect(result.message).toContain('FREE tier');
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { stripeCustomerId: 'cus_123' },
        data: expect.objectContaining({
          stripeSubscriptionId: null,
          stripePriceId: null,
          tier: SubscriptionTier.FREE,
          status: SubscriptionStatus.CANCELED,
          batchesLimit: 10,
          apiCallsLimit: 100,
          storageLimitMb: 100,
        }),
      });
    });

    it('should handle already deleted subscription', async () => {
      const event = createMockEvent('customer.subscription.deleted', mockStripeSubscription);
      (stripeProvider.constructWebhookEvent as Mock).mockReturnValue(event);
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(null);

      const result = await webhookHandler.handleWebhook('payload', 'signature');

      expect(result.success).toBe(true);
      expect(result.message).toContain('not found');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // INVOICE EVENTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('invoice.payment_succeeded', () => {
    it('should record successful payment and reset usage', async () => {
      const invoiceWithPayment = {
        ...mockInvoice,
        payment_intent: 'pi_123',
      };
      const event = createMockEvent('invoice.payment_succeeded', invoiceWithPayment);
      (stripeProvider.constructWebhookEvent as Mock).mockReturnValue(event);
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);
      mockPrisma.payment.upsert = vi.fn().mockResolvedValue({});
      mockPrisma.subscription.update = vi.fn().mockResolvedValue(mockSubscriptionRecord);

      const result = await webhookHandler.handleWebhook('payload', 'signature');

      expect(result.success).toBe(true);
      expect(mockPrisma.payment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stripePaymentIntentId: 'pi_123' },
          create: expect.objectContaining({
            status: 'succeeded',
            amount: 1900,
          }),
        })
      );
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: SubscriptionStatus.ACTIVE,
            batchesUsed: 0,
            apiCallsUsed: 0,
          }),
        })
      );
    });

    it('should handle invoice without payment intent', async () => {
      const invoiceWithoutPayment = { ...mockInvoice };
      delete (invoiceWithoutPayment as Record<string, unknown>).payment_intent;
      const event = createMockEvent('invoice.payment_succeeded', invoiceWithoutPayment);
      (stripeProvider.constructWebhookEvent as Mock).mockReturnValue(event);
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);
      mockPrisma.subscription.update = vi.fn().mockResolvedValue(mockSubscriptionRecord);

      const result = await webhookHandler.handleWebhook('payload', 'signature');

      expect(result.success).toBe(true);
      expect(mockPrisma.payment.upsert).not.toHaveBeenCalled();
    });

    it('should handle invoice for unknown customer', async () => {
      const event = createMockEvent('invoice.payment_succeeded', mockInvoice);
      (stripeProvider.constructWebhookEvent as Mock).mockReturnValue(event);
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(null);

      const result = await webhookHandler.handleWebhook('payload', 'signature');

      expect(result.success).toBe(true);
      expect(result.message).toContain('not found');
    });
  });

  describe('invoice.payment_failed', () => {
    it('should record failed payment and update status to PAST_DUE', async () => {
      const failedInvoice = {
        ...mockInvoice,
        status: 'open',
        payment_intent: 'pi_123',
        last_finalization_error: {
          message: 'Card declined',
        },
      };
      const event = createMockEvent('invoice.payment_failed', failedInvoice);
      (stripeProvider.constructWebhookEvent as Mock).mockReturnValue(event);
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);
      mockPrisma.payment.upsert = vi.fn().mockResolvedValue({});
      mockPrisma.subscription.update = vi.fn().mockResolvedValue({
        ...mockSubscriptionRecord,
        status: SubscriptionStatus.PAST_DUE,
      });

      const result = await webhookHandler.handleWebhook('payload', 'signature');

      expect(result.success).toBe(true);
      expect(mockPrisma.payment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            status: 'failed',
            failureMessage: 'Card declined',
          }),
          update: expect.objectContaining({
            status: 'failed',
          }),
        })
      );
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: SubscriptionStatus.PAST_DUE },
        })
      );
    });

    it('should handle invoice without customer', async () => {
      const invoiceWithoutCustomer = { ...mockInvoice, customer: null };
      const event = createMockEvent('invoice.payment_failed', invoiceWithoutCustomer);
      (stripeProvider.constructWebhookEvent as Mock).mockReturnValue(event);

      const result = await webhookHandler.handleWebhook('payload', 'signature');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Invoice has no customer');
    });
  });

  describe('invoice.finalized', () => {
    it('should log invoice finalization', async () => {
      const event = createMockEvent('invoice.finalized', mockInvoice);
      (stripeProvider.constructWebhookEvent as Mock).mockReturnValue(event);

      const result = await webhookHandler.handleWebhook('payload', 'signature');

      expect(result).toMatchObject({
        success: true,
        eventType: 'invoice.finalized',
        message: 'Invoice finalized',
        data: {
          invoiceId: 'in_123',
          number: 'INV-001',
        },
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // PAYMENT INTENT EVENTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('payment_intent.succeeded', () => {
    it('should update payment record to succeeded', async () => {
      const event = createMockEvent('payment_intent.succeeded', mockPaymentIntent);
      (stripeProvider.constructWebhookEvent as Mock).mockReturnValue(event);
      mockPrisma.payment.findUnique = vi.fn().mockResolvedValue({
        id: 'pay_123',
        stripePaymentIntentId: 'pi_123',
      });
      mockPrisma.payment.update = vi.fn().mockResolvedValue({});

      const result = await webhookHandler.handleWebhook('payload', 'signature');

      expect(result.success).toBe(true);
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay_123' },
        data: expect.objectContaining({
          status: 'succeeded',
        }),
      });
    });

    it('should handle payment intent without existing record', async () => {
      const event = createMockEvent('payment_intent.succeeded', mockPaymentIntent);
      (stripeProvider.constructWebhookEvent as Mock).mockReturnValue(event);
      mockPrisma.payment.findUnique = vi.fn().mockResolvedValue(null);

      const result = await webhookHandler.handleWebhook('payload', 'signature');

      expect(result.success).toBe(true);
      expect(mockPrisma.payment.update).not.toHaveBeenCalled();
    });
  });

  describe('payment_intent.payment_failed', () => {
    it('should update payment record with failure details', async () => {
      const failedPaymentIntent = {
        ...mockPaymentIntent,
        status: 'requires_payment_method',
        last_payment_error: {
          code: 'card_declined',
          message: 'Your card was declined.',
        },
      };
      const event = createMockEvent('payment_intent.payment_failed', failedPaymentIntent);
      (stripeProvider.constructWebhookEvent as Mock).mockReturnValue(event);
      mockPrisma.payment.findUnique = vi.fn().mockResolvedValue({
        id: 'pay_123',
        stripePaymentIntentId: 'pi_123',
      });
      mockPrisma.payment.update = vi.fn().mockResolvedValue({});

      const result = await webhookHandler.handleWebhook('payload', 'signature');

      expect(result.success).toBe(true);
      expect(result.data?.errorCode).toBe('card_declined');
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay_123' },
        data: expect.objectContaining({
          status: 'failed',
          failureCode: 'card_declined',
          failureMessage: 'Your card was declined.',
        }),
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // CUSTOMER EVENTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('customer.updated', () => {
    it('should log customer update event', async () => {
      const customer = {
        id: 'cus_123',
        email: 'updated@test.com',
        name: 'Updated Name',
      };
      const event = createMockEvent('customer.updated', customer);
      (stripeProvider.constructWebhookEvent as Mock).mockReturnValue(event);

      const result = await webhookHandler.handleWebhook('payload', 'signature');

      expect(result).toMatchObject({
        success: true,
        eventType: 'customer.updated',
        data: { customerId: 'cus_123' },
      });
    });
  });

  describe('customer.deleted', () => {
    it('should cancel subscription when customer is deleted', async () => {
      const deletedCustomer = { id: 'cus_123', deleted: true };
      const event = createMockEvent('customer.deleted', deletedCustomer);
      (stripeProvider.constructWebhookEvent as Mock).mockReturnValue(event);
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);
      mockPrisma.subscription.update = vi.fn().mockResolvedValue({
        ...mockSubscriptionRecord,
        status: SubscriptionStatus.CANCELED,
      });

      const result = await webhookHandler.handleWebhook('payload', 'signature');

      expect(result.success).toBe(true);
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: SubscriptionStatus.CANCELED,
            tier: SubscriptionTier.FREE,
            stripeSubscriptionId: null,
          }),
        })
      );
    });

    it('should handle deletion of non-existent customer', async () => {
      const deletedCustomer = { id: 'cus_unknown', deleted: true };
      const event = createMockEvent('customer.deleted', deletedCustomer);
      (stripeProvider.constructWebhookEvent as Mock).mockReturnValue(event);
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(null);

      const result = await webhookHandler.handleWebhook('payload', 'signature');

      expect(result.success).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // CHECKOUT SESSION EVENTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('checkout.session.completed', () => {
    it('should log checkout session completion', async () => {
      const session = {
        id: 'cs_123',
        mode: 'subscription',
        customer: 'cus_123',
        subscription: 'sub_123',
      };
      const event = createMockEvent('checkout.session.completed', session);
      (stripeProvider.constructWebhookEvent as Mock).mockReturnValue(event);

      const result = await webhookHandler.handleWebhook('payload', 'signature');

      expect(result).toMatchObject({
        success: true,
        eventType: 'checkout.session.completed',
        data: {
          sessionId: 'cs_123',
          mode: 'subscription',
        },
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // UNHANDLED EVENTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Unhandled Events', () => {
    it('should acknowledge unhandled event types', async () => {
      const event = createMockEvent('charge.captured', { id: 'ch_123' });
      (stripeProvider.constructWebhookEvent as Mock).mockReturnValue(event);

      const result = await webhookHandler.handleWebhook('payload', 'signature');

      expect(result).toMatchObject({
        success: true,
        eventType: 'charge.captured',
        message: 'Event received but not processed',
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // ERROR HANDLING
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const event = createMockEvent('customer.subscription.created', mockStripeSubscription);
      (stripeProvider.constructWebhookEvent as Mock).mockReturnValue(event);
      mockPrisma.subscription.findUnique = vi.fn().mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(
        webhookHandler.handleWebhook('payload', 'signature')
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle update failures', async () => {
      const event = createMockEvent('customer.subscription.updated', mockStripeSubscription);
      (stripeProvider.constructWebhookEvent as Mock).mockReturnValue(event);
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);
      mockPrisma.subscription.update = vi.fn().mockRejectedValue(
        new Error('Update failed')
      );

      await expect(
        webhookHandler.handleWebhook('payload', 'signature')
      ).rejects.toThrow('Update failed');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TIER DETECTION
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Tier Detection', () => {
    it('should detect tier from subscription metadata', async () => {
      const subscriptionWithPremiumMeta = {
        ...mockStripeSubscription,
        metadata: { tier: 'premium', userId: 'user_123' },
      };
      const event = createMockEvent('customer.subscription.created', subscriptionWithPremiumMeta);
      (stripeProvider.constructWebhookEvent as Mock).mockReturnValue(event);
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);
      mockPrisma.subscription.update = vi.fn().mockResolvedValue({
        ...mockSubscriptionRecord,
        tier: SubscriptionTier.PREMIUM,
      });

      await webhookHandler.handleWebhook('payload', 'signature');

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tier: SubscriptionTier.PREMIUM,
          }),
        })
      );
    });

    it('should detect tier from price ID when metadata missing', async () => {
      const subscriptionWithoutMeta = {
        ...mockStripeSubscription,
        metadata: {},
        items: {
          ...mockStripeSubscription.items,
          data: [
            {
              ...mockStripeSubscription.items!.data[0],
              price: { id: 'price_premium_monthly' },
            },
          ],
        },
      };
      const event = createMockEvent('customer.subscription.created', subscriptionWithoutMeta);
      (stripeProvider.constructWebhookEvent as Mock).mockReturnValue(event);
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);
      mockPrisma.subscription.update = vi.fn().mockResolvedValue({
        ...mockSubscriptionRecord,
        tier: SubscriptionTier.PREMIUM,
      });

      await webhookHandler.handleWebhook('payload', 'signature');

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tier: SubscriptionTier.PREMIUM,
          }),
        })
      );
    });

    it('should default to FREE tier when tier cannot be determined', async () => {
      const subscriptionWithUnknownPrice = {
        ...mockStripeSubscription,
        metadata: {},
        items: {
          ...mockStripeSubscription.items,
          data: [
            {
              ...mockStripeSubscription.items!.data[0],
              price: { id: 'price_unknown' },
            },
          ],
        },
      };
      const event = createMockEvent('customer.subscription.created', subscriptionWithUnknownPrice);
      (stripeProvider.constructWebhookEvent as Mock).mockReturnValue(event);
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);
      mockPrisma.subscription.update = vi.fn().mockResolvedValue({
        ...mockSubscriptionRecord,
        tier: SubscriptionTier.FREE,
      });

      await webhookHandler.handleWebhook('payload', 'signature');

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tier: SubscriptionTier.FREE,
          }),
        })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // FACTORY FUNCTION
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('createStripeWebhookHandler', () => {
    it('should create webhook handler instance', () => {
      const handler = createStripeWebhookHandler(mockPrisma);
      expect(handler).toBeInstanceOf(StripeWebhookHandler);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// IDEMPOTENCY TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('StripeWebhookHandler - Idempotency', () => {
  let webhookHandler: StripeWebhookHandler;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrisma();
    webhookHandler = new StripeWebhookHandler(mockPrisma);
  });

  it('should handle duplicate subscription.created events', async () => {
    const event = createMockEvent('customer.subscription.created', mockStripeSubscription);
    (stripeProvider.constructWebhookEvent as Mock).mockReturnValue(event);
    mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue({
      ...mockSubscriptionRecord,
      stripeSubscriptionId: 'sub_stripe_123', // Already has this subscription
    });
    mockPrisma.subscription.update = vi.fn().mockResolvedValue(mockSubscriptionRecord);

    // Process same event twice
    await webhookHandler.handleWebhook('payload', 'signature');
    await webhookHandler.handleWebhook('payload', 'signature');

    // Should still succeed (idempotent update)
    expect(mockPrisma.subscription.update).toHaveBeenCalledTimes(2);
  });

  it('should handle duplicate payment events via upsert', async () => {
    const invoiceWithPayment = {
      ...mockInvoice,
      payment_intent: 'pi_123',
    };
    const event = createMockEvent('invoice.payment_succeeded', invoiceWithPayment);
    (stripeProvider.constructWebhookEvent as Mock).mockReturnValue(event);
    mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);
    mockPrisma.payment.upsert = vi.fn().mockResolvedValue({});
    mockPrisma.subscription.update = vi.fn().mockResolvedValue(mockSubscriptionRecord);

    // Process same event twice
    await webhookHandler.handleWebhook('payload', 'signature');
    await webhookHandler.handleWebhook('payload', 'signature');

    // Should use upsert to handle duplicates
    expect(mockPrisma.payment.upsert).toHaveBeenCalledTimes(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS MAPPING TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('StripeWebhookHandler - Status Mapping', () => {
  let webhookHandler: StripeWebhookHandler;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrisma();
    webhookHandler = new StripeWebhookHandler(mockPrisma);
  });

  const statusMappings: Array<{ stripeStatus: string; expectedStatus: SubscriptionStatus }> = [
    { stripeStatus: 'active', expectedStatus: SubscriptionStatus.ACTIVE },
    { stripeStatus: 'past_due', expectedStatus: SubscriptionStatus.PAST_DUE },
    { stripeStatus: 'canceled', expectedStatus: SubscriptionStatus.CANCELED },
    { stripeStatus: 'incomplete', expectedStatus: SubscriptionStatus.INCOMPLETE },
    { stripeStatus: 'incomplete_expired', expectedStatus: SubscriptionStatus.INCOMPLETE_EXPIRED },
    { stripeStatus: 'trialing', expectedStatus: SubscriptionStatus.TRIALING },
    { stripeStatus: 'unpaid', expectedStatus: SubscriptionStatus.UNPAID },
    { stripeStatus: 'paused', expectedStatus: SubscriptionStatus.PAUSED },
  ];

  statusMappings.forEach(({ stripeStatus, expectedStatus }) => {
    it(`should map Stripe status '${stripeStatus}' to '${expectedStatus}'`, async () => {
      const subscriptionWithStatus = {
        ...mockStripeSubscription,
        status: stripeStatus,
      };
      const event = createMockEvent('customer.subscription.updated', subscriptionWithStatus);
      (stripeProvider.constructWebhookEvent as Mock).mockReturnValue(event);
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);
      mockPrisma.subscription.update = vi.fn().mockResolvedValue(mockSubscriptionRecord);

      await webhookHandler.handleWebhook('payload', 'signature');

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: expectedStatus,
          }),
        })
      );
    });
  });
});
