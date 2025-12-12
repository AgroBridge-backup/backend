import { AppError } from './AppError.js';
/**
 * Represents an error during the authentication process (e.g., invalid credentials).
 * Maps to an HTTP 401 Unauthorized status code.
 */
export class AuthenticationError extends AppError {
    name;
    constructor(message = 'Invalid email or password') {
        super(message, 401);
        this.name = 'AuthenticationError';
    }
}
