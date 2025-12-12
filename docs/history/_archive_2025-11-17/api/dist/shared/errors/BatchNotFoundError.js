import { AppError } from "./AppError";
export class BatchNotFoundError extends AppError {
    constructor(message) {
        super(message, 404);
        this.name = 'BatchNotFoundError';
    }
}
//# sourceMappingURL=BatchNotFoundError.js.map