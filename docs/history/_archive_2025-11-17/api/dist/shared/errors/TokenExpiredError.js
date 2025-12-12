import { AppError } from "./AppError";
export class TokenExpiredError extends AppError {
    constructor(message = 'Token has expired') {
        super(message, 401);
        this.name = 'TokenExpiredError';
    }
}
//# sourceMappingURL=TokenExpiredError.js.map