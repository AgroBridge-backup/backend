package com.agrobridge.data.security

import okhttp3.Interceptor
import okhttp3.Response
import timber.log.Timber
import javax.inject.Inject

/**
 * AuthInterceptor - Agrega token JWT a todas las solicitudes salientes
 *
 * Responsabilidades:
 * - Interceptar todas las solicitudes HTTP
 * - Agregar header Authorization: Bearer {access_token}
 * - Validar que el token no esté expirado
 * - Saltar header si no hay token (para login, reset password, etc.)
 *
 * Flujo:
 * 1. Interceptor.intercept(chain) es llamado antes de cada request
 * 2. Obtener access_token de TokenManager
 * 3. Si hay token válido, agregarlo a header: Authorization
 * 4. Dejar que la solicitud continúe
 * 5. TokenRefreshInterceptor maneja 401 (token expirado)
 *
 * Seguridad:
 * - Token se obtiene cifrado de EncryptedSharedPreferences
 * - Token se agrega en memoria (no persiste)
 * - Se valida expiración antes de usar
 * - Endpoints públicos (login, reset) no reciben token
 */
class AuthInterceptor @Inject constructor(
    private val tokenManager: TokenManager
) : Interceptor {

    companion object {
        private const val HEADER_AUTHORIZATION = "Authorization"
        private const val TOKEN_TYPE = "Bearer"

        // Endpoints que NO requieren autenticación
        private val PUBLIC_ENDPOINTS = setOf(
            "/auth/login",
            "/auth/password-reset",
            "/auth/password-confirm",
            "/auth/refresh",
            "/public/",
            "/health"
        )
    }

    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()
        val requestPath = originalRequest.url.encodedPath

        // Verificar si es un endpoint público que no requiere token
        val isPublicEndpoint = PUBLIC_ENDPOINTS.any { endpoint ->
            requestPath.contains(endpoint)
        }

        if (isPublicEndpoint) {
            Timber.d("🌐 Endpoint público, sin token: $requestPath")
            return chain.proceed(originalRequest)
        }

        // Obtener access_token del TokenManager (cifrado)
        val accessToken = tokenManager.getAccessToken()

        if (accessToken == null) {
            Timber.w("⚠ No hay access_token disponible para: $requestPath")
            // Proceder sin token, TokenRefreshInterceptor manejará 401
            return chain.proceed(originalRequest)
        }

        // Validar que el token no esté expirado (con buffer)
        if (!tokenManager.isTokenValid()) {
            Timber.w("⚠ Token expirado o próximo a expirar para: $requestPath")
            // Proceder sin token válido, TokenRefreshInterceptor manejará 401
            return chain.proceed(originalRequest)
        }

        // Construir nuevo request con header Authorization
        val authenticatedRequest = originalRequest.newBuilder()
            .header(HEADER_AUTHORIZATION, "$TOKEN_TYPE $accessToken")
            .build()

        Timber.d("🔐 Token agregado a request: $requestPath")

        return try {
            chain.proceed(authenticatedRequest)
        } catch (e: Exception) {
            Timber.e(e, "❌ Error en AuthInterceptor")
            throw e
        }
    }
}
