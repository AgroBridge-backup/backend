package com.agrobridge.data.security

import okhttp3.CertificatePinner
import timber.log.Timber

/**
 * CertificatePinnerFactory - Factory para crear CertificatePinner de OkHttp
 *
 * Responsabilidades:
 * - Configurar public key pinning para HTTPS
 * - Prevenir MITM (Man-In-The-Middle) attacks
 * - Validar certificados del servidor contra pins conocidos
 *
 * ¿Por qué Certificate Pinning?
 * - Interceptores proxy pueden instalar certificados falsos
 * - Certificate Pinning verifica el certificado REAL del servidor
 * - Si certificado no coincide con pin, se rechaza la conexión
 *
 * Pins:
 * - Se extrae la clave pública de los certificados del servidor
 * - Se genera SHA-256 del certificado
 * - Se codifica en Base64 como "pin-sha256/..."
 * - Se guarda en código y se valida cada conexión
 *
 * Dominios pinned:
 * - api.agrobridge.com: Backend principal
 * - cdn.agrobridge.com: CDN para imágenes/assets
 *
 * Backup pins:
 * - Se recomiendan pins de certificados de respaldo
 * - Si certificado principal se comprometido, backup sigue funcionando
 * - Cambio de certificados se puede hacer sin downtime
 *
 * Nota: Los pins son ficticios para demostración
 * En producción, usar pins reales del servidor
 */
object CertificatePinnerFactory {

    /**
     * Crear CertificatePinner configurado para api.agrobridge.com
     *
     * Certificados pinned:
     * 1. api.agrobridge.com:
     *    - Pin principal: SHA-256 del certificado actual
     *    - Pin backup: SHA-256 del certificado de respaldo
     *
     * @return CertificatePinner listo para usar en OkHttp
     */
    fun create(): CertificatePinner {
        return CertificatePinner.Builder()
            // ===================================================================
            // API PRINCIPAL: api.agrobridge.com
            // ===================================================================
            .add(
                "api.agrobridge.com",
                // Pin principal (certificado actual)
                // Extraído de: openssl s_client -servername api.agrobridge.com -connect api.agrobridge.com:443
                "pin-sha256/X3pGTSOuJeGW1qVoGFnQvnRvydtx6HQyT5K7YkzQTNA=",

                // Pin backup (certificado intermedio o de respaldo)
                // Permite rotación de certificados sin downtime
                "pin-sha256/MK5ZlYvyraKvB4wVjZfHWtaAqP0xghLvrqyQpXHYw5w=",

                // Pin de respaldo adicional (certificado raíz)
                "pin-sha256/47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU="
            )

            // ===================================================================
            // CDN: cdn.agrobridge.com (para imágenes)
            // ===================================================================
            .add(
                "cdn.agrobridge.com",
                // Pin para CDN
                "pin-sha256/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0="
            )

            .build()
    }

    /**
     * Obtener pins para debugging/logging (sin información sensible)
     *
     * Retorna los dominios pinned para verificación
     */
    fun getPinnedHosts(): List<String> {
        return listOf(
            "api.agrobridge.com",
            "cdn.agrobridge.com"
        )
    }

    /**
     * Información de pins configurados (para logs de auditoría)
     */
    fun getInfo(): String {
        return """
            ═══════════════════════════════════════════════════════════════════
            Certificate Pinning Configuration
            ═══════════════════════════════════════════════════════════════════

            Dominios Protegidos:
            • api.agrobridge.com (Backend API)
              - Pin principal: X3pGTSOuJeGW1qVoGFnQvnRvydtx6HQyT5K7YkzQTNA=
              - Pin backup 1: MK5ZlYvyraKvB4wVjZfHWtaAqP0xghLvrqyQpXHYw5w=
              - Pin backup 2: 47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=

            • cdn.agrobridge.com (Content Delivery Network)
              - Pin: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0=

            Beneficios:
            ✓ Previene MITM (Man-In-The-Middle) attacks
            ✓ Protege contra certificados falsos
            ✓ Detiene interceptores proxy maliciosos
            ✓ Validación en cada conexión HTTPS

            Configuración:
            • Implementado en OkHttpClient via CertificatePinner
            • Agregar en NetworkModule.kt al construir OkHttpClient

            Rotación de Certificados:
            • Usar pins de backup durante transición
            • Generar nuevos pins antes de expiración de certificado
            • Comando: openssl s_client -servername api.agrobridge.com -connect api.agrobridge.com:443

            ═══════════════════════════════════════════════════════════════════
        """.trimIndent()
    }
}

/**
 * Extensión de OkHttp CertificatePinner para logueo
 */
fun CertificatePinner.logConfiguration() {
    Timber.i("🔒 Certificate Pinning activado para api.agrobridge.com y cdn.agrobridge.com")
    Timber.d(CertificatePinnerFactory.getInfo())
}
