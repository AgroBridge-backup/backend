import { z } from 'zod';
import { SubscriptionTier } from '@prisma/client';
export const subscriptionTierSchema = z.nativeEnum(SubscriptionTier);
export const billingCycleSchema = z.enum(['monthly', 'yearly']);
export const paymentMethodIdSchema = z
    .string()
    .min(1, 'Payment method ID is required')
    .regex(/^pm_/, 'Invalid payment method ID format');
export const currencySchema = z
    .string()
    .length(3, 'Currency must be 3 characters')
    .toLowerCase()
    .default('usd');
export const createSubscriptionSchema = z.object({
    body: z.object({
        tier: subscriptionTierSchema.refine((tier) => tier !== SubscriptionTier.FREE, 'Cannot create subscription for FREE tier'),
        paymentMethodId: paymentMethodIdSchema,
        billingCycle: billingCycleSchema.default('monthly'),
        trialDays: z.number().int().min(0).max(30).optional(),
    }),
});
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
export const cancelSubscriptionSchema = z.object({
    body: z.object({
        immediately: z.boolean().optional().default(false),
    }),
});
export const addPaymentMethodSchema = z.object({
    body: z.object({
        paymentMethodId: paymentMethodIdSchema,
        setAsDefault: z.boolean().optional().default(true),
    }),
});
export const removePaymentMethodSchema = z.object({
    params: z.object({
        paymentMethodId: paymentMethodIdSchema,
    }),
});
export const setDefaultPaymentMethodSchema = z.object({
    body: z.object({
        paymentMethodId: paymentMethodIdSchema,
    }),
});
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
export const getInvoicePdfSchema = z.object({
    params: z.object({
        invoiceId: z
            .string()
            .min(1, 'Invoice ID is required')
            .regex(/^in_/, 'Invalid invoice ID format'),
    }),
});
export const createPortalSessionSchema = z.object({
    body: z.object({
        returnUrl: z.string().url('Invalid return URL').optional(),
    }),
});
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
