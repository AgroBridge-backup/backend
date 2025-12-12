import { AppError } from "./AppError.js";
export class BlockchainTransactionError extends AppError {
    name;
    constructor(message) {
        super(message, 503);
        this.name = 'BlockchainTransactionError';
    }
}
