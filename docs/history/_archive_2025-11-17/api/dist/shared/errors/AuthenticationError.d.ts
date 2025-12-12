import { AppError } from './AppError';
/**
 * Represents an error during the authentication process (e.g., invalid credentials).
 * Maps to an HTTP 401 Unauthorized status code.
 */
export declare class AuthenticationError extends AppError {
    constructor(message?: string);
}
//# sourceMappingURL=AuthenticationError.d.ts.map