/**
 * Batch Validation Schemas (Zod)
 * Protects batch operations from injection and malformed data
 */

import { z } from 'zod';
import { Variety, BatchStatus } from '@prisma/client';

/**
 * UUID validation helper
 */
const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Weight validation (in kilograms)
 */
const weightSchema = z
  .number()
  .positive('Weight must be positive')
  .max(1000000, 'Weight exceeds maximum allowed');

/**
 * GPS coordinates validation
 */
const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90, 'Invalid latitude'),
  longitude: z.number().min(-180).max(180, 'Invalid longitude'),
});

/**
 * Create batch schema
 */
export const createBatchSchema = z.object({
  body: z.object({
    variety: z.nativeEnum(Variety, { errorMap: () => ({ message: 'Invalid variety' }) }),
    origin: z
      .string()
      .min(1, 'Origin is required')
      .max(255, 'Origin too long')
      .regex(/^[\p{L}\p{N}\s,.-]+$/u, 'Origin contains invalid characters'),
    weightKg: weightSchema,
    harvestDate: z
      .string()
      .datetime({ message: 'Invalid date format' })
      .or(z.date())
      .transform((val) => (typeof val === 'string' ? new Date(val) : val)),
    producerId: uuidSchema.optional(),
  }),
});

/**
 * Update batch status schema
 */
export const updateBatchStatusSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    status: z.nativeEnum(BatchStatus, { errorMap: () => ({ message: 'Invalid status' }) }),
    notes: z.string().max(1000, 'Notes too long').optional(),
  }),
});

/**
 * Get batch by ID schema
 */
export const getBatchByIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

/**
 * List batches schema with pagination
 */
export const listBatchesSchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .refine((val) => val > 0, 'Page must be positive'),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 20))
      .refine((val) => val > 0 && val <= 100, 'Limit must be between 1 and 100'),
    status: z.nativeEnum(BatchStatus).optional(),
    producerId: uuidSchema.optional(),
    fromDate: z.string().datetime().optional(),
    toDate: z.string().datetime().optional(),
  }),
});

/**
 * Batch search schema
 */
export const searchBatchesSchema = z.object({
  query: z.object({
    q: z
      .string()
      .min(1, 'Search query required')
      .max(100, 'Search query too long')
      .regex(/^[\p{L}\p{N}\s-]+$/u, 'Search contains invalid characters'),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .refine((val) => val > 0 && val <= 50, 'Limit must be between 1 and 50'),
  }),
});

export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type UpdateBatchStatusInput = z.infer<typeof updateBatchStatusSchema>;
