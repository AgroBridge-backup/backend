/**
 * Central export for all custom error classes
 * Import errors like: import { ValidationError, NotFoundError } from '../../shared/errors';
 */
export { AppError } from './AppError.js';
export { ValidationError } from './ValidationError.js';
export { UnauthorizedError } from './UnauthorizedError.js';
export { ForbiddenError } from './ForbiddenError.js';
export { NotFoundError } from './NotFoundError.js';
export { ConflictError } from './ConflictError.js';
export { UnprocessableEntityError } from './UnprocessableEntityError.js';
export { TooManyRequestsError } from './TooManyRequestsError.js';
export { InternalServerError } from './InternalServerError.js';
export { ServiceUnavailableError } from './ServiceUnavailableError.js';
// Domain-specific errors
export { AuthenticationError } from './AuthenticationError.js';
export { InsufficientPermissionsError } from './InsufficientPermissionsError.js';
export { InvalidTokenError } from './InvalidTokenError.js';
export { TokenExpiredError } from './TokenExpiredError.js';
export { ProducerNotWhitelistedError } from './ProducerNotWhitelistedError.js';
export { BatchNotFoundError } from './BatchNotFoundError.js';
export { BlockchainTransactionError } from './BlockchainTransactionError.js';
