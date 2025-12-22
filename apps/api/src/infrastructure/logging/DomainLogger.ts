/**
 * Domain Logger Implementation
 * Wraps infrastructure logger to implement ILogger interface
 */

import { ILogger, LogContext } from '../../domain/services/ILogger.js';
import { logger } from './logger.js';

export class DomainLogger implements ILogger {
  private readonly prefix: string;

  constructor(prefix?: string) {
    this.prefix = prefix || '';
  }

  info(message: string, context?: LogContext): void {
    logger.info(this.formatMessage(message), context);
  }

  warn(message: string, context?: LogContext): void {
    logger.warn(this.formatMessage(message), context);
  }

  error(message: string, context?: LogContext): void {
    logger.error(this.formatMessage(message), context);
  }

  debug(message: string, context?: LogContext): void {
    logger.debug(this.formatMessage(message), context);
  }

  private formatMessage(message: string): string {
    return this.prefix ? `[${this.prefix}] ${message}` : message;
  }
}

/**
 * Factory function to create domain loggers with prefixes
 */
export function createDomainLogger(prefix: string): ILogger {
  return new DomainLogger(prefix);
}

/**
 * Default domain logger instance
 */
export const domainLogger: ILogger = new DomainLogger();
