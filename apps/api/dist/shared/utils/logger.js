import winston from 'winston';
import DatadogTransport from 'winston-datadog';
const isProduction = process.env.NODE_ENV === 'production';
const level = isProduction ? 'info' : 'debug';
const formats = winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston.format.errors({ stack: true }), winston.format.splat(), isProduction
    ? winston.format.json()
    : winston.format.combine(winston.format.colorize(), winston.format.printf(({ level, message, timestamp, stack, traceId, userId, ...meta }) => {
        let msg = message;
        if (typeof message === 'object' && message !== null) {
            msg = JSON.stringify(message, null, 2);
        }
        let logMessage = `${timestamp} ${level}: ${msg}`;
        if (traceId)
            logMessage += ` [TraceID: ${traceId}]`;
        if (userId)
            logMessage += ` [UserID: ${userId}]`;
        if (stack) {
            logMessage += `\n${stack}`;
        }
        if (Object.keys(meta).length > 0) {
            logMessage += `\n${JSON.stringify(meta, null, 2)}`;
        }
        return logMessage;
    })));
const transports = [
    new winston.transports.Console()
];
if (process.env.DATADOG_API_KEY) {
    transports.push(new DatadogTransport({
        apiKey: process.env.DATADOG_API_KEY,
        ddsource: 'nodejs',
        tags: [`env:${process.env.NODE_ENV || 'development'}`, 'service:agrobridge'],
    }));
}
const logger = winston.createLogger({
    level,
    format: formats,
    transports,
});
export const stream = {
    write: (message) => {
        logger.info(message.trim());
    },
};
export default logger;
