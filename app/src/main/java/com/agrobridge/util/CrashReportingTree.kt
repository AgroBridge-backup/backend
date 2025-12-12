package com.agrobridge.util

import android.util.Log
import timber.log.Timber

/**
 * Custom Timber Tree para reportar errores a Crashlytics en producción
 *
 * Estrategia:
 * - DEBUG y VERBOSE: No se loguean (noise reduction)
 * - INFO, WARNING, ERROR: Se loguean localmente
 * - EXCEPTIONS: Se envían a Crashlytics (cuando esté configurado)
 *
 * Uso:
 * - Automáticamente plantado en Application cuando !BuildConfig.DEBUG
 * - Reemplaza los Timber.e(), Timber.w(), etc. en producción
 *
 * Ventajas:
 * - Código limpio: solo usas Timber.e(...) normalmente
 * - Cambio de comportamiento automático según BUILD_CONFIG
 * - Preparado para Firebase Crashlytics (solo comentar líneas)
 *
 * Próximo paso: Descomentar líneas de Firebase cuando se configure
 * implementation("com.google.firebase:firebase-crashlytics-ktx:...")
 *
 * FIXED: Added stack trace truncation to respect Firebase Crashlytics size limits
 * Firebase has a 6KB limit per stack trace, so we truncate to prevent failures
 */
class CrashReportingTree : Timber.Tree() {

    override fun log(priority: Int, tag: String?, message: String, t: Throwable?) {
        // Ignorar logs de DEBUG y VERBOSE para reducir ruido
        if (priority == Log.VERBOSE || priority == Log.DEBUG) {
            return
        }

        // Log de INFO: solo local
        if (priority == Log.INFO) {
            android.util.Log.i(tag ?: "CrashReporting", message)
            return
        }

        // Log de WARNING: local + posible envío remoto
        if (priority == Log.WARN) {
            android.util.Log.w(tag ?: "CrashReporting", message, t)
            // Descomentar cuando Firebase esté configurado:
            // FirebaseCrashlytics.getInstance().log("WARNING: $message")
            return
        }

        // Log de ERROR: local + ENVIAR A CRASHLYTICS
        if (priority == Log.ERROR) {
            android.util.Log.e(tag ?: "CrashReporting", message, t)

            // Enviar a Crashlytics (cuando esté disponible)
            // Esto permite debugging remoto en producción
            // FirebaseCrashlytics.getInstance().apply {
            //     log("ERROR: $message")
            //     if (t != null) {
            //         val truncatedThrowable = truncateStackTrace(t)
            //         recordException(truncatedThrowable)
            //     }
            // }
            return
        }

        // ASSERT: ERROR crítico
        if (priority == Log.ASSERT) {
            android.util.Log.wtf(tag ?: "CrashReporting", message, t)
            // Enviar a Crashlytics
            // FirebaseCrashlytics.getInstance().apply {
            //     log("CRITICAL ASSERTION: $message")
            //     if (t != null) {
            //         val truncatedThrowable = truncateStackTrace(t)
            //         recordException(truncatedThrowable)
            //     }
            // }
        }
    }

    /**
     * Truncate stack trace to prevent Firebase Crashlytics size limits (6KB max)
     * Keeps first 10 lines of stack trace and root cause
     *
     * ADDED: To handle deeply nested exception chains common in Retrofit/Coroutine code
     */
    private fun truncateStackTrace(t: Throwable): Throwable {
        val stackTrace = t.stackTrace
        val truncatedLength = minOf(10, stackTrace.size)

        if (truncatedLength >= stackTrace.size) {
            return t // No truncation needed
        }

        // Create a truncated stack trace
        val truncated = stackTrace.copyOfRange(0, truncatedLength)
        t.stackTrace = truncated

        // Also truncate the cause chain if present
        var cause = t.cause
        while (cause != null) {
            val causeStackTrace = cause.stackTrace
            val causeTruncated = minOf(5, causeStackTrace.size)
            if (causeTruncated < causeStackTrace.size) {
                cause.stackTrace = causeStackTrace.copyOfRange(0, causeTruncated)
            }
            cause = cause.cause
        }

        return t
    }
}
