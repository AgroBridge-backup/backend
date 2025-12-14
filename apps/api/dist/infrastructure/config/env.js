import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';
dotenv.config({
    path: path.resolve(process.cwd(), `.env.${process.env.NODE_ENV || 'development'}`),
});
const envSchema = z.object({
    DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL."),
    REDIS_URL: z.string().url("REDIS_URL must be a valid URL."),
    JWT_SECRET: z.string().min(1, "JWT_SECRET cannot be empty."),
    JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET cannot be empty."),
    JWT_EXPIRATION: z.string().min(1, "JWT_EXPIRATION cannot be empty."),
    JWT_REFRESH_EXPIRATION: z.string().min(1, "JWT_REFRESH_EXPIRATION cannot be empty."),
});
const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
    console.error('❌ Invalid environment variables:', parsedEnv.error.flatten().fieldErrors);
    throw new Error('Invalid or missing environment variables. Please check your .env file.');
}
export const env = {
    databaseUrl: parsedEnv.data.DATABASE_URL,
    redisUrl: parsedEnv.data.REDIS_URL,
    jwtSecret: parsedEnv.data.JWT_SECRET,
    jwtRefreshSecret: parsedEnv.data.JWT_REFRESH_SECRET,
    jwtExpiration: parsedEnv.data.JWT_EXPIRATION,
    jwtRefreshExpiration: parsedEnv.data.JWT_REFRESH_EXPIRATION,
};
