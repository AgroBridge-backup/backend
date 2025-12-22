/**
 * Domain Logger Interface
 * Abstracts logging to maintain clean architecture
 * Use cases should depend on this interface, not infrastructure logger
 */

export interface LogContext {
  [key: string]: string | number | boolean | null | undefined;
}

export interface ILogger {
  /**
   * Log informational message
   */
  info(message: string, context?: LogContext): void;

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void;

  /**
   * Log error message
   */
  error(message: string, context?: LogContext): void;

  /**
   * Log debug message
   */
  debug(message: string, context?: LogContext): void;
}
