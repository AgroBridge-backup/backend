/**
 * Authentication Validation Schemas (Zod)
 * Protects against injection attacks and malformed requests
 */

import { z } from 'zod';

/**
 * Email validation with strict pattern matching
 */
const emailSchema = z
  .string()
  .email('Invalid email format')
  .max(255, 'Email too long')
  .transform((val) => val.toLowerCase().trim());

/**
 * Password validation with security requirements
 */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password must contain at least one lowercase, one uppercase, and one number'
  );

/**
 * Login request schema
 */
export const loginSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required').max(128),
  }),
});

/**
 * Registration request schema
 */
export const registerSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: passwordSchema,
    firstName: z
      .string()
      .min(1, 'First name is required')
      .max(100, 'First name too long')
      .regex(/^[\p{L}\s'-]+$/u, 'First name contains invalid characters'),
    lastName: z
      .string()
      .min(1, 'Last name is required')
      .max(100, 'Last name too long')
      .regex(/^[\p{L}\s'-]+$/u, 'Last name contains invalid characters'),
    role: z.enum(['PRODUCER', 'BUYER', 'CERTIFIER']).optional(),
  }),
});

/**
 * Password reset request schema
 */
export const passwordResetRequestSchema = z.object({
  body: z.object({
    email: emailSchema,
  }),
});

/**
 * Password reset confirmation schema
 */
export const passwordResetConfirmSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Token is required').max(500),
    newPassword: passwordSchema,
  }),
});

/**
 * Token refresh schema
 */
export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required').max(1000),
  }),
});

/**
 * 2FA verification schema
 */
export const verify2FASchema = z.object({
  body: z.object({
    tempToken: z.string().min(1).max(500),
    code: z
      .string()
      .length(6, 'Code must be 6 digits')
      .regex(/^\d{6}$/, 'Code must be numeric'),
  }),
});

/**
 * 2FA enable schema
 */
export const enable2FASchema = z.object({
  body: z.object({
    code: z
      .string()
      .length(6, 'Code must be 6 digits')
      .regex(/^\d{6}$/, 'Code must be numeric'),
  }),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
