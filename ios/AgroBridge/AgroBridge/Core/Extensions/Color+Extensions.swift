import SwiftUI

// MARK: - Color Extensions para AgroBridge
extension Color {
    // MARK: - Colores Primarios de la Marca
    /// Color verde primario de AgroBridge (#57A02B aproximadamente)
    static let agrobridgePrimary = Color(red: 0.34, green: 0.62, blue: 0.17)

    /// Color verde secundario (más claro)
    static let agrobridgeSecondary = Color(red: 0.45, green: 0.75, blue: 0.25)

    /// Color de acento (naranja agricultura)
    static let agrobridgeAccent = Color(red: 0.95, green: 0.61, blue: 0.07)

    // MARK: - Colores de Estado
    /// Color para estados de éxito
    static let success = Color.green

    /// Color para estados de advertencia
    static let warning = Color.orange

    /// Color para estados de error
    static let error = Color.red

    /// Color para estados informativos
    static let info = Color.blue

    // MARK: - Colores de UI
    /// Fondo de cards
    static let cardBackground = Color(.systemBackground)

    /// Fondo secundario
    static let secondaryBackground = Color(.secondarySystemBackground)

    /// Color de texto secundario
    static let secondaryText = Color(.secondaryLabel)

    /// Color de bordes
    static let border = Color(.separator)

    // MARK: - Inicializador desde Hex
    /// Crear color desde código hexadecimal
    /// - Parameter hex: String con formato "#RRGGBB" o "RRGGBB"
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (1, 1, 1, 0)
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
