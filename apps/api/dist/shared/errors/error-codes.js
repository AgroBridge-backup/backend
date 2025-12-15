export var ErrorCode;
(function (ErrorCode) {
    ErrorCode["AUTH_TOKEN_MISSING"] = "AUTH_TOKEN_MISSING";
    ErrorCode["AUTH_TOKEN_INVALID"] = "AUTH_TOKEN_INVALID";
    ErrorCode["AUTH_TOKEN_EXPIRED"] = "AUTH_TOKEN_EXPIRED";
    ErrorCode["AUTH_TOKEN_REVOKED"] = "AUTH_TOKEN_REVOKED";
    ErrorCode["AUTH_CREDENTIALS_INVALID"] = "AUTH_CREDENTIALS_INVALID";
    ErrorCode["AUTH_ACCOUNT_DISABLED"] = "AUTH_ACCOUNT_DISABLED";
    ErrorCode["AUTH_ACCOUNT_LOCKED"] = "AUTH_ACCOUNT_LOCKED";
    ErrorCode["AUTH_EMAIL_NOT_VERIFIED"] = "AUTH_EMAIL_NOT_VERIFIED";
    ErrorCode["AUTH_2FA_REQUIRED"] = "AUTH_2FA_REQUIRED";
    ErrorCode["AUTH_2FA_INVALID"] = "AUTH_2FA_INVALID";
    ErrorCode["AUTH_2FA_EXPIRED"] = "AUTH_2FA_EXPIRED";
    ErrorCode["AUTH_REFRESH_TOKEN_INVALID"] = "AUTH_REFRESH_TOKEN_INVALID";
    ErrorCode["AUTH_SESSION_EXPIRED"] = "AUTH_SESSION_EXPIRED";
    ErrorCode["FORBIDDEN_ACCESS_DENIED"] = "FORBIDDEN_ACCESS_DENIED";
    ErrorCode["FORBIDDEN_INSUFFICIENT_ROLE"] = "FORBIDDEN_INSUFFICIENT_ROLE";
    ErrorCode["FORBIDDEN_RESOURCE_OWNERSHIP"] = "FORBIDDEN_RESOURCE_OWNERSHIP";
    ErrorCode["FORBIDDEN_ADMIN_ONLY"] = "FORBIDDEN_ADMIN_ONLY";
    ErrorCode["FORBIDDEN_PRODUCER_ONLY"] = "FORBIDDEN_PRODUCER_ONLY";
    ErrorCode["FORBIDDEN_SUBSCRIPTION_REQUIRED"] = "FORBIDDEN_SUBSCRIPTION_REQUIRED";
    ErrorCode["VALIDATION_FAILED"] = "VALIDATION_FAILED";
    ErrorCode["VALIDATION_REQUIRED_FIELD"] = "VALIDATION_REQUIRED_FIELD";
    ErrorCode["VALIDATION_INVALID_FORMAT"] = "VALIDATION_INVALID_FORMAT";
    ErrorCode["VALIDATION_INVALID_EMAIL"] = "VALIDATION_INVALID_EMAIL";
    ErrorCode["VALIDATION_INVALID_PASSWORD"] = "VALIDATION_INVALID_PASSWORD";
    ErrorCode["VALIDATION_PASSWORD_TOO_WEAK"] = "VALIDATION_PASSWORD_TOO_WEAK";
    ErrorCode["VALIDATION_INVALID_PHONE"] = "VALIDATION_INVALID_PHONE";
    ErrorCode["VALIDATION_INVALID_UUID"] = "VALIDATION_INVALID_UUID";
    ErrorCode["VALIDATION_INVALID_DATE"] = "VALIDATION_INVALID_DATE";
    ErrorCode["VALIDATION_OUT_OF_RANGE"] = "VALIDATION_OUT_OF_RANGE";
    ErrorCode["VALIDATION_STRING_TOO_LONG"] = "VALIDATION_STRING_TOO_LONG";
    ErrorCode["VALIDATION_STRING_TOO_SHORT"] = "VALIDATION_STRING_TOO_SHORT";
    ErrorCode["VALIDATION_INVALID_ENUM"] = "VALIDATION_INVALID_ENUM";
    ErrorCode["VALIDATION_FILE_TOO_LARGE"] = "VALIDATION_FILE_TOO_LARGE";
    ErrorCode["VALIDATION_INVALID_FILE_TYPE"] = "VALIDATION_INVALID_FILE_TYPE";
    ErrorCode["RESOURCE_NOT_FOUND"] = "RESOURCE_NOT_FOUND";
    ErrorCode["RESOURCE_USER_NOT_FOUND"] = "RESOURCE_USER_NOT_FOUND";
    ErrorCode["RESOURCE_PRODUCER_NOT_FOUND"] = "RESOURCE_PRODUCER_NOT_FOUND";
    ErrorCode["RESOURCE_BATCH_NOT_FOUND"] = "RESOURCE_BATCH_NOT_FOUND";
    ErrorCode["RESOURCE_EVENT_NOT_FOUND"] = "RESOURCE_EVENT_NOT_FOUND";
    ErrorCode["RESOURCE_ALREADY_EXISTS"] = "RESOURCE_ALREADY_EXISTS";
    ErrorCode["RESOURCE_EMAIL_EXISTS"] = "RESOURCE_EMAIL_EXISTS";
    ErrorCode["RESOURCE_CONFLICT"] = "RESOURCE_CONFLICT";
    ErrorCode["RESOURCE_GONE"] = "RESOURCE_GONE";
    ErrorCode["RATE_LIMIT_EXCEEDED"] = "RATE_LIMIT_EXCEEDED";
    ErrorCode["RATE_LIMIT_AUTH"] = "RATE_LIMIT_AUTH";
    ErrorCode["RATE_LIMIT_API"] = "RATE_LIMIT_API";
    ErrorCode["RATE_LIMIT_CREATION"] = "RATE_LIMIT_CREATION";
    ErrorCode["PAYMENT_REQUIRED"] = "PAYMENT_REQUIRED";
    ErrorCode["PAYMENT_FAILED"] = "PAYMENT_FAILED";
    ErrorCode["PAYMENT_INVALID_CARD"] = "PAYMENT_INVALID_CARD";
    ErrorCode["PAYMENT_SUBSCRIPTION_INACTIVE"] = "PAYMENT_SUBSCRIPTION_INACTIVE";
    ErrorCode["PAYMENT_QUOTA_EXCEEDED"] = "PAYMENT_QUOTA_EXCEEDED";
    ErrorCode["SECURITY_CSRF_INVALID"] = "SECURITY_CSRF_INVALID";
    ErrorCode["SECURITY_CSRF_MISSING"] = "SECURITY_CSRF_MISSING";
    ErrorCode["SECURITY_CSRF_EXPIRED"] = "SECURITY_CSRF_EXPIRED";
    ErrorCode["SECURITY_VIRUS_DETECTED"] = "SECURITY_VIRUS_DETECTED";
    ErrorCode["SECURITY_SUSPICIOUS_ACTIVITY"] = "SECURITY_SUSPICIOUS_ACTIVITY";
    ErrorCode["SECURITY_IP_BLOCKED"] = "SECURITY_IP_BLOCKED";
    ErrorCode["SYSTEM_INTERNAL_ERROR"] = "SYSTEM_INTERNAL_ERROR";
    ErrorCode["SYSTEM_DATABASE_ERROR"] = "SYSTEM_DATABASE_ERROR";
    ErrorCode["SYSTEM_EXTERNAL_SERVICE"] = "SYSTEM_EXTERNAL_SERVICE";
    ErrorCode["SYSTEM_MAINTENANCE"] = "SYSTEM_MAINTENANCE";
    ErrorCode["SYSTEM_UNAVAILABLE"] = "SYSTEM_UNAVAILABLE";
    ErrorCode["SYSTEM_TIMEOUT"] = "SYSTEM_TIMEOUT";
    ErrorCode["OAUTH_INVALID_CODE"] = "OAUTH_INVALID_CODE";
    ErrorCode["OAUTH_EXPIRED_CODE"] = "OAUTH_EXPIRED_CODE";
    ErrorCode["OAUTH_PROVIDER_ERROR"] = "OAUTH_PROVIDER_ERROR";
    ErrorCode["OAUTH_EMAIL_REQUIRED"] = "OAUTH_EMAIL_REQUIRED";
})(ErrorCode || (ErrorCode = {}));
export const ErrorMessages = {
    [ErrorCode.AUTH_TOKEN_MISSING]: 'Authentication token is required',
    [ErrorCode.AUTH_TOKEN_INVALID]: 'Invalid authentication token',
    [ErrorCode.AUTH_TOKEN_EXPIRED]: 'Authentication token has expired',
    [ErrorCode.AUTH_TOKEN_REVOKED]: 'Authentication token has been revoked',
    [ErrorCode.AUTH_CREDENTIALS_INVALID]: 'Invalid email or password',
    [ErrorCode.AUTH_ACCOUNT_DISABLED]: 'Account has been disabled',
    [ErrorCode.AUTH_ACCOUNT_LOCKED]: 'Account is temporarily locked due to too many failed attempts',
    [ErrorCode.AUTH_EMAIL_NOT_VERIFIED]: 'Email address has not been verified',
    [ErrorCode.AUTH_2FA_REQUIRED]: 'Two-factor authentication is required',
    [ErrorCode.AUTH_2FA_INVALID]: 'Invalid two-factor authentication code',
    [ErrorCode.AUTH_2FA_EXPIRED]: 'Two-factor authentication code has expired',
    [ErrorCode.AUTH_REFRESH_TOKEN_INVALID]: 'Invalid or expired refresh token',
    [ErrorCode.AUTH_SESSION_EXPIRED]: 'Session has expired, please log in again',
    [ErrorCode.FORBIDDEN_ACCESS_DENIED]: 'Access denied',
    [ErrorCode.FORBIDDEN_INSUFFICIENT_ROLE]: 'Insufficient permissions for this action',
    [ErrorCode.FORBIDDEN_RESOURCE_OWNERSHIP]: 'You do not have permission to access this resource',
    [ErrorCode.FORBIDDEN_ADMIN_ONLY]: 'This action is restricted to administrators',
    [ErrorCode.FORBIDDEN_PRODUCER_ONLY]: 'This action is restricted to producers',
    [ErrorCode.FORBIDDEN_SUBSCRIPTION_REQUIRED]: 'A subscription is required for this feature',
    [ErrorCode.VALIDATION_FAILED]: 'Request validation failed',
    [ErrorCode.VALIDATION_REQUIRED_FIELD]: 'Required field is missing',
    [ErrorCode.VALIDATION_INVALID_FORMAT]: 'Invalid format',
    [ErrorCode.VALIDATION_INVALID_EMAIL]: 'Invalid email address format',
    [ErrorCode.VALIDATION_INVALID_PASSWORD]: 'Password does not meet requirements',
    [ErrorCode.VALIDATION_PASSWORD_TOO_WEAK]: 'Password is too weak or commonly used',
    [ErrorCode.VALIDATION_INVALID_PHONE]: 'Invalid phone number format',
    [ErrorCode.VALIDATION_INVALID_UUID]: 'Invalid identifier format',
    [ErrorCode.VALIDATION_INVALID_DATE]: 'Invalid date format',
    [ErrorCode.VALIDATION_OUT_OF_RANGE]: 'Value is out of acceptable range',
    [ErrorCode.VALIDATION_STRING_TOO_LONG]: 'Value exceeds maximum length',
    [ErrorCode.VALIDATION_STRING_TOO_SHORT]: 'Value is below minimum length',
    [ErrorCode.VALIDATION_INVALID_ENUM]: 'Invalid option selected',
    [ErrorCode.VALIDATION_FILE_TOO_LARGE]: 'File size exceeds maximum allowed',
    [ErrorCode.VALIDATION_INVALID_FILE_TYPE]: 'File type is not allowed',
    [ErrorCode.RESOURCE_NOT_FOUND]: 'Resource not found',
    [ErrorCode.RESOURCE_USER_NOT_FOUND]: 'User not found',
    [ErrorCode.RESOURCE_PRODUCER_NOT_FOUND]: 'Producer not found',
    [ErrorCode.RESOURCE_BATCH_NOT_FOUND]: 'Batch not found',
    [ErrorCode.RESOURCE_EVENT_NOT_FOUND]: 'Event not found',
    [ErrorCode.RESOURCE_ALREADY_EXISTS]: 'Resource already exists',
    [ErrorCode.RESOURCE_EMAIL_EXISTS]: 'An account with this email already exists',
    [ErrorCode.RESOURCE_CONFLICT]: 'Resource conflict',
    [ErrorCode.RESOURCE_GONE]: 'Resource is no longer available',
    [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Too many requests, please try again later',
    [ErrorCode.RATE_LIMIT_AUTH]: 'Too many authentication attempts, please try again later',
    [ErrorCode.RATE_LIMIT_API]: 'API rate limit exceeded',
    [ErrorCode.RATE_LIMIT_CREATION]: 'Creation rate limit exceeded',
    [ErrorCode.PAYMENT_REQUIRED]: 'Payment is required to continue',
    [ErrorCode.PAYMENT_FAILED]: 'Payment processing failed',
    [ErrorCode.PAYMENT_INVALID_CARD]: 'Invalid payment card',
    [ErrorCode.PAYMENT_SUBSCRIPTION_INACTIVE]: 'Subscription is not active',
    [ErrorCode.PAYMENT_QUOTA_EXCEEDED]: 'Usage quota exceeded',
    [ErrorCode.SECURITY_CSRF_INVALID]: 'Invalid security token',
    [ErrorCode.SECURITY_CSRF_MISSING]: 'Security token is required',
    [ErrorCode.SECURITY_CSRF_EXPIRED]: 'Security token has expired',
    [ErrorCode.SECURITY_VIRUS_DETECTED]: 'File contains malware and was rejected',
    [ErrorCode.SECURITY_SUSPICIOUS_ACTIVITY]: 'Suspicious activity detected',
    [ErrorCode.SECURITY_IP_BLOCKED]: 'Access denied from this IP address',
    [ErrorCode.SYSTEM_INTERNAL_ERROR]: 'An unexpected error occurred',
    [ErrorCode.SYSTEM_DATABASE_ERROR]: 'Database operation failed',
    [ErrorCode.SYSTEM_EXTERNAL_SERVICE]: 'External service is unavailable',
    [ErrorCode.SYSTEM_MAINTENANCE]: 'System is under maintenance',
    [ErrorCode.SYSTEM_UNAVAILABLE]: 'Service is temporarily unavailable',
    [ErrorCode.SYSTEM_TIMEOUT]: 'Request timed out',
    [ErrorCode.OAUTH_INVALID_CODE]: 'Invalid authorization code',
    [ErrorCode.OAUTH_EXPIRED_CODE]: 'Authorization code has expired',
    [ErrorCode.OAUTH_PROVIDER_ERROR]: 'OAuth provider error',
    [ErrorCode.OAUTH_EMAIL_REQUIRED]: 'Email permission is required for authentication',
};
export const ErrorHttpStatus = {
    [ErrorCode.AUTH_TOKEN_MISSING]: 401,
    [ErrorCode.AUTH_TOKEN_INVALID]: 401,
    [ErrorCode.AUTH_TOKEN_EXPIRED]: 401,
    [ErrorCode.AUTH_TOKEN_REVOKED]: 401,
    [ErrorCode.AUTH_CREDENTIALS_INVALID]: 401,
    [ErrorCode.AUTH_ACCOUNT_DISABLED]: 401,
    [ErrorCode.AUTH_ACCOUNT_LOCKED]: 401,
    [ErrorCode.AUTH_EMAIL_NOT_VERIFIED]: 401,
    [ErrorCode.AUTH_2FA_REQUIRED]: 401,
    [ErrorCode.AUTH_2FA_INVALID]: 401,
    [ErrorCode.AUTH_2FA_EXPIRED]: 401,
    [ErrorCode.AUTH_REFRESH_TOKEN_INVALID]: 401,
    [ErrorCode.AUTH_SESSION_EXPIRED]: 401,
    [ErrorCode.FORBIDDEN_ACCESS_DENIED]: 403,
    [ErrorCode.FORBIDDEN_INSUFFICIENT_ROLE]: 403,
    [ErrorCode.FORBIDDEN_RESOURCE_OWNERSHIP]: 403,
    [ErrorCode.FORBIDDEN_ADMIN_ONLY]: 403,
    [ErrorCode.FORBIDDEN_PRODUCER_ONLY]: 403,
    [ErrorCode.FORBIDDEN_SUBSCRIPTION_REQUIRED]: 403,
    [ErrorCode.VALIDATION_FAILED]: 400,
    [ErrorCode.VALIDATION_REQUIRED_FIELD]: 400,
    [ErrorCode.VALIDATION_INVALID_FORMAT]: 400,
    [ErrorCode.VALIDATION_INVALID_EMAIL]: 400,
    [ErrorCode.VALIDATION_INVALID_PASSWORD]: 400,
    [ErrorCode.VALIDATION_PASSWORD_TOO_WEAK]: 400,
    [ErrorCode.VALIDATION_INVALID_PHONE]: 400,
    [ErrorCode.VALIDATION_INVALID_UUID]: 400,
    [ErrorCode.VALIDATION_INVALID_DATE]: 400,
    [ErrorCode.VALIDATION_OUT_OF_RANGE]: 400,
    [ErrorCode.VALIDATION_STRING_TOO_LONG]: 400,
    [ErrorCode.VALIDATION_STRING_TOO_SHORT]: 400,
    [ErrorCode.VALIDATION_INVALID_ENUM]: 400,
    [ErrorCode.VALIDATION_FILE_TOO_LARGE]: 400,
    [ErrorCode.VALIDATION_INVALID_FILE_TYPE]: 400,
    [ErrorCode.RESOURCE_NOT_FOUND]: 404,
    [ErrorCode.RESOURCE_USER_NOT_FOUND]: 404,
    [ErrorCode.RESOURCE_PRODUCER_NOT_FOUND]: 404,
    [ErrorCode.RESOURCE_BATCH_NOT_FOUND]: 404,
    [ErrorCode.RESOURCE_EVENT_NOT_FOUND]: 404,
    [ErrorCode.RESOURCE_ALREADY_EXISTS]: 409,
    [ErrorCode.RESOURCE_EMAIL_EXISTS]: 409,
    [ErrorCode.RESOURCE_CONFLICT]: 409,
    [ErrorCode.RESOURCE_GONE]: 410,
    [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
    [ErrorCode.RATE_LIMIT_AUTH]: 429,
    [ErrorCode.RATE_LIMIT_API]: 429,
    [ErrorCode.RATE_LIMIT_CREATION]: 429,
    [ErrorCode.PAYMENT_REQUIRED]: 402,
    [ErrorCode.PAYMENT_FAILED]: 402,
    [ErrorCode.PAYMENT_INVALID_CARD]: 402,
    [ErrorCode.PAYMENT_SUBSCRIPTION_INACTIVE]: 402,
    [ErrorCode.PAYMENT_QUOTA_EXCEEDED]: 402,
    [ErrorCode.SECURITY_CSRF_INVALID]: 403,
    [ErrorCode.SECURITY_CSRF_MISSING]: 403,
    [ErrorCode.SECURITY_CSRF_EXPIRED]: 403,
    [ErrorCode.SECURITY_VIRUS_DETECTED]: 400,
    [ErrorCode.SECURITY_SUSPICIOUS_ACTIVITY]: 403,
    [ErrorCode.SECURITY_IP_BLOCKED]: 403,
    [ErrorCode.SYSTEM_INTERNAL_ERROR]: 500,
    [ErrorCode.SYSTEM_DATABASE_ERROR]: 500,
    [ErrorCode.SYSTEM_EXTERNAL_SERVICE]: 502,
    [ErrorCode.SYSTEM_MAINTENANCE]: 503,
    [ErrorCode.SYSTEM_UNAVAILABLE]: 503,
    [ErrorCode.SYSTEM_TIMEOUT]: 504,
    [ErrorCode.OAUTH_INVALID_CODE]: 400,
    [ErrorCode.OAUTH_EXPIRED_CODE]: 400,
    [ErrorCode.OAUTH_PROVIDER_ERROR]: 502,
    [ErrorCode.OAUTH_EMAIL_REQUIRED]: 400,
};
export function getErrorMessage(code) {
    return ErrorMessages[code] || 'An error occurred';
}
export function getErrorStatus(code) {
    return ErrorHttpStatus[code] || 500;
}
export function isClientError(code) {
    const status = ErrorHttpStatus[code];
    return status >= 400 && status < 500;
}
export function isServerError(code) {
    const status = ErrorHttpStatus[code];
    return status >= 500;
}
export default ErrorCode;
