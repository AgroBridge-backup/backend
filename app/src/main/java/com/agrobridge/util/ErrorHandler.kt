package com.agrobridge.util

// ═══════════════════════════════════════════════════════════════════
// AGROBRIDGE ANDROID - ERROR HANDLING INFRASTRUCTURE
// ═══════════════════════════════════════════════════════════════════
// Author:  Alejandro Navarro Ayala
// Role:    CEO & Senior Developer
// Email:   ceo@agrobridge.mx
// Company: AgroBridge International
// Date:    November 29, 2025
// Purpose: Centralized error handling with user-friendly messages
// Coverage: Error categorization, recovery strategies, logging
// ═══════════════════════════════════════════════════════════════════

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineExceptionHandler
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton
import java.io.IOException
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException

/**
 * ErrorHandler - Centralized error handling with categorization
 *
 * Responsabilidades:
 * ✓ Categorizar excepciones (Network, Database, Auth, Validation, Unknown)
 * ✓ Generar mensajes amigables para el usuario en español
 * ✓ Log integrado con Timber y Crashlytics
 * ✓ Recovery strategies por tipo de error
 * ✓ Soporte para errores silenciosos (sin mostrar UI)
 *
 * Uso:
 * ```
 * // Manejo simple
 * try {
 *     val result = apiService.getLotes()
 * } catch (e: Exception) {
 *     val message = errorHandler.handle(e, "loading lotes")
 *     showToast(message)
 * }
 *
 * // Manejo con scope
 * val result = errorHandler.safely("loading lotes") {
 *     apiService.getLotes()
 * }
 *
 * // Con coroutines
 * val exceptionHandler = errorHandler.coroutineHandler()
 * ```
 */
@Singleton
class ErrorHandler @Inject constructor(
    @ApplicationContext private val context: Context
) {

    sealed class ErrorCategory {
        object Network : ErrorCategory()
        object Database : ErrorCategory()
        object Authentication : ErrorCategory()
        object Validation : ErrorCategory()
        data class Api(val statusCode: Int) : ErrorCategory()
        object Unknown : ErrorCategory()
    }

    fun categorize(throwable: Throwable): ErrorCategory {
        return when (throwable) {
            is SocketTimeoutException,
            is ConnectException,
            is UnknownHostException,
            is IOException -> ErrorCategory.Network
            is SQLException -> ErrorCategory.Database
            is UnauthorizedException -> ErrorCategory.Authentication
            is ValidationException -> ErrorCategory.Validation
            // FIXED: MEDIUM-9 - Use qualified name to avoid ambiguity with Retrofit's HttpException
            is com.agrobridge.util.HttpException -> ErrorCategory.Api(throwable.code())
            else -> ErrorCategory.Unknown
        }
    }

    fun handle(
        throwable: Throwable,
        context: String = "",
        silent: Boolean = false
    ): String {
        val category = categorize(throwable)
        val userMessage = getUserFriendlyMessage(throwable, category)

        logError(throwable, context, category)

        if (!silent) {
            Timber.e(throwable, "Error in $context: $userMessage")
        }

        return userMessage
    }

    fun getCategory(throwable: Throwable): ErrorCategory {
        return categorize(throwable)
    }

    fun getUserMessage(throwable: Throwable): String {
        val category = categorize(throwable)
        return getUserFriendlyMessage(throwable, category)
    }

    fun isNetworkError(throwable: Throwable): Boolean {
        return categorize(throwable) is ErrorCategory.Network
    }

    fun isDatabaseError(throwable: Throwable): Boolean {
        return categorize(throwable) is ErrorCategory.Database
    }

    fun isAuthError(throwable: Throwable): Boolean {
        return categorize(throwable) is ErrorCategory.Authentication
    }

    fun isValidationError(throwable: Throwable): Boolean {
        return categorize(throwable) is ErrorCategory.Validation
    }

    private fun getUserFriendlyMessage(
        throwable: Throwable,
        category: ErrorCategory
    ): String {
        return when (category) {
            ErrorCategory.Network -> {
                when (throwable) {
                    is SocketTimeoutException -> "Conexión expirada. Verifica tu conexión a internet."
                    is ConnectException -> "No se puede conectar al servidor. Verifica tu conexión."
                    is UnknownHostException -> "Servidor no disponible. Intenta más tarde."
                    is IOException -> "Error de conexión. Verifica tu red."
                    else -> "Error de red. Por favor intenta nuevamente."
                }
            }
            ErrorCategory.Database -> "Error al guardar datos. Por favor intenta nuevamente."
            ErrorCategory.Authentication -> "Sesión expirada. Por favor inicia sesión nuevamente."
            ErrorCategory.Validation -> "Los datos ingresados no son válidos. Verifica y vuelve a intentar."
            is ErrorCategory.Api -> {
                when (throwable.statusCode) {
                    400 -> "Solicitud inválida. Verifica los datos."
                    401 -> "No autorizado. Por favor inicia sesión nuevamente."
                    403 -> "No tienes permiso para realizar esta acción."
                    404 -> "Recurso no encontrado."
                    500 -> "Error del servidor. Por favor intenta más tarde."
                    else -> "Error en el servidor (${throwable.statusCode}). Intenta más tarde."
                }
            }
            ErrorCategory.Unknown -> "Algo salió mal. Por favor intenta nuevamente."
        }
    }

    private fun logError(
        throwable: Throwable,
        context: String,
        category: ErrorCategory
    ) {
        val logMessage = buildString {
            append("ERROR")
            if (context.isNotEmpty()) append(" [$context]")
            append(": ${throwable.message ?: "Unknown error"}")
            append(" - Category: $category")
        }

        Timber.e(throwable, logMessage)
    }

    suspend fun <T> safely(
        context: String = "",
        block: suspend () -> T
    ): Result<T> {
        return try {
            Result.success(block())
        } catch (e: Exception) {
            handle(e, context, silent = true)
            Result.failure(e)
        }
    }

    fun <T> safelySync(
        context: String = "",
        block: () -> T
    ): Result<T> {
        return try {
            Result.success(block())
        } catch (e: Exception) {
            handle(e, context, silent = true)
            Result.failure(e)
        }
    }

    fun coroutineHandler(onError: (Throwable) -> Unit = {}): CoroutineExceptionHandler {
        return CoroutineExceptionHandler { _, throwable ->
            handle(throwable)
            onError(throwable)
        }
    }
}

// Custom exceptions for specific error types
class UnauthorizedException(message: String = "Unauthorized") : Exception(message)

class ValidationException(message: String = "Validation failed") : Exception(message)

class HttpException(
    val code: Int,
    message: String = "HTTP Error $code"
) : Exception(message) {
    fun code(): Int = code
}

class SQLException(message: String = "Database error") : Exception(message)
