import { AppError } from "./AppError";

export class InsufficientPermissionsError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403);
    this.name = 'InsufficientPermissionsError';
  }
}
