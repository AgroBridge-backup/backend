import { AppError } from "./AppError";
export class BlockchainTransactionError extends AppError {
    constructor(message) {
        super(message, 503);
        this.name = 'BlockchainTransactionError';
    }
}
//# sourceMappingURL=BlockchainTransactionError.js.map