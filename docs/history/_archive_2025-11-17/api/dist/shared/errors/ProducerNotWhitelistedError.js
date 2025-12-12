import { AppError } from "./AppError";
export class ProducerNotWhitelistedError extends AppError {
    constructor(message) {
        super(message, 403);
        this.name = 'ProducerNotWhitelistedError';
    }
}
//# sourceMappingURL=ProducerNotWhitelistedError.js.map