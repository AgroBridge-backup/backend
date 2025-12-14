import { AppError } from './AppError.js';
export class AuthenticationError extends AppError {
    name;
    constructor(message = 'Invalid email or password') {
        super(message, 401);
        this.name = 'AuthenticationError';
    }
}
