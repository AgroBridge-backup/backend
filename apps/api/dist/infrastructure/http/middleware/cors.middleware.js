import cors from 'cors';
import logger from '../../../shared/utils/logger.js';
const getAllowedOrigins = () => {
    const originsEnv = process.env.ALLOWED_ORIGINS || '';
    const defaultOrigins = [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:4200',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173',
    ];
    if (!originsEnv) {
        return process.env.NODE_ENV === 'production' ? [] : defaultOrigins;
    }
    return originsEnv.split(',').map((origin) => origin.trim()).filter(Boolean);
};
const corsOptions = {
    origin: (origin, callback) => {
        const allowedOrigins = getAllowedOrigins();
        if (!origin) {
            return callback(null, true);
        }
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            logger.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
            callback(new Error(`Origin ${origin} not allowed by CORS policy`));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-Correlation-ID',
        'X-Request-ID',
        'Accept',
        'Accept-Language',
        'Accept-Encoding',
    ],
    exposedHeaders: [
        'X-Correlation-ID',
        'X-Request-ID',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
    ],
    maxAge: 86400,
    optionsSuccessStatus: 200,
};
export const corsMiddleware = cors(corsOptions);
export const healthCheckCors = cors({
    origin: '*',
    methods: ['GET', 'HEAD'],
    maxAge: 3600,
});
