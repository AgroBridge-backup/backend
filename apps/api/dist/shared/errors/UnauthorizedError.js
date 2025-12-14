import { AppError } from './AppError.js';
export class UnauthorizedError extends AppError {
    constructor(message = 'Authentication is required to access this resource.') {
        super(message, 401);
        this.name = 'UnauthorizedError';
    }
}
