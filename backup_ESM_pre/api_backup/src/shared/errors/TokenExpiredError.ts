import { AppError } from "./AppError";

export class TokenExpiredError extends AppError {
  public name: string;
  constructor(message = 'Token has expired') {
    super(message, 401);
    this.name = 'TokenExpiredError';
  }
}
