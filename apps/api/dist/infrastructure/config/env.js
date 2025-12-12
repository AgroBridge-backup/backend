import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';
// Load .env file based on the environment (e.g., .env.test if NODE_ENV='test')
// Vitest automatically sets NODE_ENV to 'test'
dotenv.config({
    path: path.resolve(process.cwd(), `.env.${process.env.NODE_ENV || 'development'}`),
});
/**
 * Defines the schema for environment variables using Zod for validation.
 * This ensures that all required environment variables are present and correctly formatted.
 */
const envSchema = z.object({
    DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL."),
    REDIS_URL: z.string().url("REDIS_URL must be a valid URL."),
    JWT_SECRET: z.string().min(1, "JWT_SECRET cannot be empty."),
    JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET cannot be empty."),
    JWT_EXPIRATION: z.string().min(1, "JWT_EXPIRATION cannot be empty."),
    JWT_REFRESH_EXPIRATION: z.string().min(1, "JWT_REFRESH_EXPIRATION cannot be empty."),
});
// Parse the environment variables from process.env
const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
    console.error('❌ Invalid environment variables:', parsedEnv.error.flatten().fieldErrors);
    // In a test environment, we might have partial envs, but for key components we must fail.
    // This ensures the application does not start with a misconfiguration.
    throw new Error('Invalid or missing environment variables. Please check your .env file.');
}
/**
 * A typesafe, validated, and camelCased environment object for use throughout the application.
 */
export const env = {
    databaseUrl: parsedEnv.data.DATABASE_URL,
    redisUrl: parsedEnv.data.REDIS_URL,
    jwtSecret: parsedEnv.data.JWT_SECRET,
    jwtRefreshSecret: parsedEnv.data.JWT_REFRESH_SECRET,
    jwtExpiration: parsedEnv.data.JWT_EXPIRATION,
    jwtRefreshExpiration: parsedEnv.data.JWT_REFRESH_EXPIRATION,
};
