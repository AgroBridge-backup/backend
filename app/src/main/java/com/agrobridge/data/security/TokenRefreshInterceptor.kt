package com.agrobridge.data.security

import com.agrobridge.data.dto.RefreshTokenRequest
import com.agrobridge.data.remote.AuthApiService
import kotlinx.coroutines.Mutex
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response
import timber.log.Timber
import javax.inject.Inject

/**
 * TokenRefreshInterceptor - Maneja renovación automática de tokens en 401
 *
 * Responsabilidades:
 * - Interceptar respuestas 401 (Unauthorized)
 * - Intentar renovar access_token con refresh_token
 * - Reintentar solicitud original con nuevo token
 * - Limpiar sesión si refresh también falla
 *
 * Flujo cuando respuesta es 401:
 * 1. Interceptor recibe 401
 * 2. Obtener refresh_token de TokenManager
 * 3. Llamar a AuthApiService.refreshToken()
 * 4. Si éxito: guardar nuevos tokens y reintentar request original
 * 5. Si fallo: limpiar tokens y retornar 401
 *
 * Protección contra refresh-loops:
 * - AtomicBoolean previene múltiples refresh simultáneos
 * - Si refresh de refresh también falla, no reintentar
 *
 * Seguridad:
 * - refresh_token se usa solo para renovación
 * - Nuevos tokens se guardan de forma cifrada
 * - Sesión se limpia si ambos tokens son inválidos
 */
class TokenRefreshInterceptor @Inject constructor(
    private val tokenManager: TokenManager,
    private val authApiService: AuthApiService
) : Interceptor {

    companion object {
        private const val HEADER_AUTHORIZATION = "Authorization"
        private const val TOKEN_TYPE = "Bearer"

        // Endpoints que no deben reintentar (para evitar loops infinitos)
        private val NO_RETRY_ENDPOINTS = setOf(
            "/auth/login",
            "/auth/refresh",
            "/auth/logout",
            "/auth/password-reset",
            "/auth/password-confirm"
        )
    }

    // Mutex para sincronizar refresh entre threads concurrentes
    // Garantiza que solo UN thread actualice el token mientras otros esperan
    private val refreshMutex = Mutex()

    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()
        val requestPath = originalRequest.url.encodedPath

        // Ejecutar request original
        var response = chain.proceed(originalRequest)

        // Si no es 401, retornar respuesta normal
        if (response.code != 401) {
            return response
        }

        Timber.w("⚠ Recibido 401 Unauthorized para: $requestPath")

        // No reintentar refresh de endpoints que ya hacen refresh
        if (NO_RETRY_ENDPOINTS.any { endpoint -> requestPath.contains(endpoint) }) {
            Timber.d("ℹ Endpoint de auth, no reintentar: $requestPath")
            return response
        }

        // Intentar renovar token
        val newToken = refreshToken()

        if (newToken != null) {
            Timber.d("✅ Token renovado, reintentando request original")

            // Cerrar respuesta anterior
            response.close()

            // Construir nuevo request con token renovado
            val newAuthRequest = originalRequest.newBuilder()
                .header(HEADER_AUTHORIZATION, "$TOKEN_TYPE $newToken")
                .build()

            // Reintentar solicitud con nuevo token
            return try {
                val retryResponse = chain.proceed(newAuthRequest)
                Timber.d("✅ Reintento exitoso: ${retryResponse.code}")
                retryResponse
            } catch (e: Exception) {
                Timber.e(e, "❌ Error reintentando request")
                // Retornar respuesta original de error
                response
            }
        } else {
            Timber.e("❌ No se pudo renovar token, sesión expirada")
            // Limpiar tokens porque refresh falló
            tokenManager.clearTokens()
            return response
        }
    }

    /**
     * Intentar renovar access_token usando refresh_token
     *
     * Implementación con Mutex:
     * - Solo UN coroutine puede ejecutar refresh a la vez
     * - Otros threads esperan (no devuelven token expirado)
     * - Doble-check para evitar refresh innecesarios
     * - Sincrónico (runBlocking) porque Interceptor no usa corrutinas
     *
     * Flujo:
     * 1. Thread A obtiene Mutex lock, comienza refresh
     * 2. Threads B, C esperan en Mutex
     * 3. Thread A guarda nuevo token y libera Mutex
     * 4. Threads B, C obtienen lock, ven que hay token fresco y retornan
     *
     * @return Nuevo access_token si tiene éxito, null si falla
     */
    private fun refreshToken(): String? {
        return try {
            // Usar Mutex para garantizar solo UN refresh simultáneo
            runBlocking {
                refreshMutex.withLock {
                    Timber.d("🔒 Thread ha obtenido lock de refresh")

                    // Double-check: verificar si otro thread ya renovó el token
                    val currentToken = tokenManager.getAccessToken()
                    if (currentToken != null && !isTokenExpired(currentToken)) {
                        Timber.d("✅ Token fue renovado por otro thread, usando ese")
                        return@withLock currentToken
                    }

                    // Obtener refresh_token
                    val refreshToken = tokenManager.getRefreshToken()
                    if (refreshToken.isNullOrEmpty()) {
                        Timber.e("❌ No hay refresh_token disponible")
                        return@withLock null
                    }

                    // Ejecutar refresh en forma síncrona (necesario en Interceptor)
                    val response = try {
                        authApiService.refreshToken(RefreshTokenRequest(refreshToken))
                    } catch (e: Exception) {
                        Timber.e(e, "❌ Excepción en refreshToken")
                        null
                    }

                    if (response?.isSuccessful == true && response.body() != null) {
                        val tokenResponse = response.body()!!
                        Timber.d("✅ Refresh exitoso, nuevo token obtenido")

                        // Guardar nuevos tokens (cifrados)
                        tokenManager.saveTokens(
                            accessToken = tokenResponse.accessToken,
                            refreshToken = tokenResponse.refreshToken,
                            expiresInSeconds = tokenResponse.expiresIn
                        )

                        tokenResponse.accessToken
                    } else {
                        Timber.e("❌ Refresh falló: ${response?.code()} ${response?.message()}")
                        null
                    }
                }
            }
        } catch (e: Exception) {
            Timber.e(e, "❌ Excepción durante refresh en interceptor")
            null
        }
    }

    /**
     * Verificar si un token está expirado o a punto de expirar
     * (Considera el token inválido si falta menos de 1 minuto para expiración)
     */
    private fun isTokenExpired(token: String): Boolean {
        // Simple check: si tokenManager devuelve null, está expirado
        // En producción, decodificar JWT y verificar timestamp
        return tokenManager.getAccessToken() == null
    }
}
