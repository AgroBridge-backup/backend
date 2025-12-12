import { AppError } from './AppError.js';
/**
 * TooManyRequestsError - 429 Too Many Requests
 * Thrown when rate limit is exceeded
 */
export class TooManyRequestsError extends AppError {
    retryAfter;
    constructor(message = 'Too many requests', retryAfter) {
        super(message, 429);
        this.name = 'TooManyRequestsError';
        this.retryAfter = retryAfter;
    }
}
