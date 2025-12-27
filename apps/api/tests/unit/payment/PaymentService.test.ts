/**
 * @file PaymentService Unit Tests
 * @description Comprehensive tests for PaymentService - subscription & payment operations
 *
 * Coverage targets:
 * - Customer management
 * - Payment method operations
 * - Subscription lifecycle (create, update, cancel, resume)
 * - One-time payments
 * - Usage tracking
 * - Error handling
 *
 * @author AgroBridge Engineering Team
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';

// Hoist env vars to run BEFORE any module imports (including PaymentService)
vi.hoisted(() => {
  process.env.STRIPE_BASIC_MONTHLY_PRICE_ID = 'price_basic_monthly_test';
  process.env.STRIPE_BASIC_YEARLY_PRICE_ID = 'price_basic_yearly_test';
  process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID = 'price_premium_monthly_test';
  process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID = 'price_premium_yearly_test';
  process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID = 'price_enterprise_monthly_test';
  process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID = 'price_enterprise_yearly_test';
});
import { PrismaClient, SubscriptionTier, SubscriptionStatus } from '@prisma/client';
import {
  PaymentService,
  PaymentServiceError,
  TIER_CONFIGS,
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
  CreateOneTimePaymentInput,
} from '../../../src/infrastructure/payment/PaymentService.js';

// ═══════════════════════════════════════════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════════════════════════════════════════

// Mock Stripe Provider
vi.mock('../../../src/infrastructure/payment/providers/StripeProvider.js', () => ({
  stripeProvider: {
    isAvailable: vi.fn().mockReturnValue(true),
    createCustomer: vi.fn(),
    getCustomer: vi.fn(),
    updateCustomer: vi.fn(),
    deleteCustomer: vi.fn(),
    attachPaymentMethod: vi.fn(),
    detachPaymentMethod: vi.fn(),
    listPaymentMethods: vi.fn(),
    setDefaultPaymentMethod: vi.fn(),
    createSubscription: vi.fn(),
    getSubscription: vi.fn(),
    updateSubscription: vi.fn(),
    cancelSubscription: vi.fn(),
    resumeSubscription: vi.fn(),
    createPaymentIntent: vi.fn(),
    getPaymentIntent: vi.fn(),
    listInvoices: vi.fn(),
    getInvoice: vi.fn(),
    createPortalSession: vi.fn(),
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

// Mock Logger
vi.mock('../../../src/shared/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import mocked modules
import { stripeProvider } from '../../../src/infrastructure/payment/providers/StripeProvider.js';

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
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  } as unknown as PrismaClient;
};

const mockSubscriptionRecord = {
  id: 'sub_123',
  userId: 'user_123',
  stripeCustomerId: 'cus_123',
  stripeSubscriptionId: 'stripe_sub_123',
  stripePriceId: 'price_123',
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

const mockStripeCustomer = {
  id: 'cus_123',
  email: 'test@agrobridge.io',
  name: 'Test Producer',
  invoice_settings: {
    default_payment_method: 'pm_123',
  },
};

const mockPaymentMethod = {
  id: 'pm_123',
  type: 'card',
  card: {
    brand: 'visa',
    last4: '4242',
    exp_month: 12,
    exp_year: 2025,
  },
};

const mockStripeSubscription = {
  id: 'stripe_sub_123',
  customer: 'cus_123',
  status: 'active',
  cancel_at_period_end: false,
  trial_end: null,
  items: {
    data: [
      {
        id: 'si_123',
        price: { id: 'price_123' },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      },
    ],
  },
  metadata: {
    userId: 'user_123',
    tier: 'BASIC',
    platform: 'agrobridge',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════════════════════

describe('PaymentService', () => {
  let paymentService: PaymentService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrisma();
    paymentService = new PaymentService(mockPrisma);

    // Default mock implementations
    (stripeProvider.isAvailable as Mock).mockReturnValue(true);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // AVAILABILITY TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('isAvailable', () => {
    it('should return true when Stripe is configured', () => {
      (stripeProvider.isAvailable as Mock).mockReturnValue(true);
      expect(paymentService.isAvailable()).toBe(true);
    });

    it('should return false when Stripe is not configured', () => {
      (stripeProvider.isAvailable as Mock).mockReturnValue(false);
      expect(paymentService.isAvailable()).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // CUSTOMER MANAGEMENT TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('getOrCreateCustomer', () => {
    it('should return existing customer ID if subscription exists', async () => {
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);

      const result = await paymentService.getOrCreateCustomer(
        'user_123',
        'test@agrobridge.io',
        'Test Producer'
      );

      expect(result).toBe('cus_123');
      expect(stripeProvider.createCustomer).not.toHaveBeenCalled();
    });

    it('should create new Stripe customer and subscription if none exists', async () => {
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(null);
      mockPrisma.subscription.create = vi.fn().mockResolvedValue(mockSubscriptionRecord);
      (stripeProvider.createCustomer as Mock).mockResolvedValue(mockStripeCustomer);

      const result = await paymentService.getOrCreateCustomer(
        'user_123',
        'test@agrobridge.io',
        'Test Producer'
      );

      expect(result).toBe('cus_123');
      expect(stripeProvider.createCustomer).toHaveBeenCalledWith({
        email: 'test@agrobridge.io',
        name: 'Test Producer',
        metadata: {
          userId: 'user_123',
          platform: 'agrobridge',
        },
      });
      expect(mockPrisma.subscription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user_123',
          stripeCustomerId: 'cus_123',
          tier: SubscriptionTier.FREE,
          status: SubscriptionStatus.ACTIVE,
        }),
      });
    });

    it('should throw PaymentServiceError when Stripe is unavailable', async () => {
      (stripeProvider.isAvailable as Mock).mockReturnValue(false);

      await expect(
        paymentService.getOrCreateCustomer('user_123', 'test@agrobridge.io', 'Test')
      ).rejects.toThrow(PaymentServiceError);
    });
  });

  describe('updateCustomer', () => {
    it('should update customer details in Stripe', async () => {
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);
      (stripeProvider.updateCustomer as Mock).mockResolvedValue(mockStripeCustomer);

      await paymentService.updateCustomer('user_123', {
        email: 'new@agrobridge.io',
        name: 'New Name',
      });

      expect(stripeProvider.updateCustomer).toHaveBeenCalledWith('cus_123', {
        email: 'new@agrobridge.io',
        name: 'New Name',
      });
    });

    it('should throw error if subscription not found', async () => {
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(null);

      await expect(
        paymentService.updateCustomer('user_123', { email: 'new@test.com' })
      ).rejects.toThrow(PaymentServiceError);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // PAYMENT METHOD TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('addPaymentMethod', () => {
    it('should attach payment method and set as default', async () => {
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);
      (stripeProvider.attachPaymentMethod as Mock).mockResolvedValue(mockPaymentMethod);
      (stripeProvider.setDefaultPaymentMethod as Mock).mockResolvedValue(mockStripeCustomer);

      const result = await paymentService.addPaymentMethod('user_123', 'pm_new', true);

      expect(result).toMatchObject({
        id: 'pm_123',
        brand: 'visa',
        last4: '4242',
        isDefault: true,
      });
      expect(stripeProvider.attachPaymentMethod).toHaveBeenCalledWith('pm_new', 'cus_123');
      expect(stripeProvider.setDefaultPaymentMethod).toHaveBeenCalledWith('cus_123', 'pm_new');
    });

    it('should attach payment method without setting as default', async () => {
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);
      (stripeProvider.attachPaymentMethod as Mock).mockResolvedValue(mockPaymentMethod);

      await paymentService.addPaymentMethod('user_123', 'pm_new', false);

      expect(stripeProvider.attachPaymentMethod).toHaveBeenCalled();
      expect(stripeProvider.setDefaultPaymentMethod).not.toHaveBeenCalled();
    });

    it('should throw error if subscription not found', async () => {
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(null);

      await expect(
        paymentService.addPaymentMethod('user_123', 'pm_new')
      ).rejects.toThrow(PaymentServiceError);
    });
  });

  describe('removePaymentMethod', () => {
    it('should detach payment method if it belongs to user', async () => {
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);
      (stripeProvider.listPaymentMethods as Mock).mockResolvedValue([mockPaymentMethod]);
      (stripeProvider.detachPaymentMethod as Mock).mockResolvedValue({});

      await paymentService.removePaymentMethod('user_123', 'pm_123');

      expect(stripeProvider.detachPaymentMethod).toHaveBeenCalledWith('pm_123');
    });

    it('should throw error if payment method does not belong to user', async () => {
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);
      (stripeProvider.listPaymentMethods as Mock).mockResolvedValue([]);

      await expect(
        paymentService.removePaymentMethod('user_123', 'pm_other')
      ).rejects.toThrow(PaymentServiceError);
    });
  });

  describe('listPaymentMethods', () => {
    it('should list all payment methods with default indicator', async () => {
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);
      (stripeProvider.listPaymentMethods as Mock).mockResolvedValue([
        mockPaymentMethod,
        { ...mockPaymentMethod, id: 'pm_456', card: { ...mockPaymentMethod.card, last4: '1234' } },
      ]);
      (stripeProvider.getCustomer as Mock).mockResolvedValue(mockStripeCustomer);

      const result = await paymentService.listPaymentMethods('user_123');

      expect(result).toHaveLength(2);
      expect(result[0].isDefault).toBe(true);
      expect(result[1].isDefault).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SUBSCRIPTION TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('getSubscription', () => {
    it('should return subscription data if exists', async () => {
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);

      const result = await paymentService.getSubscription('user_123');

      expect(result).toMatchObject({
        userId: 'user_123',
        tier: SubscriptionTier.BASIC,
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus_123',
      });
    });

    it('should return null if subscription does not exist', async () => {
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(null);

      const result = await paymentService.getSubscription('user_123');

      expect(result).toBeNull();
    });
  });

  describe('createSubscription', () => {
    const validInput: CreateSubscriptionInput = {
      userId: 'user_123',
      email: 'test@agrobridge.io',
      name: 'Test Producer',
      tier: SubscriptionTier.BASIC,
      paymentMethodId: 'pm_123',
      billingCycle: 'monthly',
    };

    beforeEach(() => {
      // Setup common mocks for subscription creation
      mockPrisma.subscription.findUnique = vi.fn()
        .mockResolvedValueOnce(null) // First call in getOrCreateCustomer
        .mockResolvedValueOnce({ ...mockSubscriptionRecord, tier: SubscriptionTier.FREE }); // Second call

      mockPrisma.subscription.create = vi.fn().mockResolvedValue({
        ...mockSubscriptionRecord,
        tier: SubscriptionTier.FREE,
      });

      mockPrisma.subscription.update = vi.fn().mockResolvedValue(mockSubscriptionRecord);

      (stripeProvider.createCustomer as Mock).mockResolvedValue(mockStripeCustomer);
      (stripeProvider.attachPaymentMethod as Mock).mockResolvedValue(mockPaymentMethod);
      (stripeProvider.setDefaultPaymentMethod as Mock).mockResolvedValue(mockStripeCustomer);
      (stripeProvider.createSubscription as Mock).mockResolvedValue(mockStripeSubscription);
    });

    it('should create subscription with valid input', async () => {
      // Reset mocks for this specific test
      mockPrisma.subscription.findUnique = vi.fn()
        .mockResolvedValueOnce(mockSubscriptionRecord) // getOrCreateCustomer finds existing
        .mockResolvedValueOnce({ ...mockSubscriptionRecord, tier: SubscriptionTier.FREE, stripeSubscriptionId: null }); // Second lookup

      const result = await paymentService.createSubscription(validInput);

      expect(result.tier).toBe(SubscriptionTier.BASIC);
      expect(stripeProvider.createSubscription).toHaveBeenCalled();
    });

    it('should throw error for FREE tier subscription creation', async () => {
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);

      await expect(
        paymentService.createSubscription({
          ...validInput,
          tier: SubscriptionTier.FREE,
        })
      ).rejects.toThrow(PaymentServiceError);
    });

    it('should throw error when Stripe is unavailable', async () => {
      (stripeProvider.isAvailable as Mock).mockReturnValue(false);

      await expect(
        paymentService.createSubscription(validInput)
      ).rejects.toThrow(PaymentServiceError);
    });

    it('should support trial period', async () => {
      mockPrisma.subscription.findUnique = vi.fn()
        .mockResolvedValueOnce(mockSubscriptionRecord)
        .mockResolvedValueOnce({ ...mockSubscriptionRecord, tier: SubscriptionTier.FREE, stripeSubscriptionId: null });

      await paymentService.createSubscription({
        ...validInput,
        trialDays: 14,
      });

      expect(stripeProvider.createSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          trial_period_days: 14,
        })
      );
    });
  });

  describe('updateSubscription', () => {
    const validInput: UpdateSubscriptionInput = {
      userId: 'user_123',
      tier: SubscriptionTier.PREMIUM,
      billingCycle: 'monthly',
    };

    beforeEach(() => {
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);
      mockPrisma.subscription.update = vi.fn().mockResolvedValue({
        ...mockSubscriptionRecord,
        tier: SubscriptionTier.PREMIUM,
      });
      (stripeProvider.getSubscription as Mock).mockResolvedValue(mockStripeSubscription);
      (stripeProvider.updateSubscription as Mock).mockResolvedValue({
        ...mockStripeSubscription,
        metadata: { ...mockStripeSubscription.metadata, tier: 'PREMIUM' },
      });
    });

    it('should update subscription tier', async () => {
      const result = await paymentService.updateSubscription(validInput);

      expect(result.tier).toBe(SubscriptionTier.PREMIUM);
      expect(stripeProvider.updateSubscription).toHaveBeenCalled();
    });

    it('should downgrade to FREE tier by canceling subscription', async () => {
      (stripeProvider.cancelSubscription as Mock).mockResolvedValue({
        ...mockStripeSubscription,
        cancel_at_period_end: true,
      });
      mockPrisma.subscription.update = vi.fn().mockResolvedValue({
        ...mockSubscriptionRecord,
        tier: SubscriptionTier.FREE,
        cancelAtPeriodEnd: true,
      });

      const result = await paymentService.updateSubscription({
        userId: 'user_123',
        tier: SubscriptionTier.FREE,
      });

      expect(result.tier).toBe(SubscriptionTier.FREE);
      expect(result.cancelAtPeriodEnd).toBe(true);
    });

    it('should throw error if no subscription found', async () => {
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(null);

      await expect(
        paymentService.updateSubscription(validInput)
      ).rejects.toThrow(PaymentServiceError);
    });
  });

  describe('cancelSubscription', () => {
    beforeEach(() => {
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);
      (stripeProvider.cancelSubscription as Mock).mockResolvedValue({
        ...mockStripeSubscription,
        cancel_at_period_end: true,
        status: 'active',
      });
    });

    it('should cancel subscription at period end by default', async () => {
      mockPrisma.subscription.update = vi.fn().mockResolvedValue({
        ...mockSubscriptionRecord,
        cancelAtPeriodEnd: true,
        canceledAt: new Date(),
      });

      const result = await paymentService.cancelSubscription('user_123');

      expect(result.cancelAtPeriodEnd).toBe(true);
      expect(stripeProvider.cancelSubscription).toHaveBeenCalledWith('stripe_sub_123', false);
    });

    it('should cancel subscription immediately when specified', async () => {
      (stripeProvider.cancelSubscription as Mock).mockResolvedValue({
        ...mockStripeSubscription,
        status: 'canceled',
      });
      mockPrisma.subscription.update = vi.fn().mockResolvedValue({
        ...mockSubscriptionRecord,
        status: SubscriptionStatus.CANCELED,
        tier: SubscriptionTier.FREE,
        stripeSubscriptionId: null,
      });

      const result = await paymentService.cancelSubscription('user_123', true);

      expect(result.status).toBe(SubscriptionStatus.CANCELED);
      expect(stripeProvider.cancelSubscription).toHaveBeenCalledWith('stripe_sub_123', true);
    });

    it('should throw error if no active subscription', async () => {
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue({
        ...mockSubscriptionRecord,
        stripeSubscriptionId: null,
      });

      await expect(
        paymentService.cancelSubscription('user_123')
      ).rejects.toThrow(PaymentServiceError);
    });
  });

  describe('resumeSubscription', () => {
    it('should resume a canceled subscription', async () => {
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue({
        ...mockSubscriptionRecord,
        cancelAtPeriodEnd: true,
      });
      (stripeProvider.resumeSubscription as Mock).mockResolvedValue({
        ...mockStripeSubscription,
        cancel_at_period_end: false,
      });
      mockPrisma.subscription.update = vi.fn().mockResolvedValue({
        ...mockSubscriptionRecord,
        cancelAtPeriodEnd: false,
        canceledAt: null,
      });

      const result = await paymentService.resumeSubscription('user_123');

      expect(result.cancelAtPeriodEnd).toBe(false);
    });

    it('should throw error if subscription is not canceling', async () => {
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);

      await expect(
        paymentService.resumeSubscription('user_123')
      ).rejects.toThrow(PaymentServiceError);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // ONE-TIME PAYMENT TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('createOneTimePayment', () => {
    const validInput: CreateOneTimePaymentInput = {
      userId: 'user_123',
      amount: 5000, // $50.00
      currency: 'usd',
      description: 'One-time service fee',
    };

    beforeEach(() => {
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);
      mockPrisma.payment.create = vi.fn().mockResolvedValue({
        id: 'pay_123',
        subscriptionId: 'sub_123',
        stripePaymentIntentId: 'pi_123',
        amount: 5000,
        currency: 'usd',
        status: 'requires_payment_method',
      });
      (stripeProvider.createPaymentIntent as Mock).mockResolvedValue({
        id: 'pi_123',
        client_secret: 'pi_123_secret_abc',
        status: 'requires_payment_method',
      });
    });

    it('should create payment intent for one-time payment', async () => {
      const result = await paymentService.createOneTimePayment(validInput);

      expect(result).toMatchObject({
        clientSecret: 'pi_123_secret_abc',
        paymentIntentId: 'pi_123',
      });
      expect(stripeProvider.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 5000,
          currency: 'usd',
          customer: 'cus_123',
        })
      );
    });

    it('should confirm payment immediately if payment method provided', async () => {
      (stripeProvider.createPaymentIntent as Mock).mockResolvedValue({
        id: 'pi_123',
        client_secret: 'pi_123_secret_abc',
        status: 'succeeded',
      });

      await paymentService.createOneTimePayment({
        ...validInput,
        paymentMethodId: 'pm_123',
      });

      expect(stripeProvider.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_method: 'pm_123',
          confirm: true,
        })
      );
    });

    it('should include custom metadata', async () => {
      await paymentService.createOneTimePayment({
        ...validInput,
        metadata: { invoiceId: 'inv_123', orderId: 'ord_456' },
      });

      expect(stripeProvider.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            invoiceId: 'inv_123',
            orderId: 'ord_456',
          }),
        })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // INVOICE TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('listInvoices', () => {
    const mockInvoices = [
      {
        id: 'in_123',
        number: 'INV-001',
        status: 'paid',
        amount_due: 1900,
        currency: 'usd',
        invoice_pdf: 'https://stripe.com/invoice.pdf',
        hosted_invoice_url: 'https://stripe.com/invoice',
        created: Math.floor(Date.now() / 1000),
        status_transitions: { paid_at: Math.floor(Date.now() / 1000) },
      },
    ];

    it('should list invoices for user', async () => {
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);
      (stripeProvider.listInvoices as Mock).mockResolvedValue(mockInvoices);

      const result = await paymentService.listInvoices('user_123', 10);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'in_123',
        number: 'INV-001',
        status: 'paid',
        amount: 1900,
      });
    });
  });

  describe('getInvoicePdf', () => {
    it('should return PDF URL if invoice belongs to user', async () => {
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);
      (stripeProvider.getInvoice as Mock).mockResolvedValue({
        id: 'in_123',
        customer: 'cus_123',
        invoice_pdf: 'https://stripe.com/invoice.pdf',
      });

      const result = await paymentService.getInvoicePdf('user_123', 'in_123');

      expect(result).toBe('https://stripe.com/invoice.pdf');
    });

    it('should throw error if invoice belongs to different customer', async () => {
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);
      (stripeProvider.getInvoice as Mock).mockResolvedValue({
        id: 'in_123',
        customer: 'cus_other',
        invoice_pdf: 'https://stripe.com/invoice.pdf',
      });

      await expect(
        paymentService.getInvoicePdf('user_123', 'in_123')
      ).rejects.toThrow(PaymentServiceError);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // USAGE TRACKING TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('checkUsage', () => {
    it('should return usage stats for batches', async () => {
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);

      const result = await paymentService.checkUsage('user_123', 'batches');

      expect(result).toMatchObject({
        used: 5,
        limit: 100,
        remaining: 95,
        allowed: true,
      });
    });

    it('should return allowed false when limit exceeded', async () => {
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue({
        ...mockSubscriptionRecord,
        batchesUsed: 100,
        batchesLimit: 100,
      });

      const result = await paymentService.checkUsage('user_123', 'batches');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should handle unlimited usage (-1 limit)', async () => {
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue({
        ...mockSubscriptionRecord,
        tier: SubscriptionTier.ENTERPRISE,
        batchesLimit: -1,
      });

      const result = await paymentService.checkUsage('user_123', 'batches');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(-1);
    });

    it('should check with specific amount', async () => {
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue({
        ...mockSubscriptionRecord,
        batchesUsed: 95,
        batchesLimit: 100,
      });

      const result = await paymentService.checkUsage('user_123', 'batches', 10);

      expect(result.allowed).toBe(false); // 95 + 10 > 100
      expect(result.remaining).toBe(5);
    });
  });

  describe('incrementUsage', () => {
    it('should increment batches usage', async () => {
      mockPrisma.subscription.update = vi.fn().mockResolvedValue(mockSubscriptionRecord);

      await paymentService.incrementUsage('user_123', 'batches', 5);

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { userId: 'user_123' },
        data: { batchesUsed: { increment: 5 } },
      });
    });

    it('should increment API calls usage', async () => {
      mockPrisma.subscription.update = vi.fn().mockResolvedValue(mockSubscriptionRecord);

      await paymentService.incrementUsage('user_123', 'apiCalls', 100);

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { userId: 'user_123' },
        data: { apiCallsUsed: { increment: 100 } },
      });
    });

    it('should increment storage usage', async () => {
      mockPrisma.subscription.update = vi.fn().mockResolvedValue(mockSubscriptionRecord);

      await paymentService.incrementUsage('user_123', 'storage', 50);

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { userId: 'user_123' },
        data: { storageUsedMb: { increment: 50 } },
      });
    });
  });

  describe('resetMonthlyUsage', () => {
    it('should reset usage counters for all subscriptions', async () => {
      mockPrisma.subscription.updateMany = vi.fn().mockResolvedValue({ count: 100 });

      const result = await paymentService.resetMonthlyUsage();

      expect(result).toBe(100);
      expect(mockPrisma.subscription.updateMany).toHaveBeenCalledWith({
        data: {
          batchesUsed: 0,
          apiCallsUsed: 0,
        },
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BILLING PORTAL TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('createPortalSession', () => {
    it('should create billing portal session', async () => {
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);
      (stripeProvider.createPortalSession as Mock).mockResolvedValue({
        id: 'bps_123',
        url: 'https://billing.stripe.com/session/abc',
      });

      const result = await paymentService.createPortalSession(
        'user_123',
        'https://agrobridge.io/dashboard'
      );

      expect(result.url).toBe('https://billing.stripe.com/session/abc');
      expect(stripeProvider.createPortalSession).toHaveBeenCalledWith(
        'cus_123',
        'https://agrobridge.io/dashboard'
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TIER CONFIGURATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('getTierConfigs', () => {
    it('should return all tier configurations', () => {
      const configs = paymentService.getTierConfigs();

      expect(configs).toHaveLength(4);
      expect(configs.map((c) => c.tier)).toEqual([
        SubscriptionTier.FREE,
        SubscriptionTier.BASIC,
        SubscriptionTier.PREMIUM,
        SubscriptionTier.ENTERPRISE,
      ]);
    });
  });

  describe('getTierConfig', () => {
    it('should return specific tier configuration', () => {
      const config = paymentService.getTierConfig(SubscriptionTier.PREMIUM);

      expect(config).toMatchObject({
        tier: SubscriptionTier.PREMIUM,
        name: 'Premium',
        priceMonthly: 4900,
        batchesLimit: 1000,
      });
    });

    it('should return FREE tier with zero prices', () => {
      const config = paymentService.getTierConfig(SubscriptionTier.FREE);

      expect(config.priceMonthly).toBe(0);
      expect(config.priceYearly).toBe(0);
    });

    it('should return ENTERPRISE tier with unlimited limits', () => {
      const config = paymentService.getTierConfig(SubscriptionTier.ENTERPRISE);

      expect(config.batchesLimit).toBe(-1);
      expect(config.apiCallsLimit).toBe(-1);
      expect(config.storageLimitMb).toBe(-1);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EDGE CASES AND ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

describe('PaymentService - Edge Cases', () => {
  let paymentService: PaymentService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrisma();
    paymentService = new PaymentService(mockPrisma);
    (stripeProvider.isAvailable as Mock).mockReturnValue(true);
  });

  describe('Error Handling', () => {
    it('should propagate Stripe errors with proper error code', async () => {
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);
      (stripeProvider.createPaymentIntent as Mock).mockRejectedValue(
        new Error('Card declined')
      );

      await expect(
        paymentService.createOneTimePayment({
          userId: 'user_123',
          amount: 5000,
          description: 'Test',
        })
      ).rejects.toThrow();
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.subscription.findUnique = vi.fn().mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(
        paymentService.getSubscription('user_123')
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent usage increments', async () => {
      mockPrisma.subscription.update = vi.fn().mockResolvedValue(mockSubscriptionRecord);

      // Simulate concurrent increments
      await Promise.all([
        paymentService.incrementUsage('user_123', 'batches', 1),
        paymentService.incrementUsage('user_123', 'batches', 1),
        paymentService.incrementUsage('user_123', 'batches', 1),
      ]);

      expect(mockPrisma.subscription.update).toHaveBeenCalledTimes(3);
    });
  });

  describe('Validation', () => {
    it('should validate minimum amount for payments', async () => {
      mockPrisma.subscription.findUnique = vi.fn().mockResolvedValue(mockSubscriptionRecord);
      (stripeProvider.createPaymentIntent as Mock).mockRejectedValue(
        new Error('Amount must be at least 50 cents')
      );

      await expect(
        paymentService.createOneTimePayment({
          userId: 'user_123',
          amount: 10, // Too low
          description: 'Test',
        })
      ).rejects.toThrow();
    });
  });
});
