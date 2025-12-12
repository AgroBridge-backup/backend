import { AppError } from './AppError.js';
/**
 * InternalServerError - 500 Internal Server Error
 * Thrown for unexpected server errors
 */
export class InternalServerError extends AppError {
    details;
    constructor(message = 'Internal server error', details) {
        super(message, 500);
        this.name = 'InternalServerError';
        this.details = details;
    }
}
