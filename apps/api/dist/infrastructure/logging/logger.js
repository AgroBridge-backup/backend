import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';
const isProduction = process.env.NODE_ENV === 'production';
const isStaging = process.env.NODE_ENV === 'staging';
const isDevelopment = process.env.NODE_ENV === 'development';
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}
const logFormat = winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston.format.errors({ stack: true }), winston.format.json());
const consoleFormat = winston.format.combine(winston.format.colorize(), winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `${timestamp} [${level}]: ${message}${metaStr}`;
}));
const transports = [
    new winston.transports.Console({
        format: consoleFormat,
        level: isDevelopment ? 'debug' : 'info',
    }),
];
if (isStaging || isProduction) {
    transports.push(new DailyRotateFile({
        filename: path.join(logsDir, 'agrobridge-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        format: logFormat,
        level: 'info',
    }), new DailyRotateFile({
        filename: path.join(logsDir, 'agrobridge-error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxSize: '20m',
        maxFiles: '30d',
        format: logFormat,
    }), new DailyRotateFile({
        filename: path.join(logsDir, 'agrobridge-http-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'http',
        maxSize: '20m',
        maxFiles: '7d',
        format: logFormat,
    }));
}
export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    transports,
    exceptionHandlers: [
        new winston.transports.Console({ format: consoleFormat }),
        ...(isStaging || isProduction
            ? [
                new DailyRotateFile({
                    filename: path.join(logsDir, 'exceptions-%DATE%.log'),
                    datePattern: 'YYYY-MM-DD',
                    maxSize: '20m',
                    maxFiles: '30d',
                    format: logFormat,
                }),
            ]
            : []),
    ],
    rejectionHandlers: [
        new winston.transports.Console({ format: consoleFormat }),
        ...(isStaging || isProduction
            ? [
                new DailyRotateFile({
                    filename: path.join(logsDir, 'rejections-%DATE%.log'),
                    datePattern: 'YYYY-MM-DD',
                    maxSize: '20m',
                    maxFiles: '30d',
                    format: logFormat,
                }),
            ]
            : []),
    ],
});
export const log = {
    info: (message, meta) => {
        logger.info(message, meta);
    },
    warn: (message, meta) => {
        logger.warn(message, meta);
    },
    error: (message, error) => {
        if (error instanceof Error) {
            logger.error(message, {
                error: error.message,
                stack: error.stack,
                name: error.name,
            });
        }
        else {
            logger.error(message, error);
        }
    },
    debug: (message, meta) => {
        logger.debug(message, meta);
    },
    http: (message, meta) => {
        logger.http(message, meta);
    },
    request: (req, res, responseTime) => {
        logger.http('HTTP Request', {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            responseTime: responseTime ? `${responseTime}ms` : undefined,
            userAgent: req.get('user-agent'),
            ip: req.ip || req.connection.remoteAddress,
        });
    },
    database: (operation, meta) => {
        logger.debug(`Database: ${operation}`, meta);
    },
    security: (event, meta) => {
        logger.warn(`Security: ${event}`, {
            ...meta,
            timestamp: new Date().toISOString(),
        });
    },
};
log.info(`Logger initialized in ${process.env.NODE_ENV || 'development'} mode`, {
    logLevel: logger.level,
    logsDirectory: logsDir,
});
export default logger;
