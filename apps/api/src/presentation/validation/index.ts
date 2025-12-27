/**
 * Validation Schemas Index
 * Centralized export of all Zod validation schemas
 */

// Auth schemas
export * from "./auth.schemas.js";

// Batch schemas
export * from "./batch.schemas.js";

// Certificate schemas
export * from "./certificate.schemas.js";

// Common validation utilities
import { z } from "zod";

/**
 * Sanitize string input to prevent XSS
 */
export const sanitizedString = (maxLength: number = 255) =>
  z
    .string()
    .max(maxLength)
    .transform((val) =>
      val
        .replace(/[<>]/g, "") // Remove angle brackets
        .replace(/javascript:/gi, "") // Remove javascript: protocol
        .replace(/on\w+=/gi, "") // Remove event handlers
        .trim(),
    );

/**
 * UUID validator
 */
export const uuidParam = z.string().uuid("Invalid UUID format");

/**
 * Pagination schema
 */
export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => val > 0, "Page must be positive"),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .refine((val) => val > 0 && val <= 100, "Limit must be between 1 and 100"),
});

/**
 * Date range schema
 */
export const dateRangeSchema = z
  .object({
    fromDate: z.string().datetime().optional(),
    toDate: z.string().datetime().optional(),
  })
  .refine(
    (data) => {
      if (data.fromDate && data.toDate) {
        return new Date(data.fromDate) <= new Date(data.toDate);
      }
      return true;
    },
    { message: "fromDate must be before toDate" },
  );
