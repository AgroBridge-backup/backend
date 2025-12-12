package com.agrobridge.data.repository

import com.agrobridge.data.dto.*
import com.agrobridge.data.remote.AuthApiService
import com.agrobridge.data.security.TokenManager
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

/**
 * AuthRepository - Lógica de negocio para autenticación
 *
 * Responsabilidades:
 * - Manejar login/logout
 * - Gestionar renovación de tokens
 * - Validar sesiones
 * - Coordinar entre API y TokenManager
 *
 * Flujo de login:
 * 1. login(email, password)
 * 2. AuthApiService.login() → TokenResponse
 * 3. TokenManager.saveTokens() [cifrado]
 * 4. Retornar UserDto
 *
 * Flujo de refresh:
 * 1. refreshToken()
 * 2. Obtener refresh_token de TokenManager
 * 3. AuthApiService.refreshToken() → TokenResponse
 * 4. TokenManager.saveTokens() [cifrado]
 * 5. Retornar nuevo access_token
 */
@Singleton
class AuthRepository @Inject constructor(
    private val authApiService: AuthApiService,
    private val tokenManager: TokenManager
) {

    /**
     * Iniciar sesión con credenciales
     *
     * @param email Email del usuario
     * @param password Contraseña
     * @return Result<UserDto> con información del usuario si tiene éxito
     */
    suspend fun login(email: String, password: String): Result<UserDto> {
        return try {
            Timber.d("🔐 Iniciando sesión para: $email")

            // Validar credenciales básicas
            if (email.isBlank() || password.isBlank()) {
                return Result.failure(
                    IllegalArgumentException("Email y contraseña requeridos")
                )
            }

            // Llamar al API de login
            val request = LoginRequest(email, password)
            val response = authApiService.login(request)

            if (response.isSuccessful && response.body() != null) {
                val tokenResponse = response.body()!!

                // Guardar tokens de forma segura (AES-256-GCM)
                tokenManager.saveTokens(
                    accessToken = tokenResponse.accessToken,
                    refreshToken = tokenResponse.refreshToken,
                    expiresInSeconds = tokenResponse.expiresIn
                )

                // Retornar información del usuario
                val user = tokenResponse.user
                if (user != null) {
                    Timber.d("✅ Login exitoso para: ${user.email}")
                    Result.success(user)
                } else {
                    Timber.w("⚠ Login exitoso pero sin datos de usuario")
                    Result.failure(Exception("Respuesta incompleta del servidor"))
                }
            } else {
                // Error HTTP (401, 400, 500, etc.)
                val errorMessage = when (response.code()) {
                    400 -> "Datos inválidos"
                    401 -> "Credenciales incorrectas"
                    403 -> "Acceso denegado"
                    500 -> "Error del servidor"
                    else -> "Error ${response.code()}: ${response.message()}"
                }
                Timber.e("❌ Login fallido: $errorMessage")
                Result.failure(Exception(errorMessage))
            }
        } catch (e: Exception) {
            Timber.e(e, "❌ Excepción durante login")
            Result.failure(e)
        }
    }

    /**
     * Renovar access_token usando refresh_token
     *
     * Se llama automáticamente cuando:
     * - Access token está próximo a expirar
     * - Se recibe error 401 (Unauthorized) en API call
     *
     * @return Result<String> con nuevo access_token si tiene éxito
     */
    suspend fun refreshToken(): Result<String> {
        return try {
            Timber.d("🔄 Renovando token de acceso...")

            // Obtener refresh token guardado
            val refreshToken = tokenManager.getRefreshToken()
            if (refreshToken.isNullOrEmpty()) {
                Timber.e("❌ Refresh token no disponible")
                return Result.failure(
                    IllegalStateException("Sesión inválida: no hay refresh token")
                )
            }

            // Llamar al API de refresh
            val request = RefreshTokenRequest(refreshToken)
            val response = authApiService.refreshToken(request)

            if (response.isSuccessful && response.body() != null) {
                val tokenResponse = response.body()!!

                // Guardar nuevos tokens
                tokenManager.saveTokens(
                    accessToken = tokenResponse.accessToken,
                    refreshToken = tokenResponse.refreshToken,
                    expiresInSeconds = tokenResponse.expiresIn
                )

                Timber.d("✅ Token renovado exitosamente")
                Result.success(tokenResponse.accessToken)
            } else {
                val errorMessage = when (response.code()) {
                    401 -> "Refresh token expirado, debe iniciar sesión nuevamente"
                    400 -> "Solicitud inválida"
                    500 -> "Error del servidor"
                    else -> "Error ${response.code()}: ${response.message()}"
                }
                Timber.e("❌ Renovación de token fallida: $errorMessage")

                // Si refresh token también está inválido, limpiar sesión
                if (response.code() == 401) {
                    tokenManager.clearTokens()
                }

                Result.failure(Exception(errorMessage))
            }
        } catch (e: Exception) {
            Timber.e(e, "❌ Excepción durante renovación de token")
            Result.failure(e)
        }
    }

    /**
     * Cerrar sesión e invalidar tokens
     *
     * @return Result<Unit> indicando éxito o fallo
     */
    suspend fun logout(): Result<Unit> {
        return try {
            Timber.d("🚪 Cerrando sesión...")

            // Obtener access token actual
            val accessToken = tokenManager.getAccessToken()
            if (accessToken != null) {
                try {
                    // Notificar al servidor
                    val request = LogoutRequest(accessToken)
                    val response = authApiService.logout(request)

                    if (response.isSuccessful) {
                        Timber.d("✅ Logout confirmado por servidor")
                    } else {
                        Timber.w("⚠ Servidor no confirmó logout: ${response.code()}")
                        // Continuar con limpieza local de todas formas
                    }
                } catch (e: Exception) {
                    Timber.w(e, "⚠ No se pudo notificar al servidor, limpiando tokens locales")
                    // Continuar con limpieza local
                }
            }

            // Limpiar tokens locales (siempre hacerlo)
            tokenManager.clearTokens()
            Timber.d("✅ Sesión cerrada, tokens eliminados")
            Result.success(Unit)
        } catch (e: Exception) {
            Timber.e(e, "❌ Error durante logout")
            Result.failure(e)
        }
    }

    /**
     * Solicitar reset de contraseña
     *
     * @param email Email del usuario
     * @return Result<Unit> indicando que se envió email
     */
    suspend fun requestPasswordReset(email: String): Result<Unit> {
        return try {
            Timber.d("📧 Solicitando reset de contraseña para: $email")

            if (email.isBlank()) {
                return Result.failure(
                    IllegalArgumentException("Email requerido")
                )
            }

            val request = PasswordResetRequest(email)
            val response = authApiService.requestPasswordReset(request)

            if (response.isSuccessful) {
                Timber.d("✅ Email de reset enviado a: $email")
                Result.success(Unit)
            } else {
                val errorMessage = "Error ${response.code()}: ${response.message()}"
                Timber.e("❌ Fallo al solicitar reset: $errorMessage")
                Result.failure(Exception(errorMessage))
            }
        } catch (e: Exception) {
            Timber.e(e, "❌ Excepción durante password reset request")
            Result.failure(e)
        }
    }

    /**
     * Confirmar nueva contraseña con token de reset
     *
     * @param token Token del email de reset
     * @param newPassword Nueva contraseña
     * @return Result<Unit> indicando éxito
     */
    suspend fun confirmPasswordReset(token: String, newPassword: String): Result<Unit> {
        return try {
            Timber.d("🔐 Confirmando nueva contraseña...")

            if (token.isBlank() || newPassword.isBlank()) {
                return Result.failure(
                    IllegalArgumentException("Token y contraseña requeridos")
                )
            }

            val request = PasswordConfirmRequest(token, newPassword)
            val response = authApiService.confirmPasswordReset(request)

            if (response.isSuccessful) {
                Timber.d("✅ Contraseña actualizada exitosamente")
                Result.success(Unit)
            } else {
                val errorMessage = "Error ${response.code()}: ${response.message()}"
                Timber.e("❌ Fallo al confirmar nueva contraseña: $errorMessage")
                Result.failure(Exception(errorMessage))
            }
        } catch (e: Exception) {
            Timber.e(e, "❌ Excepción durante password confirm")
            Result.failure(e)
        }
    }

    /**
     * Verificar si hay sesión válida
     *
     * @return true si hay access_token válido, false de lo contrario
     */
    fun hasValidSession(): Boolean {
        return tokenManager.hasValidSession()
    }

    /**
     * Obtener usuario actual si existe sesión válida
     * (requeriría guardar UserDto en TokenManager para implementar completamente)
     *
     * @return Información del usuario si está disponible
     */
    fun getCurrentUser(): Result<UserDto> {
        return if (tokenManager.hasValidSession()) {
            // En producción, recuperar del TokenManager o de SharedPreferences
            Result.failure(Exception("getUserInfo no implementado aún"))
        } else {
            Result.failure(Exception("No hay sesión activa"))
        }
    }
}
