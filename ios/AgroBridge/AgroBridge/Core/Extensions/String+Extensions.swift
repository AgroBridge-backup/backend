import Foundation

// MARK: - String Extensions
extension String {
    // MARK: - Validaciones
    /// Verifica si el string es un email válido
    var isValidEmail: Bool {
        let emailRegex = "[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,64}"
        let emailPredicate = NSPredicate(format: "SELF MATCHES %@", emailRegex)
        return emailPredicate.evaluate(with: self)
    }

    /// Verifica si el string está vacío o solo contiene espacios
    var isBlank: Bool {
        return trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    /// Limpia espacios en blanco al inicio y final
    var trimmed: String {
        return trimmingCharacters(in: .whitespacesAndNewlines)
    }

    // MARK: - Transformaciones
    /// Capitaliza la primera letra
    var capitalizedFirst: String {
        return prefix(1).capitalized + dropFirst()
    }

    /// Convierte a formato de nombre propio (Primera Letra Mayúscula)
    var titleCased: String {
        return self.lowercased().split(separator: " ").map { $0.capitalized }.joined(separator: " ")
    }
}
