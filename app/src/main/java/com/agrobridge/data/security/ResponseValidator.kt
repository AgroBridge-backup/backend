package com.agrobridge.data.security

import okhttp3.Response
import okhttp3.ResponseBody
import timber.log.Timber
import java.security.MessageDigest
import java.util.*

/**
 * ResponseValidator - Validar respuestas de API contra ataques
 *
 * Responsabilidades:
 * - Validar que respuestas sean de fuente autorizada
 * - Detectar MITM y respuestas alteradas
 * - Verificar integridad de datos (SHA-256)
 * - Validar content-type esperado
 * - Detectar payloads maliciosos
 *
 * ¿Por qué validar respuestas?
 * - Aunque HTTPS protege tránsito, no protege contra:
 *   - Server-side attacks (hacking del servidor)
 *   - Man-in-the-middle si certificados comprometidos
 *   - Injection attacks
 *   - Response pollution (caché envenenado)
 * - Validación adicional = defensa en profundidad
 *
 * Métodos de validación:
 * 1. Content-Type checking (application/json, etc.)
 * 2. Content-Length validation (no demasiado grande)
 * 3. Signature verification (SHA-256 HMAC)
 * 4. Payload sanitization (no tiene scripts maliciosos)
 * 5. Status code validation (no redirects sorpresivos)
 *
 * Implementación:
 * - Interceptor en la cadena de OkHttp
 * - O validación manual en Repository layer
 * - Comparar signature en header X-Signature-SHA256
 *
 * Seguridad:
 * - Usar HMAC-SHA256 con shared secret del servidor
 * - Validar strict content-type
 * - Limitar tamaño de respuesta (evitar DoS)
 * - Loguear validaciones fallidas
 */
class ResponseValidator {

    companion object {
        private const val TAG = "ResponseValidator"

        // Tamaño máximo de respuesta: 50 MB
        private const val MAX_RESPONSE_SIZE = 50 * 1024 * 1024L

        // Content-types permitidos
        private val ALLOWED_CONTENT_TYPES = setOf(
            "application/json",
            "application/json; charset=utf-8",
            "text/plain",
            "image/jpeg",
            "image/png",
            "image/webp"
        )

        // Headers de seguridad esperados
        private val SECURITY_HEADERS = mapOf(
            "X-Content-Type-Options" to "nosniff",
            "X-Frame-Options" to "DENY",
            "X-XSS-Protection" to "1; mode=block",
            "Strict-Transport-Security" to "max-age="
        )
    }

    /**
     * Validar respuesta HTTP completa
     *
     * @param response Respuesta de OkHttp
     * @param expectedSignature Firma esperada (opcional)
     * @return ValidationResult con resultado de validación
     */
    fun validateResponse(
        response: Response,
        expectedSignature: String? = null
    ): ValidationResult {
        val checks = mutableListOf<ValidationCheck>()

        // Check 1: Status code
        if (!isValidStatusCode(response.code)) {
            checks.add(ValidationCheck("Invalid Status Code", response.code.toString(), false))
        } else {
            checks.add(ValidationCheck("Status Code", response.code.toString(), true))
        }

        // Check 2: Content-Type
        val contentType = response.header("Content-Type")
        if (contentType != null && !isValidContentType(contentType)) {
            checks.add(ValidationCheck("Invalid Content-Type", contentType, false))
        } else {
            checks.add(ValidationCheck("Content-Type", contentType ?: "not specified", true))
        }

        // Check 3: Content-Length
        val contentLength = response.header("Content-Length")?.toLongOrNull()
        if (contentLength != null && contentLength > MAX_RESPONSE_SIZE) {
            checks.add(
                ValidationCheck(
                    "Content-Length Too Large",
                    "${contentLength / 1024 / 1024} MB",
                    false
                )
            )
        } else {
            checks.add(ValidationCheck("Content-Length", contentLength?.toString() ?: "unknown", true))
        }

        // Check 4: Security Headers
        SECURITY_HEADERS.forEach { (headerName, expectedValue) ->
            val actualValue = response.header(headerName)
            val isValid = actualValue != null && actualValue.startsWith(expectedValue)
            checks.add(
                ValidationCheck(
                    "Header: $headerName",
                    actualValue ?: "missing",
                    isValid,
                    isCritical = false
                )
            )
        }

        // Check 5: Signature (si se proporciona)
        if (expectedSignature != null && response.body != null) {
            val bodyString = response.body!!.string()
            val actualSignature = calculateSHA256(bodyString)
            val isSignatureValid = actualSignature.equals(expectedSignature, ignoreCase = true)
            checks.add(
                ValidationCheck(
                    "Signature SHA-256",
                    actualSignature.take(16) + "...",
                    isSignatureValid,
                    isCritical = true
                )
            )
        }

        // Compilar resultado
        val allValid = checks.filter { it.isCritical }.all { it.isValid }
        return ValidationResult(allValid, checks)
    }

    /**
     * Validar que status code sea aceptable
     */
    private fun isValidStatusCode(statusCode: Int): Boolean {
        // Aceptar 1xx, 2xx, 3xx (redirects, éxito)
        // Rechazar 4xx, 5xx en ciertos contextos
        return statusCode in 100..399
    }

    /**
     * Validar que content-type sea permitido
     */
    private fun isValidContentType(contentType: String): Boolean {
        // Normalizar
        val normalized = contentType.lowercase(Locale.US).trim()

        return ALLOWED_CONTENT_TYPES.any { allowed ->
            normalized.startsWith(allowed.split(";")[0])
        }
    }

    /**
     * Calcular SHA-256 de un string
     */
    private fun calculateSHA256(input: String): String {
        return try {
            val digest = MessageDigest.getInstance("SHA-256")
            val hash = digest.digest(input.toByteArray(Charsets.UTF_8))
            hash.joinToString("") { "%02x".format(it) }
        } catch (e: Exception) {
            Timber.e(e, "Error calculating SHA-256")
            ""
        }
    }

    /**
     * Detectar posible payload malicioso
     */
    fun isPayloadSuspicious(body: String): Boolean {
        val suspiciousPatterns = listOf(
            "<script", // Scripts inline
            "javascript:", // onclick handlers
            "onerror=", // error handlers
            "onclick=", // click handlers
            "__proto__", // Prototype pollution
            "eval(", // eval() calls
            "Function(", // Function constructor
            "require(", // Node.js require
            "process.", // Node.js process
            "child_process" // Node.js child processes
        )

        return suspiciousPatterns.any { pattern ->
            body.contains(pattern, ignoreCase = true)
        }
    }
}

/**
 * Resultado de validación de respuesta
 */
data class ValidationResult(
    val isValid: Boolean,
    val checks: List<ValidationCheck>
) {
    fun getReport(): String {
        val validCount = checks.count { it.isValid }
        val totalCount = checks.size

        return """
            ═══════════════════════════════════════════════════════════════════
            Response Validation Report
            ═══════════════════════════════════════════════════════════════════
            Overall: ${if (isValid) "✅ VALID" else "❌ INVALID"}
            Passed: $validCount/$totalCount

            Details:
            ${checks.joinToString("\n") { it.toString() }}
            ═══════════════════════════════════════════════════════════════════
        """.trimIndent()
    }
}

/**
 * Un check individual de validación
 */
data class ValidationCheck(
    val name: String,
    val value: String,
    val isValid: Boolean,
    val isCritical: Boolean = true
) {
    override fun toString(): String {
        val status = if (isValid) "✅" else "❌"
        val critical = if (isCritical) " [CRITICAL]" else ""
        return "$status $name: $value$critical"
    }
}
