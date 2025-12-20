import { AppError } from "./AppError.js";

export class InvalidTokenError extends AppError {
  public name: string;
  constructor(message = 'Invalid token') {
    super(message, 401);
    this.name = 'InvalidTokenError';
  }
}
