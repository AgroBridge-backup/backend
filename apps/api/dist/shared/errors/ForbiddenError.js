import { AppError } from './AppError.js';
/**
 * ForbiddenError - 403 Forbidden
 * Thrown when user is authenticated but lacks permissions
 */
export class ForbiddenError extends AppError {
    constructor(message = 'Insufficient permissions to access this resource') {
        super(message, 403);
        this.name = 'ForbiddenError';
    }
}
