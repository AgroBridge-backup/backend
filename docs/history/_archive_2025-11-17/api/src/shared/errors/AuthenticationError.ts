import { AppError } from './AppError';

/**
 * Represents an error during the authentication process (e.g., invalid credentials).
 * Maps to an HTTP 401 Unauthorized status code.
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Invalid email or password') {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}
