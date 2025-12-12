import { AppError } from "./AppError.js";

export class BatchNotFoundError extends AppError {
  public name: string;
  constructor(message: string) {
    super(message, 404);
    this.name = 'BatchNotFoundError';
  }
}
