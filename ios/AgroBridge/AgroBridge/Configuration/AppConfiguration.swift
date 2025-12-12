import Foundation

// MARK: - Configuración Global de la Aplicación
struct AppConfiguration {
    // MARK: - Información de la App
    static let appName = "AgroBridge"
    static let appVersion = "1.0.0"
    static let buildNumber = "1"

    // MARK: - URLs del Backend
    // URL base del API según el entorno
    static var baseURL: String {
        switch environment {
        case .development:
            return "https://dev-api.agrobridge.io/v1"
        case .staging:
            return "https://staging-api.agrobridge.io/v1"
        case .production:
            return "https://api.agrobridge.io/v1"
        }
    }

    // MARK: - Entorno Actual
    static var environment: Environment {
        #if DEBUG
        return .development
        #else
        return .production
        #endif
    }

    // MARK: - Configuración de Networking
    static let requestTimeout: TimeInterval = 30.0 // 30 segundos
    static let maxRetryAttempts = 3

    // MARK: - Configuración de Autenticación
    static let tokenRefreshThreshold: TimeInterval = 300 // 5 minutos antes de expiración

    // MARK: - Configuración de Firebase
    static let enableFirebaseAnalytics = true
    static let enableFirebaseCrashlytics = true

    // MARK: - Feature Flags
    static let enableOfflineMode = false // Por implementar en fases futuras
    static let enableBiometricAuth = false // Por implementar en fases futuras

    // MARK: - Logging
    static var isLoggingEnabled: Bool {
        #if DEBUG
        return true
        #else
        return false
        #endif
    }
}

// MARK: - Environment Enum
enum Environment {
    case development
    case staging
    case production

    var displayName: String {
        switch self {
        case .development: return "Desarrollo"
        case .staging: return "Staging"
        case .production: return "Producción"
        }
    }
}
