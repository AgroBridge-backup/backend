import { AppError } from "./AppError.js";
export class BatchNotFoundError extends AppError {
    name;
    constructor(message) {
        super(message, 404);
        this.name = 'BatchNotFoundError';
    }
}
