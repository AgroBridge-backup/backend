import { AppError } from './AppError.js';
/**
 * UnprocessableEntityError - 422 Unprocessable Entity
 * Thrown when the request is well-formed but semantically incorrect
 * Example: trying to create a batch for a non-whitelisted producer
 */
export class UnprocessableEntityError extends AppError {
    details;
    constructor(message = 'Cannot process request', details) {
        super(message, 422);
        this.name = 'UnprocessableEntityError';
        this.details = details;
    }
}
