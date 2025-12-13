import { z } from 'zod';
import { Password } from '../../domain/value-objects/Password.js';

/**
 * Common passwords blacklist for Zod validation
 */
const COMMON_PASSWORDS = [
  '12345678', 'password', 'password1!', 'qwerty123!',
  'admin123!', 'welcome1!', 'password123!', 'letmein1!',
];

/**
 * Custom Zod validator for password with enterprise-grade complexity rules
 * Based on OWASP and NIST password guidelines
 */
export const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(128, 'La contraseña no puede exceder 128 caracteres')
  .regex(/[A-Z]/, 'Debe contener al menos una letra mayúscula')
  .regex(/[a-z]/, 'Debe contener al menos una letra minúscula')
  .regex(/\d/, 'Debe contener al menos un número')
  .regex(
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/,
    'Debe contener al menos un carácter especial (!@#$%^&*...)'
  )
  .refine(
    (password) => !/\s/.test(password),
    'La contraseña no puede contener espacios'
  )
  .refine(
    (password) => !COMMON_PASSWORDS.includes(password.toLowerCase()),
    'Esta contraseña es demasiado común'
  );

/**
 * Login request validation schema
 */
export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(1, 'Contraseña requerida'),
  }),
});

/**
 * Registration request validation schema
 */
export const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Email inválido').toLowerCase().trim(),
    password: passwordSchema,
    passwordConfirm: z.string(),
    firstName: z.string().min(2, 'Nombre requerido').max(100).trim(),
    lastName: z.string().min(2, 'Apellido requerido').max(100).trim(),
    businessName: z.string().min(2, 'Nombre de negocio requerido').max(200).trim().optional(),
    rfc: z.string().min(12, 'RFC inválido').max(13).toUpperCase().trim().optional(),
    state: z.string().min(2, 'Estado requerido').max(100).trim().optional(),
    municipality: z.string().min(2, 'Municipio requerido').max(100).trim().optional(),
  }).refine(
    (data) => data.password === data.passwordConfirm,
    {
      message: 'Las contraseñas no coinciden',
      path: ['passwordConfirm'],
    }
  ),
});

/**
 * Change password request validation schema
 */
export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Contraseña actual requerida'),
    newPassword: passwordSchema,
    newPasswordConfirm: z.string(),
  }).refine(
    (data) => data.newPassword === data.newPasswordConfirm,
    {
      message: 'Las contraseñas nuevas no coinciden',
      path: ['newPasswordConfirm'],
    }
  ).refine(
    (data) => data.currentPassword !== data.newPassword,
    {
      message: 'La nueva contraseña debe ser diferente a la actual',
      path: ['newPassword'],
    }
  ),
});

/**
 * Password reset request schema
 */
export const requestPasswordResetSchema = z.object({
  body: z.object({
    email: z.string().email('Email inválido').toLowerCase().trim(),
  }),
});

/**
 * Password reset confirmation schema
 */
export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Token requerido'),
    newPassword: passwordSchema,
    newPasswordConfirm: z.string(),
  }).refine(
    (data) => data.newPassword === data.newPasswordConfirm,
    {
      message: 'Las contraseñas no coinciden',
      path: ['newPasswordConfirm'],
    }
  ),
});

/**
 * Refresh token request schema
 */
export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token requerido'),
  }),
});

/**
 * Password strength check request schema (for frontend real-time validation)
 */
export const passwordStrengthSchema = z.object({
  body: z.object({
    password: z.string().min(1, 'Contraseña requerida'),
  }),
});

/**
 * Type exports for controller usage
 */
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type PasswordStrengthInput = z.infer<typeof passwordStrengthSchema>;
