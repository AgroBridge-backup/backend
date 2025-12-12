import { AppError } from "./AppError.js";
export class TokenExpiredError extends AppError {
    name;
    constructor(message = 'Token has expired') {
        super(message, 401);
        this.name = 'TokenExpiredError';
    }
}
