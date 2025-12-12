/**
 * Data Transfer Object for the login request.
 * Contains the credentials provided by the user.
 */
export interface LoginRequestDto {
    email: string;
    password: string;
}
/**
 * Data Transfer Object for the login response.
 * Contains the generated authentication tokens.
 */
export interface LoginResponseDto {
    accessToken: string;
    refreshToken: string;
}
//# sourceMappingURL=auth.dtos.d.ts.map