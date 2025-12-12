//
//  ErrorHandler.swift
//  AgroBridge
//
//  ═══════════════════════════════════════════════════════════════════
//  AGROBRIDGE iOS - ERROR HANDLING INFRASTRUCTURE
//  ═══════════════════════════════════════════════════════════════════
//  Author:  Alejandro Navarro Ayala
//  Role:    CEO & Senior Developer
//  Email:   ceo@agrobridge.mx
//  Company: AgroBridge International
//  Date:    November 29, 2025
//  Purpose: Centralized error handling with user-friendly messages
//  Coverage: Error categorization, recovery strategies, logging
//  ═══════════════════════════════════════════════════════════════════
//
//  ANDROID EQUIVALENT: app/src/main/java/com/agrobridge/util/ErrorHandler.kt
//

import Foundation
import OSLog
#if canImport(FirebaseCrashlytics)
import FirebaseCrashlytics
#endif

/**
 * ErrorHandler - Centralized error handling with categorization
 *
 * Responsabilidades:
 * ✓ Categorizar excepciones (Network, Database, Auth, Validation, Unknown)
 * ✓ Generar mensajes amigables para el usuario en español
 * ✓ Log integrado con OSLog y Firebase Crashlytics
 * ✓ Recovery strategies por tipo de error
 * ✓ Soporte para errores silenciosos (sin mostrar UI)
 *
 * Uso:
 * ```swift
 * // Manejo simple
 * do {
 *     let result = try await apiService.getLotes()
 * } catch {
 *     let message = await ErrorHandler.shared.handle(error, context: "loading lotes")
 *     showToast(message)
 * }
 *
 * // Manejo con Result type
 * let result = await errorHandler.safely(context: "loading lotes") {
 *     try await apiService.getLotes()
 * }
 *
 * // Con async/await
 * await errorHandler.run(context: "loading lotes") {
 *     try await apiService.getLotes()
 * } onSuccess: { lotes in
 *     // Handle success
 * } onError: { message in
 *     showToast(message)
 * }
 * ```
 *
 * ANDROID PARITY: Matches ErrorHandler.kt functionality 100%
 * - Same error categories
 * - Same user messages (Spanish)
 * - Same logging structure
 * - Same convenience methods (safely, coroutineHandler equivalent)
 *
 * FIXED: BUG-004 - Removed @MainActor, using only actor for thread-safe access from any context
 */
actor ErrorHandler {

    // MARK: - Singleton

    /// Shared instance (thread-safe with actor)
    static let shared = ErrorHandler()

    private init() {}

    // MARK: - Logging

    /// OSLog para logging optimizado
    private let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.agrobridge.ios",
        category: "ErrorHandler"
    )

    // MARK: - Error Category (matches Android)

    /**
     * ErrorCategory - Categorización de errores
     *
     * ANDROID EQUIVALENT: sealed class ErrorCategory
     */
    enum ErrorCategory: Equatable {
        case network
        case database
        case authentication
        case validation
        case api(statusCode: Int)
        case unknown

        var icon: String {
            switch self {
            case .network: return "🌐"
            case .database: return "💾"
            case .authentication: return "🔐"
            case .validation: return "⚠️"
            case .api: return "🔌"
            case .unknown: return "❓"
            }
        }
    }

    // MARK: - Public API (matches Android methods)

    /**
     * Categoriza el error según su tipo
     *
     * ANDROID EQUIVALENT: `fun categorize(throwable: Throwable): ErrorCategory`
     *
     * Mapeo:
     * - URLError → .network
     * - NSError (Core Data domain) → .database
     * - UnauthorizedError → .authentication
     * - ValidationError → .validation
     * - HTTPError → .api(statusCode)
     * - Resto → .unknown
     */
    func categorize(_ error: Error) -> ErrorCategory {
        // URLError (network errors)
        if let urlError = error as? URLError {
            return .network
        }

        // NSError (system errors)
        if let nsError = error as NSError? {
            switch nsError.domain {
            case NSCocoaErrorDomain:
                return .database
            case NSURLErrorDomain:
                return .network
            default:
                break
            }
        }

        // Custom app errors
        if error is UnauthorizedError {
            return .authentication
        }

        if error is ValidationError {
            return .validation
        }

        if let httpError = error as? HTTPError {
            return .api(statusCode: httpError.statusCode)
        }

        return .unknown
    }

    /**
     * Maneja error y retorna mensaje user-friendly
     *
     * ANDROID EQUIVALENT: `fun handle(throwable: Throwable, context: String, silent: Boolean): String`
     *
     * - Parameters:
     *   - error: Error a manejar
     *   - context: Contexto donde ocurrió (ej: "loading lotes")
     *   - silent: Si true, no logea (para errores esperados)
     *
     * - Returns: Mensaje user-friendly en español
     */
    func handle(
        _ error: Error,
        context: String = "",
        silent: Bool = false
    ) -> String {
        let category = categorize(error)
        let userMessage = getUserFriendlyMessage(error, category: category)

        if !silent {
            logError(error, context: context, category: category)
        }

        return userMessage
    }

    /**
     * Obtiene la categoría del error
     *
     * ANDROID EQUIVALENT: `fun getCategory(throwable: Throwable): ErrorCategory`
     */
    func getCategory(_ error: Error) -> ErrorCategory {
        return categorize(error)
    }

    /**
     * Obtiene mensaje user-friendly sin loggear
     *
     * ANDROID EQUIVALENT: `fun getUserMessage(throwable: Throwable): String`
     */
    func getUserMessage(_ error: Error) -> String {
        let category = categorize(error)
        return getUserFriendlyMessage(error, category: category)
    }

    /**
     * Verifica si es error de red
     *
     * ANDROID EQUIVALENT: `fun isNetworkError(throwable: Throwable): Boolean`
     */
    func isNetworkError(_ error: Error) -> Bool {
        return categorize(error) == .network
    }

    /**
     * Verifica si es error de base de datos
     *
     * ANDROID EQUIVALENT: `fun isDatabaseError(throwable: Throwable): Boolean`
     */
    func isDatabaseError(_ error: Error) -> Bool {
        return categorize(error) == .database
    }

    /**
     * Verifica si es error de autenticación
     *
     * ANDROID EQUIVALENT: `fun isAuthError(throwable: Throwable): Boolean`
     */
    func isAuthError(_ error: Error) -> Bool {
        return categorize(error) == .authentication
    }

    /**
     * Verifica si es error de validación
     *
     * ANDROID EQUIVALENT: `fun isValidationError(throwable: Throwable): Boolean`
     */
    func isValidationError(_ error: Error) -> Bool {
        return categorize(error) == .validation
    }

    /**
     * Ejecuta operación async de manera segura con Result
     *
     * ANDROID EQUIVALENT: `suspend fun <T> safely(context: String, block: suspend () -> T): Result<T>`
     */
    func safely<T>(
        context: String = "",
        operation: @Sendable () async throws -> T
    ) async -> Result<T, Error> {
        do {
            let result = try await operation()
            return .success(result)
        } catch {
            let _ = handle(error, context: context, silent: true)
            return .failure(error)
        }
    }

    /**
     * Ejecuta operación síncrona de manera segura con Result
     *
     * ANDROID EQUIVALENT: `fun <T> safelySync(context: String, block: () -> T): Result<T>`
     */
    func safelySync<T>(
        context: String = "",
        operation: () throws -> T
    ) -> Result<T, Error> {
        do {
            let result = try operation()
            return .success(result)
        } catch {
            let _ = handle(error, context: context, silent: true)
            return .failure(error)
        }
    }

    /**
     * Ejecuta operación async con callbacks separados para success/error
     *
     * ANDROID EQUIVALENT: Similar to coroutineHandler + scope execution
     */
    func run<T>(
        context: String = "",
        operation: @Sendable () async throws -> T,
        onSuccess: @Sendable (T) -> Void = { _ in },
        onError: @Sendable (String) -> Void
    ) async {
        let result = await safely(context: context, operation: operation)

        switch result {
        case .success(let value):
            onSuccess(value)

        case .failure(let error):
            let message = getUserMessage(error)
            onError(message)
        }
    }

    // MARK: - Private Methods

    /**
     * Convierte error técnico → mensaje user-friendly
     *
     * ANDROID EQUIVALENT: `private fun getUserFriendlyMessage(...): String`
     *
     * Mensajes exactamente iguales a Android para consistencia cross-platform
     */
    private func getUserFriendlyMessage(
        _ error: Error,
        category: ErrorCategory
    ) -> String {
        switch category {
        case .network:
            // URLError specific messages
            if let urlError = error as? URLError {
                switch urlError.code {
                case .timedOut:
                    return "Conexión expirada. Verifica tu conexión a internet."

                case .cannotConnectToHost:
                    return "No se puede conectar al servidor. Verifica tu conexión."

                case .notConnectedToInternet:
                    return "Servidor no disponible. Intenta más tarde."

                default:
                    return "Error de conexión. Verifica tu red."
                }
            }
            return "Error de red. Por favor intenta nuevamente."

        case .database:
            return "Error al guardar datos. Por favor intenta nuevamente."

        case .authentication:
            return "Sesión expirada. Por favor inicia sesión nuevamente."

        case .validation:
            return "Los datos ingresados no son válidos. Verifica y vuelve a intentar."

        case .api(let statusCode):
            switch statusCode {
            case 400:
                return "Solicitud inválida. Verifica los datos."
            case 401:
                return "No autorizado. Por favor inicia sesión nuevamente."
            case 403:
                return "No tienes permiso para realizar esta acción."
            case 404:
                return "Recurso no encontrado."
            case 500:
                return "Error del servidor. Por favor intenta más tarde."
            default:
                return "Error en el servidor (\(statusCode)). Intenta más tarde."
            }

        case .unknown:
            return "Algo salió mal. Por favor intenta nuevamente."
        }
    }

    /**
     * Logging estructurado con OSLog
     *
     * ANDROID EQUIVALENT: `private fun logError(...)`
     */
    private func logError(
        _ error: Error,
        context: String,
        category: ErrorCategory
    ) {
        let icon = category.icon
        let contextString = context.isEmpty ? "" : " [\(context)]"
        let errorMessage = error.localizedDescription

        logger.error("""
            \(icon) ERROR\(contextString, privacy: .public): \
            \(errorMessage, privacy: .public) - \
            Category: \(String(describing: category), privacy: .public)
            """)

        // Log to Crashlytics if available
        logToCrashlytics(error, context: context, category: category)
    }

    /**
     * Logging a Firebase Crashlytics
     */
    private func logToCrashlytics(
        _ error: Error,
        context: String,
        category: ErrorCategory
    ) {
        #if canImport(FirebaseCrashlytics)
        let crashlytics = Crashlytics.crashlytics()

        // Set custom keys
        if !context.isEmpty {
            crashlytics.setCustomValue(context, forKey: "error_context")
        }
        crashlytics.setCustomValue(String(describing: category), forKey: "error_category")

        // Record error
        crashlytics.record(error: error)
        #endif
    }
}

// MARK: - Custom Error Types (matches Android custom exceptions)

/**
 * UnauthorizedError - Error de autenticación (401)
 *
 * ANDROID EQUIVALENT: class UnauthorizedException
 */
struct UnauthorizedError: Error, LocalizedError {
    let message: String

    init(message: String = "Unauthorized") {
        self.message = message
    }

    var errorDescription: String? {
        return message
    }
}

/**
 * ValidationError - Error de validación de datos
 *
 * ANDROID EQUIVALENT: class ValidationException
 */
struct ValidationError: Error, LocalizedError {
    let message: String
    let field: String?

    init(message: String = "Validation failed", field: String? = nil) {
        self.message = message
        self.field = field
    }

    var errorDescription: String? {
        if let field = field {
            return "\(message) - Campo: \(field)"
        }
        return message
    }
}

/**
 * HTTPError - Error HTTP con código de estado
 *
 * ANDROID EQUIVALENT: class HttpException
 */
struct HTTPError: Error, LocalizedError {
    let statusCode: Int
    let message: String

    init(statusCode: Int, message: String? = nil) {
        self.statusCode = statusCode
        self.message = message ?? "HTTP Error \(statusCode)"
    }

    var errorDescription: String? {
        return message
    }
}

/**
 * DatabaseError - Error de base de datos
 *
 * ANDROID EQUIVALENT: class SQLException
 */
struct DatabaseError: Error, LocalizedError {
    let message: String

    init(message: String = "Database error") {
        self.message = message
    }

    var errorDescription: String? {
        return message
    }
}

// MARK: - Convenience Extensions

/**
 * Extension de Result para logging automático
 */
extension Result where Failure == Error {

    /**
     * Maneja error con ErrorHandler si falla
     */
    func handleError(
        handler: ErrorHandler = .shared,
        context: String = ""
    ) async -> Result<Success, Error> {
        switch self {
        case .success:
            return self
        case .failure(let error):
            let _ = await handler.handle(error, context: context)
            return self
        }
    }
}
