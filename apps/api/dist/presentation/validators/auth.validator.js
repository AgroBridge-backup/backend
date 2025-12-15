import { z } from 'zod';
const COMMON_PASSWORDS = [
    '12345678', 'password', 'password1!', 'qwerty123!',
    'admin123!', 'welcome1!', 'password123!', 'letmein1!',
];
export const passwordSchema = z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(128, 'La contraseña no puede exceder 128 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una letra mayúscula')
    .regex(/[a-z]/, 'Debe contener al menos una letra minúscula')
    .regex(/\d/, 'Debe contener al menos un número')
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/, 'Debe contener al menos un carácter especial (!@#$%^&*...)')
    .refine((password) => !/\s/.test(password), 'La contraseña no puede contener espacios')
    .refine((password) => !COMMON_PASSWORDS.includes(password.toLowerCase()), 'Esta contraseña es demasiado común');
export const loginSchema = z.object({
    body: z.object({
        email: z.string().email('Email inválido'),
        password: z.string().min(1, 'Contraseña requerida'),
    }),
});
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
    }).refine((data) => data.password === data.passwordConfirm, {
        message: 'Las contraseñas no coinciden',
        path: ['passwordConfirm'],
    }),
});
export const changePasswordSchema = z.object({
    body: z.object({
        currentPassword: z.string().min(1, 'Contraseña actual requerida'),
        newPassword: passwordSchema,
        newPasswordConfirm: z.string(),
    }).refine((data) => data.newPassword === data.newPasswordConfirm, {
        message: 'Las contraseñas nuevas no coinciden',
        path: ['newPasswordConfirm'],
    }).refine((data) => data.currentPassword !== data.newPassword, {
        message: 'La nueva contraseña debe ser diferente a la actual',
        path: ['newPassword'],
    }),
});
export const requestPasswordResetSchema = z.object({
    body: z.object({
        email: z.string().email('Email inválido').toLowerCase().trim(),
    }),
});
export const resetPasswordSchema = z.object({
    body: z.object({
        token: z.string().min(1, 'Token requerido'),
        newPassword: passwordSchema,
        newPasswordConfirm: z.string(),
    }).refine((data) => data.newPassword === data.newPasswordConfirm, {
        message: 'Las contraseñas no coinciden',
        path: ['newPasswordConfirm'],
    }),
});
export const refreshTokenSchema = z.object({
    body: z.object({
        refreshToken: z.string().min(1, 'Refresh token requerido'),
    }),
});
export const passwordStrengthSchema = z.object({
    body: z.object({
        password: z.string().min(1, 'Contraseña requerida'),
    }),
});
export const twoFactorTokenSchema = z
    .string()
    .min(6, 'Token must be at least 6 characters')
    .max(10, 'Token cannot exceed 10 characters')
    .transform((val) => val.replace(/[\s-]/g, ''));
export const verify2FASchema = z.object({
    body: z.object({
        tempToken: z.string().uuid('Invalid session token'),
        token: twoFactorTokenSchema,
    }),
});
export const enable2FASchema = z.object({
    body: z.object({
        token: twoFactorTokenSchema,
    }),
});
export const disable2FASchema = z.object({
    body: z.object({
        token: twoFactorTokenSchema,
    }),
});
export const regenerateBackupCodesSchema = z.object({
    body: z.object({
        token: twoFactorTokenSchema,
    }),
});
export const oauthProviderSchema = z.enum(['google', 'github']);
export const oauthCallbackSchema = z.object({
    query: z.object({
        code: z.string().min(1, 'Authorization code required'),
        state: z.string().min(1, 'State parameter required'),
    }),
});
export const oauthUnlinkSchema = z.object({
    params: z.object({
        provider: oauthProviderSchema,
    }),
});
