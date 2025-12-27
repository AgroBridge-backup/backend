/**
 * Certificate Validation Schemas (Zod)
 * Type-safe validation for quality certificate operations
 */

import { z } from "zod";
import { CertificateGrade } from "@prisma/client";

/**
 * UUID validation helper
 */
const uuidSchema = z.string().uuid("Invalid UUID format");

/**
 * Certificate grade enum values for runtime validation
 * Matches Prisma schema: STANDARD, PREMIUM, EXPORT, ORGANIC
 */
export const VALID_CERTIFICATE_GRADES = [
  "STANDARD",
  "PREMIUM",
  "EXPORT",
  "ORGANIC",
] as const;

/**
 * Type guard for CertificateGrade
 */
export function isValidCertificateGrade(
  value: string,
): value is CertificateGrade {
  return VALID_CERTIFICATE_GRADES.includes(value as any);
}

/**
 * Issue certificate schema
 */
export const issueCertificateSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    grade: z.nativeEnum(CertificateGrade, {
      errorMap: () => ({
        message: `Invalid grade. Must be one of: ${VALID_CERTIFICATE_GRADES.join(", ")}`,
      }),
    }),
    certifyingBody: z
      .string()
      .min(1, "Certifying body is required")
      .max(255, "Certifying body name too long")
      .regex(
        /^[\p{L}\p{N}\s.,-]+$/u,
        "Certifying body contains invalid characters",
      ),
    validityDays: z
      .number()
      .int("Validity must be a whole number")
      .min(1, "Validity must be at least 1 day")
      .max(3650, "Validity cannot exceed 10 years")
      .optional()
      .default(365),
  }),
});

/**
 * Check eligibility schema - validates grade from query param
 */
export const checkEligibilitySchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  query: z.object({
    grade: z
      .string()
      .refine(isValidCertificateGrade, {
        message: `Invalid grade. Must be one of: ${VALID_CERTIFICATE_GRADES.join(", ")}`,
      })
      .transform((val) => val as CertificateGrade),
  }),
});

/**
 * Get certificate by ID schema
 */
export const getCertificateByIdSchema = z.object({
  params: z.object({
    certificateId: uuidSchema,
  }),
});

/**
 * List batch certificates schema
 */
export const listBatchCertificatesSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  query: z.object({
    validOnly: z
      .string()
      .optional()
      .transform((val) => val === "true"),
  }),
});

/**
 * Verify certificate schema
 */
export const verifyCertificateSchema = z.object({
  params: z.object({
    certificateId: uuidSchema,
  }),
});

export type IssueCertificateInput = z.infer<typeof issueCertificateSchema>;
export type CheckEligibilityInput = z.infer<typeof checkEligibilitySchema>;
