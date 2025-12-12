import { AppError } from './AppError.js';
/**
 * ServiceUnavailableError - 503 Service Unavailable
 * Thrown when service is temporarily unavailable (maintenance, overload, etc.)
 */
export class ServiceUnavailableError extends AppError {
    retryAfter;
    constructor(message = 'Service temporarily unavailable', retryAfter) {
        super(message, 503);
        this.name = 'ServiceUnavailableError';
        this.retryAfter = retryAfter;
    }
}
