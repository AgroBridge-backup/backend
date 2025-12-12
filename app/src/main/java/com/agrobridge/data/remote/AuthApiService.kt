package com.agrobridge.data.remote

import com.agrobridge.data.dto.*
import retrofit2.Response
import retrofit2.http.*

/**
 * AuthApiService - Interfaz Retrofit para endpoints de autenticación
 *
 * Responsabilidades:
 * - Definir contratos REST para autenticación
 * - Login (email + password)
 * - Refresh token (renovar access_token)
 * - Logout (invalidar sesión)
 * - Password reset (recuperación de cuenta)
 *
 * Seguridad:
 * - Todas las respuestas pueden ser errores, ver ErrorResponse
 * - El servidor retorna status codes HTTP estándar:
 *   - 200: Éxito
 *   - 400: Bad Request (datos inválidos)
 *   - 401: Unauthorized (credenciales inválidas, token expirado)
 *   - 403: Forbidden (acceso denegado)
 *   - 500: Server Error
 */
interface AuthApiService {

    // ========================================================================
    // LOGIN & AUTHENTICATION
    // ========================================================================

    /**
     * Login - Obtener tokens JWT con credenciales
     *
     * Endpoint:
     * POST /v1/auth/login
     * Content-Type: application/json
     *
     * Request:
     * {
     *   "email": "farmer@example.com",
     *   "password": "secure_password"
     * }
     *
     * Response 200:
     * {
     *   "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     *   "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     *   "token_type": "Bearer",
     *   "expires_in": 3600,
     *   "user": { ... }
     * }
     *
     * Response 401:
     * {
     *   "error": "INVALID_CREDENTIALS",
     *   "message": "Email o contraseña incorrectos"
     * }
     *
     * @param request LoginRequest con email y password
     * @return Response<TokenResponse> con tokens y info del usuario
     */
    @POST("auth/login")
    suspend fun login(
        @Body request: LoginRequest
    ): Response<TokenResponse>

    // ========================================================================
    // TOKEN REFRESH
    // ========================================================================

    /**
     * Refresh - Obtener nuevo access_token usando refresh_token
     *
     * Endpoint:
     * POST /v1/auth/refresh
     * Authorization: Bearer {access_token}
     * Content-Type: application/json
     *
     * Request:
     * {
     *   "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
     * }
     *
     * Response 200:
     * {
     *   "access_token": "new_token...",
     *   "refresh_token": "new_refresh_token...",
     *   "token_type": "Bearer",
     *   "expires_in": 3600
     * }
     *
     * Response 401:
     * {
     *   "error": "INVALID_REFRESH_TOKEN",
     *   "message": "Refresh token ha expirado o es inválido"
     * }
     *
     * @param request RefreshTokenRequest con refresh token
     * @return Response<TokenResponse> con nuevos tokens
     */
    @POST("auth/refresh")
    suspend fun refreshToken(
        @Body request: RefreshTokenRequest
    ): Response<TokenResponse>

    // ========================================================================
    // LOGOUT
    // ========================================================================

    /**
     * Logout - Invalidar sesión actual
     *
     * Endpoint:
     * POST /v1/auth/logout
     * Authorization: Bearer {access_token}
     * Content-Type: application/json
     *
     * Request:
     * {
     *   "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
     * }
     *
     * Response 200:
     * {
     *   "message": "Logout exitoso"
     * }
     *
     * @param request LogoutRequest con token a invalidar
     * @return Response<Map<String, String>> con mensaje de confirmación
     */
    @POST("auth/logout")
    suspend fun logout(
        @Body request: LogoutRequest
    ): Response<Map<String, String>>

    // ========================================================================
    // PASSWORD RECOVERY
    // ========================================================================

    /**
     * Solicitar reset de contraseña
     *
     * Endpoint:
     * POST /v1/auth/password-reset
     * Content-Type: application/json
     *
     * Request:
     * {
     *   "email": "farmer@example.com"
     * }
     *
     * Response 200:
     * {
     *   "message": "Email de recuperación enviado"
     * }
     *
     * @param request PasswordResetRequest con email
     * @return Response<Map<String, String>> con confirmación
     */
    @POST("auth/password-reset")
    suspend fun requestPasswordReset(
        @Body request: PasswordResetRequest
    ): Response<Map<String, String>>

    /**
     * Confirmar nueva contraseña con token de reset
     *
     * Endpoint:
     * POST /v1/auth/password-confirm
     * Content-Type: application/json
     *
     * Request:
     * {
     *   "token": "reset_token_from_email",
     *   "password": "new_password_123"
     * }
     *
     * Response 200:
     * {
     *   "message": "Contraseña actualizada exitosamente"
     * }
     *
     * @param request PasswordConfirmRequest con token y nueva contraseña
     * @return Response<Map<String, String>> con confirmación
     */
    @POST("auth/password-confirm")
    suspend fun confirmPasswordReset(
        @Body request: PasswordConfirmRequest
    ): Response<Map<String, String>>

    // ========================================================================
    // VERIFY SESSION
    // ========================================================================

    /**
     * Verificar si la sesión actual es válida
     *
     * Endpoint:
     * GET /v1/auth/verify
     * Authorization: Bearer {access_token}
     *
     * Response 200:
     * {
     *   "valid": true,
     *   "user": { ... }
     * }
     *
     * Response 401:
     * {
     *   "valid": false,
     *   "error": "Token expirado"
     * }
     *
     * @return Response<Map<String, Any>> con estado de validez
     */
    @GET("auth/verify")
    suspend fun verifySession(): Response<Map<String, Any>>
}
