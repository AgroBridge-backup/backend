import { AppError } from "./AppError";

export class BlockchainTransactionError extends AppError {
  public name: string;
  constructor(message: string) {
    super(message, 503);
    this.name = 'BlockchainTransactionError';
  }
}
