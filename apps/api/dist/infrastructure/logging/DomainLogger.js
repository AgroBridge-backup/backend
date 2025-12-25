import { logger } from './logger.js';
export class DomainLogger {
    prefix;
    constructor(prefix) {
        this.prefix = prefix || '';
    }
    info(message, context) {
        logger.info(this.formatMessage(message), context);
    }
    warn(message, context) {
        logger.warn(this.formatMessage(message), context);
    }
    error(message, context) {
        logger.error(this.formatMessage(message), context);
    }
    debug(message, context) {
        logger.debug(this.formatMessage(message), context);
    }
    formatMessage(message) {
        return this.prefix ? `[${this.prefix}] ${message}` : message;
    }
}
export function createDomainLogger(prefix) {
    return new DomainLogger(prefix);
}
export const domainLogger = new DomainLogger();
