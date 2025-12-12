import { AppError } from "./AppError";

export class BatchNotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
    this.name = 'BatchNotFoundError';
  }
}
