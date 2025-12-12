package com.agrobridge.data.security

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

/**
 * TokenManager - Gestor seguro de tokens JWT con cifrado AES-256-GCM
 *
 * Responsabilidades:
 * - Almacenar tokens de acceso de forma segura con cifrado
 * - Almacenar refresh tokens para renovación automática
 * - Almacenar timestamp de expiración
 * - Proporcionar acceso rápido a tokens válidos
 * - Limpiar tokens cuando expire la sesión
 *
 * Seguridad:
 * - Usa EncryptedSharedPreferences (AES-256-GCM)
 * - MasterKey se genera automáticamente desde Keystore
 * - Tokens nunca se guardan en texto plano
 * - Tokens se validan antes de usar
 */
@Singleton
class TokenManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    companion object {
        private const val PREFERENCES_NAME = "agrobridge_encrypted_tokens"
        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
        private const val KEY_EXPIRES_AT = "expires_at"
        private const val KEY_TOKEN_TYPE = "token_type"
        private const val DEFAULT_TOKEN_TYPE = "Bearer"

        // Margen de seguridad (renovar token 5 minutos antes de expiración)
        private const val EXPIRATION_BUFFER_MS = 5 * 60 * 1000 // 5 minutos
    }

    private val sharedPreferences: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        EncryptedSharedPreferences.create(
            context,
            PREFERENCES_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    /**
     * Guardar tokens después de login o refresh exitoso
     * @param accessToken Token JWT de acceso
     * @param refreshToken Token para renovar acceso
     * @param expiresInSeconds Segundos hasta expiración (ej: 3600 para 1 hora)
     */
    fun saveTokens(accessToken: String, refreshToken: String, expiresInSeconds: Long) {
        try {
            sharedPreferences.edit().apply {
                putString(KEY_ACCESS_TOKEN, accessToken)
                putString(KEY_REFRESH_TOKEN, refreshToken)
                putString(KEY_TOKEN_TYPE, DEFAULT_TOKEN_TYPE)

                // Calcular timestamp de expiración
                val expiresAt = System.currentTimeMillis() + (expiresInSeconds * 1000)
                putLong(KEY_EXPIRES_AT, expiresAt)

                apply()
            }
            Timber.d("✅ Tokens guardados de forma segura (expira en ${expiresInSeconds}s)")
        } catch (e: Exception) {
            Timber.e(e, "❌ Error guardando tokens")
            throw SecurityException("No se pudieron guardar los tokens de forma segura", e)
        }
    }

    /**
     * Obtener token de acceso válido
     * Retorna null si no existe o ha expirado
     */
    fun getAccessToken(): String? {
        return try {
            val token = sharedPreferences.getString(KEY_ACCESS_TOKEN, null)
            if (token != null && isTokenValid()) {
                token
            } else {
                null
            }
        } catch (e: Exception) {
            Timber.e(e, "❌ Error leyendo access token")
            null
        }
    }

    /**
     * Obtener refresh token para renovación
     */
    fun getRefreshToken(): String? {
        return try {
            sharedPreferences.getString(KEY_REFRESH_TOKEN, null)
        } catch (e: Exception) {
            Timber.e(e, "❌ Error leyendo refresh token")
            null
        }
    }

    /**
     * Obtener tipo de token (usualmente "Bearer")
     */
    fun getTokenType(): String {
        return try {
            sharedPreferences.getString(KEY_TOKEN_TYPE, DEFAULT_TOKEN_TYPE) ?: DEFAULT_TOKEN_TYPE
        } catch (e: Exception) {
            Timber.e(e, "❌ Error leyendo tipo de token")
            DEFAULT_TOKEN_TYPE
        }
    }

    /**
     * Verificar si el token actual es válido
     * (No expirado y con margen de seguridad)
     */
    fun isTokenValid(): Boolean {
        return try {
            val expiresAt = sharedPreferences.getLong(KEY_EXPIRES_AT, 0)
            val currentTime = System.currentTimeMillis()
            val isValid = expiresAt > (currentTime + EXPIRATION_BUFFER_MS)

            if (!isValid) {
                Timber.d("⚠ Token ha expirado o está por expirar")
            }
            isValid
        } catch (e: Exception) {
            Timber.e(e, "❌ Error validando token")
            false
        }
    }

    /**
     * Obtener tiempo restante en milisegundos antes de expiración
     */
    fun getTimeToExpiration(): Long {
        return try {
            val expiresAt = sharedPreferences.getLong(KEY_EXPIRES_AT, 0)
            val currentTime = System.currentTimeMillis()
            maxOf(0, expiresAt - currentTime)
        } catch (e: Exception) {
            Timber.e(e, "❌ Error calculando tiempo a expiración")
            0
        }
    }

    /**
     * Limpiar todos los tokens (logout)
     */
    fun clearTokens() {
        try {
            sharedPreferences.edit().apply {
                remove(KEY_ACCESS_TOKEN)
                remove(KEY_REFRESH_TOKEN)
                remove(KEY_EXPIRES_AT)
                remove(KEY_TOKEN_TYPE)
                apply()
            }
            Timber.d("✅ Tokens eliminados correctamente (logout)")
        } catch (e: Exception) {
            Timber.e(e, "❌ Error eliminando tokens")
        }
    }

    /**
     * Verificar si hay una sesión activa
     */
    fun hasValidSession(): Boolean {
        return try {
            val accessToken = sharedPreferences.getString(KEY_ACCESS_TOKEN, null)
            accessToken != null && isTokenValid()
        } catch (e: Exception) {
            Timber.e(e, "❌ Error verificando sesión")
            false
        }
    }

    /**
     * Obtener información de depuración (NO incluir en logs sensibles)
     */
    fun getDebugInfo(): String {
        return try {
            val hasAccessToken = sharedPreferences.getString(KEY_ACCESS_TOKEN, null) != null
            val hasRefreshToken = sharedPreferences.getString(KEY_REFRESH_TOKEN, null) != null
            val expiresAt = sharedPreferences.getLong(KEY_EXPIRES_AT, 0)
            val timeToExpiry = getTimeToExpiration()

            """
            TokenManager Debug Info:
            - Access Token: ${if (hasAccessToken) "✓" else "✗"}
            - Refresh Token: ${if (hasRefreshToken) "✓" else "✗"}
            - Expires At: ${if (expiresAt > 0) java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(expiresAt) else "N/A"}
            - Time To Expiry: ${timeToExpiry}ms
            - Valid: ${isTokenValid()}
            """.trimIndent()
        } catch (e: Exception) {
            "Error obteniendo debug info: ${e.message}"
        }
    }
}
