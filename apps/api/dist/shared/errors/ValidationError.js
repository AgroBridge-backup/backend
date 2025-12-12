import { AppError } from './AppError.js';
/**
 * ValidationError - 400 Bad Request
 * Thrown when request data fails validation
 */
export class ValidationError extends AppError {
    details;
    constructor(message = 'Validation failed', details) {
        super(message, 400);
        this.name = 'ValidationError';
        this.details = details;
    }
}
