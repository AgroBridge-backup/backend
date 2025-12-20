/**
 * @file Payment Validators
 * @description Zod validation schemas for payment endpoints
 *
 * @author AgroBridge Engineering Team
 */

import { z } from 'zod';
import { SubscriptionTier } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════════
// COMMON SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Subscription tier enum validation
 */
export const subscriptionTierSchema = z.nativeEnum(SubscriptionTier);

/**
 * Billing cycle validation
 */
export const billingCycleSchema = z.enum(['monthly', 'yearly']);

/**
 * Stripe payment method ID validation
 */
export const paymentMethodIdSchema = z
  .string()
  .min(1, 'Payment method ID is required')
  .regex(/^pm_/, 'Invalid payment method ID format');

/**
 * Currency validation (ISO 4217)
 */
export const currencySchema = z
  .string()
  .length(3, 'Currency must be 3 characters')
  .toLowerCase()
  .default('usd');

// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create subscription request schema
 */
export const createSubscriptionSchema = z.object({
  body: z.object({
    tier: subscriptionTierSchema.refine(
      (tier) => tier !== SubscriptionTier.FREE,
      'Cannot create subscription for FREE tier'
    ),
    paymentMethodId: paymentMethodIdSchema,
    billingCycle: billingCycleSchema.default('monthly'),
    trialDays: z.number().int().min(0).max(30).optional(),
  }),
});

/**
 * Update subscription request schema
 */
export const updateSubscriptionSchema = z.object({
  body: z.object({
    tier: subscriptionTierSchema,
    billingCycle: billingCycleSchema.optional(),
    prorationBehavior: z
      .enum(['create_prorations', 'none', 'always_invoice'])
      .optional()
      .default('create_prorations'),
  }),
});

/**
 * Cancel subscription request schema
 */
export const cancelSubscriptionSchema = z.object({
  body: z.object({
    immediately: z.boolean().optional().default(false),
  }),
});

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT METHOD SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Add payment method request schema
 */
export const addPaymentMethodSchema = z.object({
  body: z.object({
    paymentMethodId: paymentMethodIdSchema,
    setAsDefault: z.boolean().optional().default(true),
  }),
});

/**
 * Remove payment method request schema
 */
export const removePaymentMethodSchema = z.object({
  params: z.object({
    paymentMethodId: paymentMethodIdSchema,
  }),
});

/**
 * Set default payment method request schema
 */
export const setDefaultPaymentMethodSchema = z.object({
  body: z.object({
    paymentMethodId: paymentMethodIdSchema,
  }),
});

// ═══════════════════════════════════════════════════════════════════════════════
// ONE-TIME PAYMENT SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create one-time payment request schema
 */
export const createOneTimePaymentSchema = z.object({
  body: z.object({
    amount: z
      .number()
      .int('Amount must be in cents (integer)')
      .min(50, 'Minimum amount is $0.50 (50 cents)')
      .max(99999999, 'Maximum amount exceeded'),
    currency: currencySchema,
    description: z
      .string()
      .min(1, 'Description is required')
      .max(500, 'Description too long'),
    paymentMethodId: paymentMethodIdSchema.optional(),
    metadata: z.record(z.string()).optional(),
  }),
});

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * List invoices request schema
 */
export const listInvoicesSchema = z.object({
  query: z.object({
    limit: z
      .string()
      .optional()
      .default('10')
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().min(1).max(100)),
  }),
});

/**
 * Get invoice PDF request schema
 */
export const getInvoicePdfSchema = z.object({
  params: z.object({
    invoiceId: z
      .string()
      .min(1, 'Invoice ID is required')
      .regex(/^in_/, 'Invalid invoice ID format'),
  }),
});

// ═══════════════════════════════════════════════════════════════════════════════
// BILLING PORTAL SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create portal session request schema
 */
export const createPortalSessionSchema = z.object({
  body: z.object({
    returnUrl: z.string().url('Invalid return URL').optional(),
  }),
});

// ═══════════════════════════════════════════════════════════════════════════════
// USAGE SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check usage request schema
 */
export const checkUsageSchema = z.object({
  query: z.object({
    type: z.enum(['batches', 'apiCalls', 'storage']),
    amount: z
      .string()
      .optional()
      .default('1')
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().min(1)),
  }),
});

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>;
export type AddPaymentMethodInput = z.infer<typeof addPaymentMethodSchema>;
export type RemovePaymentMethodInput = z.infer<typeof removePaymentMethodSchema>;
export type SetDefaultPaymentMethodInput = z.infer<typeof setDefaultPaymentMethodSchema>;
export type CreateOneTimePaymentInput = z.infer<typeof createOneTimePaymentSchema>;
export type ListInvoicesInput = z.infer<typeof listInvoicesSchema>;
export type GetInvoicePdfInput = z.infer<typeof getInvoicePdfSchema>;
export type CreatePortalSessionInput = z.infer<typeof createPortalSessionSchema>;
export type CheckUsageInput = z.infer<typeof checkUsageSchema>;
