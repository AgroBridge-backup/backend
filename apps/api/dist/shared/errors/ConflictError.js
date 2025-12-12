import { AppError } from './AppError.js';
/**
 * ConflictError - 409 Conflict
 * Thrown when a resource conflicts with existing state
 * Examples: duplicate email, cannot delete resource with dependencies
 */
export class ConflictError extends AppError {
    constructor(message = 'Resource conflict') {
        super(message, 409);
        this.name = 'ConflictError';
    }
}
