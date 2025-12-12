import Foundation
import Security

// MARK: - Keychain Manager
/// Manager para almacenar y recuperar datos sensibles del Keychain de forma segura
class KeychainManager {
    // MARK: - Singleton
    static let shared = KeychainManager()

    // MARK: - Keys
    enum Key: String {
        case authToken = "com.agrobridge.authToken"
        case refreshToken = "com.agrobridge.refreshToken"
        case userEmail = "com.agrobridge.userEmail"
    }

    // MARK: - Métodos Principales
    /// Guarda un valor en el Keychain
    /// - Parameters:
    ///   - value: Valor a guardar
    ///   - key: Llave identificadora
    func save(_ value: String, for key: Key) {
        guard let data = value.data(using: .utf8) else { return }

        // Eliminar valor existente
        delete(for: key)

        // Crear query
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key.rawValue,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlocked
        ]

        // Guardar
        let status = SecItemAdd(query as CFDictionary, nil)

        if status != errSecSuccess {
            print("❌ Error guardando en Keychain: \(status)")
        } else {
            print("✅ Guardado en Keychain: \(key.rawValue)")
        }
    }

    /// Recupera un valor del Keychain
    /// - Parameter key: Llave identificadora
    /// - Returns: Valor guardado o nil si no existe
    func get(for key: Key) -> String? {
        // Crear query
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key.rawValue,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        // Recuperar
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let data = result as? Data,
              let value = String(data: data, encoding: .utf8) else {
            return nil
        }

        return value
    }

    /// Elimina un valor del Keychain
    /// - Parameter key: Llave identificadora
    func delete(for key: Key) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key.rawValue
        ]

        SecItemDelete(query as CFDictionary)
    }

    /// Elimina todos los valores del Keychain de AgroBridge
    func deleteAll() {
        delete(for: .authToken)
        delete(for: .refreshToken)
        delete(for: .userEmail)
        print("🗑️ Keychain limpiado")
    }
}
