package com.agrobridge.data.dto

import com.google.gson.annotations.SerializedName

/**
 * AuthDtos - Modelos de transferencia de datos para autenticación
 *
 * Flujo de autenticación:
 * 1. Cliente → LoginRequest → Backend
 * 2. Backend → TokenResponse (access_token + refresh_token)
 * 3. Client almacena tokens en TokenManager (cifrados)
 * 4. Client envía access_token en header: Authorization: Bearer {token}
 * 5. Si access_token expira → Cliente envía RefreshTokenRequest
 * 6. Backend → TokenResponse (nuevo access_token)
 */

// ============================================================================
// LOGIN REQUEST
// ============================================================================

/**
 * LoginRequest - Credenciales de inicio de sesión
 *
 * Endpoints:
 * POST /v1/auth/login
 * Content-Type: application/json
 *
 * {
 *   "email": "farmer@agrobridge.com",
 *   "password": "secure_password_123"
 * }
 */
data class LoginRequest(
    @SerializedName("email")
    val email: String,

    @SerializedName("password")
    val password: String
) {
    init {
        require(email.isNotBlank()) { "Email no puede estar vacío" }
        require(password.isNotBlank()) { "Contraseña no puede estar vacía" }
    }
}

// ============================================================================
// TOKEN RESPONSE
// ============================================================================

/**
 * TokenResponse - Respuesta con tokens JWT
 *
 * Response:
 * {
 *   "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   "token_type": "Bearer",
 *   "expires_in": 3600,
 *   "user": { ... }
 * }
 */
data class TokenResponse(
    @SerializedName("access_token")
    val accessToken: String,

    @SerializedName("refresh_token")
    val refreshToken: String,

    @SerializedName("token_type")
    val tokenType: String = "Bearer",

    @SerializedName("expires_in")
    val expiresIn: Long, // Segundos

    @SerializedName("user")
    val user: UserDto? = null
)

/**
 * RefreshTokenRequest - Solicitar nuevo access_token
 *
 * Endpoint:
 * POST /v1/auth/refresh
 * Authorization: Bearer {access_token}
 * Content-Type: application/json
 *
 * {
 *   "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 * }
 */
data class RefreshTokenRequest(
    @SerializedName("refresh_token")
    val refreshToken: String
) {
    init {
        require(refreshToken.isNotBlank()) { "Refresh token no puede estar vacío" }
    }
}

// ============================================================================
// LOGOUT REQUEST
// ============================================================================

/**
 * LogoutRequest - Solicitar invalidación de sesión
 *
 * Endpoint:
 * POST /v1/auth/logout
 * Authorization: Bearer {access_token}
 * Content-Type: application/json
 *
 * {
 *   "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 * }
 */
data class LogoutRequest(
    @SerializedName("access_token")
    val accessToken: String
)

// ============================================================================
// USER DATA TRANSFER OBJECT
// ============================================================================

/**
 * UserDto - Información del usuario autenticado
 *
 * Incluido en TokenResponse después de login exitoso
 */
data class UserDto(
    @SerializedName("id")
    val id: String,

    @SerializedName("email")
    val email: String,

    @SerializedName("first_name")
    val firstName: String,

    @SerializedName("last_name")
    val lastName: String,

    @SerializedName("role")
    val role: String, // "farmer", "importer", "admin"

    @SerializedName("profile_picture_url")
    val profilePictureUrl: String? = null,

    @SerializedName("phone")
    val phone: String? = null,

    @SerializedName("verified_at")
    val verifiedAt: Long? = null,

    @SerializedName("last_login_at")
    val lastLoginAt: Long? = null,

    @SerializedName("created_at")
    val createdAt: Long = System.currentTimeMillis()
)

// ============================================================================
// ERROR RESPONSE
// ============================================================================

/**
 * ErrorResponse - Respuesta de error estándar
 *
 * {
 *   "error": "INVALID_CREDENTIALS",
 *   "message": "Email o contraseña incorrectos",
 *   "details": { ... }
 * }
 */
data class ErrorResponse(
    @SerializedName("error")
    val error: String,

    @SerializedName("message")
    val message: String,

    @SerializedName("details")
    val details: Map<String, Any>? = null,

    @SerializedName("timestamp")
    val timestamp: Long = System.currentTimeMillis()
)

// ============================================================================
// PASSWORD RESET / ACCOUNT RECOVERY
// ============================================================================

/**
 * PasswordResetRequest - Solicitar reset de contraseña
 *
 * Endpoint:
 * POST /v1/auth/password-reset
 * Content-Type: application/json
 *
 * {
 *   "email": "farmer@agrobridge.com"
 * }
 */
data class PasswordResetRequest(
    @SerializedName("email")
    val email: String
) {
    init {
        require(email.isNotBlank()) { "Email no puede estar vacío" }
    }
}

/**
 * PasswordConfirmRequest - Confirmar nueva contraseña
 *
 * Endpoint:
 * POST /v1/auth/password-confirm
 * Content-Type: application/json
 *
 * {
 *   "token": "reset_token_from_email",
 *   "password": "new_password_123"
 * }
 */
data class PasswordConfirmRequest(
    @SerializedName("token")
    val token: String,

    @SerializedName("password")
    val newPassword: String
) {
    init {
        require(token.isNotBlank()) { "Token no puede estar vacío" }
        require(newPassword.isNotBlank()) { "Nueva contraseña no puede estar vacía" }
        require(newPassword.length >= 8) { "Contraseña debe tener al menos 8 caracteres" }
    }
}
