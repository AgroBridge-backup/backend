import { AppError } from "./AppError.js";
export class InsufficientPermissionsError extends AppError {
    name;
    constructor(message = 'Insufficient permissions') {
        super(message, 403);
        this.name = 'InsufficientPermissionsError';
    }
}
