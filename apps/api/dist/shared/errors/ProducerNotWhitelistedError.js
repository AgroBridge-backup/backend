import { AppError } from "./AppError.js";
export class ProducerNotWhitelistedError extends AppError {
    name;
    constructor(message) {
        super(message, 403);
        this.name = 'ProducerNotWhitelistedError';
    }
}
