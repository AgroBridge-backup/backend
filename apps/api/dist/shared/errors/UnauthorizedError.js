import { AppError } from './AppError.js';
/**
 * Represents an error when an action is attempted without authentication.
 * Maps to an HTTP 401 Unauthorized status code.
 */
export class UnauthorizedError extends AppError {
    constructor(message = 'Authentication is required to access this resource.') {
        super(message, 401);
        this.name = 'UnauthorizedError';
    }
}
