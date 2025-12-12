import { AppError } from "./AppError";

export class ProducerNotWhitelistedError extends AppError {
  constructor(message: string) {
    super(message, 403);
    this.name = 'ProducerNotWhitelistedError';
  }
}
