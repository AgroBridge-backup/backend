import { z } from 'zod';
const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.string().default('3000'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    JWT_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
    BLOCKCHAIN_ENABLED: z
        .string()
        .transform((val) => val === 'true')
        .default('false'),
    BLOCKCHAIN_RPC_URL: z.string().url('BLOCKCHAIN_RPC_URL must be a valid URL').optional(),
    BLOCKCHAIN_PRIVATE_KEY: z.string().optional(),
    BLOCKCHAIN_NETWORK: z.string().default('polygon'),
    BLOCKCHAIN_EXPLORER_URL: z.string().url().default('https://polygonscan.com'),
    INVOICE_REGISTRY_CONTRACT_ADDRESS: z.string().optional(),
    REFERRAL_PROGRAM_CONTRACT_ADDRESS: z.string().optional(),
    META_WHATSAPP_TOKEN: z.string().optional(),
    META_WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
    META_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
    VERIFY_BASE_URL: z.string().url().default('https://verify.agrobridge.io'),
    APP_BASE_URL: z.string().url().default('https://api.agrobridge.io'),
    FRONTEND_URL: z.string().url().optional(),
    FACTURAMA_API_URL: z.string().url().optional(),
    FACTURAMA_USER: z.string().optional(),
    FACTURAMA_PASSWORD: z.string().optional(),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    SENDGRID_API_KEY: z.string().optional(),
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    REDIS_URL: z.string().url().optional(),
    AWS_REGION: z.string().optional(),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    S3_BUCKET_NAME: z.string().optional(),
    ADMIN_USERNAME: z.string().optional(),
    ADMIN_PASSWORD: z.string().optional(),
});
export function validateEnv() {
    try {
        const parsed = envSchema.parse(process.env);
        if (parsed.BLOCKCHAIN_ENABLED) {
            if (!parsed.BLOCKCHAIN_RPC_URL) {
                throw new Error('BLOCKCHAIN_RPC_URL is required when BLOCKCHAIN_ENABLED=true');
            }
            if (!parsed.BLOCKCHAIN_PRIVATE_KEY) {
                throw new Error('BLOCKCHAIN_PRIVATE_KEY is required when BLOCKCHAIN_ENABLED=true');
            }
        }
        return parsed;
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            console.error('\n❌ Environment validation failed:\n');
            error.errors.forEach((err) => {
                console.error(`   • ${err.path.join('.')}: ${err.message}`);
            });
            console.error('\n   Please check your .env file and restart the server.\n');
            process.exit(1);
        }
        if (error instanceof Error) {
            console.error(`\n❌ Environment validation error: ${error.message}\n`);
            process.exit(1);
        }
        throw error;
    }
}
let cachedEnv = null;
export function getEnv() {
    if (!cachedEnv) {
        cachedEnv = validateEnv();
    }
    return cachedEnv;
}
export function isFeatureEnabled(feature) {
    const env = getEnv();
    switch (feature) {
        case 'blockchain':
            return env.BLOCKCHAIN_ENABLED && !!env.BLOCKCHAIN_RPC_URL;
        case 'whatsapp':
            return !!env.META_WHATSAPP_TOKEN && !!env.META_WHATSAPP_PHONE_NUMBER_ID;
        case 'stripe':
            return !!env.STRIPE_SECRET_KEY;
        default:
            return false;
    }
}
