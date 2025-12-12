import SwiftUI

// MARK: - AgroBridge Design System
/// Sistema de diseño unificado con filosofía Jony Ive
/// "Simplicity is the ultimate sophistication"
/// Inspirado en Apple HIG 2025 + Material Design 3

// MARK: - Colors
extension Color {

    // MARK: Brand Colors (Paleta AgroBridge Premium)

    /// Verde primario AgroBridge - Representa crecimiento y naturaleza
    static let agroGreen = Color(hex: "#2D5016") // Verde oscuro, profesional

    /// Verde acento - Para CTAs y highlights
    static let agroGreenLight = Color(hex: "#57A02B") // Verde brillante, energético

    /// Verde suave - Para backgrounds sutiles
    static let agroGreenTint = Color(hex: "#E8F5E3") // Verde casi blanco

    /// Tierra - Color secundario, grounding
    static let agroEarth = Color(hex: "#8B6F47") // Marrón tierra

    /// Cielo - Para elementos de agua/clima
    static let agroSky = Color(hex: "#4A90E2") // Azul suave

    // MARK: Semantic Colors

    /// Éxito - Operaciones completadas
    static let successGreen = Color(hex: "#34C759")

    /// Advertencia - Atención requerida
    static let warningAmber = Color(hex: "#FF9500")

    /// Error - Problemas críticos
    static let errorRed = Color(hex: "#FF3B30")

    /// Info - Información contextual
    static let infoBlue = Color(hex: "#007AFF")

    // MARK: Neutral Palette

    /// Background primario - Ligeramente teñido
    static let backgroundPrimary = Color(hex: "#F8FAF7") // Blanco verdoso

    /// Background secundario - Cards elevados
    static let backgroundSecondary = Color.white

    /// Text primario - Alta legibilidad
    static let textPrimary = Color(hex: "#1C1C1E")

    /// Text secundario - Información de apoyo
    static let textSecondary = Color(hex: "#6C6C70")

    /// Text terciario - Placeholders y labels
    static let textTertiary = Color(hex: "#AEAEB2")

    /// Divider - Líneas sutiles
    static let divider = Color(hex: "#E5E5EA")

    // MARK: Legacy Support (Mantener compatibilidad con código existente)

    /// Alias para compatibilidad con código anterior
    static var agrobridgePrimary: Color { agroGreenLight }

    /// Alias para cards (compatibilidad)
    static var cardBackground: Color { backgroundSecondary }

    /// Alias para background secundario (compatibilidad)
    static var secondaryBackground: Color { backgroundPrimary }

    // MARK: Helper: Initialize from Hex
    /// Inicializa Color desde string hexadecimal
    /// - Parameter hex: String hexadecimal (#RRGGBB o #AARRGGBB)
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 6: // RGB (no alpha)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - Typography
extension Font {

    // MARK: Display (Titles grandes)

    /// Display Large - Hero titles
    static let displayLarge = Font.system(size: 34, weight: .bold, design: .default)

    /// Display Medium - Section headers
    static let displayMedium = Font.system(size: 28, weight: .semibold, design: .default)

    /// Display Small - Card titles
    static let displaySmall = Font.system(size: 22, weight: .semibold, design: .default)

    // MARK: Body (Texto corriente)

    /// Body Large - Contenido principal
    static let bodyLarge = Font.system(size: 17, weight: .regular, design: .default)

    /// Body Medium - Descripciones
    static let bodyMedium = Font.system(size: 15, weight: .regular, design: .default)

    /// Body Small - Footnotes
    static let bodySmall = Font.system(size: 13, weight: .regular, design: .default)

    // MARK: Label (UI elements)

    /// Label Large - Buttons
    static let labelLarge = Font.system(size: 17, weight: .semibold, design: .default)

    /// Label Medium - Form labels
    static let labelMedium = Font.system(size: 15, weight: .medium, design: .default)

    /// Label Small - Chips, badges
    static let labelSmall = Font.system(size: 12, weight: .medium, design: .default)
}

// MARK: - Spacing
/// Sistema de espaciado consistente basado en múltiplos de 4pt
enum Spacing {
    /// 4pt - Mínimo, tight elements
    static let xxs: CGFloat = 4

    /// 8pt - Compact spacing
    static let xs: CGFloat = 8

    /// 12pt - Standard small
    static let sm: CGFloat = 12

    /// 16pt - Default spacing (base unit)
    static let md: CGFloat = 16

    /// 20pt - Comfortable
    static let lg: CGFloat = 20

    /// 24pt - Generous
    static let xl: CGFloat = 24

    /// 32pt - Section breaks
    static let xxl: CGFloat = 32

    /// 48pt - Hero elements
    static let xxxl: CGFloat = 48
}

// MARK: - Corner Radius
/// Sistema de corner radius consistente
enum CornerRadius {
    /// 8pt - Small elements (chips, badges)
    static let small: CGFloat = 8

    /// 12pt - Cards, buttons
    static let medium: CGFloat = 12

    /// 16pt - Large cards, modals
    static let large: CGFloat = 16

    /// 20pt - Hero elements
    static let xlarge: CGFloat = 20

    /// 24pt - Extra large containers
    static let xxlarge: CGFloat = 24
}

// MARK: - Shadows
/// Estilos de sombra pre-definidos para consistencia
struct ShadowStyle {
    let color: Color
    let radius: CGFloat
    let x: CGFloat
    let y: CGFloat

    /// Sombra suave - Cards elevados
    static let soft = ShadowStyle(
        color: Color.black.opacity(0.08),
        radius: 8,
        x: 0,
        y: 2
    )

    /// Sombra media - Elementos flotantes
    static let medium = ShadowStyle(
        color: Color.black.opacity(0.12),
        radius: 16,
        x: 0,
        y: 4
    )

    /// Sombra fuerte - Modals, overlays
    static let strong = ShadowStyle(
        color: Color.black.opacity(0.20),
        radius: 24,
        x: 0,
        y: 8
    )

    /// Sombra muy suave - Elementos sutiles
    static let subtle = ShadowStyle(
        color: Color.black.opacity(0.05),
        radius: 4,
        x: 0,
        y: 1
    )
}

// MARK: - Animation Presets
/// Animaciones pre-configuradas siguiendo principios de iOS
enum AnimationPreset {
    /// Spring suave - Micro-interacciones (botones, toggles)
    static let spring = Animation.spring(response: 0.3, dampingFraction: 0.7, blendDuration: 0)

    /// Spring bouncy - Elementos que "entran" en escena
    static let springBouncy = Animation.spring(response: 0.4, dampingFraction: 0.6, blendDuration: 0)

    /// EaseInOut - Transiciones suaves
    static let easeInOut = Animation.easeInOut(duration: 0.3)

    /// EaseOut - Apariciones
    static let easeOut = Animation.easeOut(duration: 0.25)

    /// EaseIn - Desapariciones
    static let easeIn = Animation.easeIn(duration: 0.2)

    /// Linear - Loaders, progress bars
    static let linear = Animation.linear(duration: 0.5)

    /// Smooth - Transiciones muy suaves
    static let smooth = Animation.easeInOut(duration: 0.4)
}

// MARK: - Haptic Feedback
/// Manager centralizado para feedback háptico
enum HapticFeedback {

    /// Feedback ligero - Interacciones sutiles
    static func light() {
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.impactOccurred()
    }

    /// Feedback medio - Acciones estándar (botones)
    static func medium() {
        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.impactOccurred()
    }

    /// Feedback fuerte - Acciones importantes
    static func heavy() {
        let generator = UIImpactFeedbackGenerator(style: .heavy)
        generator.impactOccurred()
    }

    /// Feedback de éxito
    static func success() {
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.success)
    }

    /// Feedback de error
    static func error() {
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.error)
    }

    /// Feedback de advertencia
    static func warning() {
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.warning)
    }

    /// Feedback de selección (picker, toggle)
    static func selection() {
        let generator = UISelectionFeedbackGenerator()
        generator.selectionChanged()
    }
}

// MARK: - View Extensions
extension View {

    /// Aplica sombra con estilo pre-definido
    /// - Parameter style: Estilo de sombra (soft, medium, strong, subtle)
    /// - Returns: View con sombra aplicada
    func shadow(_ style: ShadowStyle) -> some View {
        self.shadow(color: style.color, radius: style.radius, x: style.x, y: style.y)
    }

    /// Aplica efecto de card con sombra y corner radius
    /// - Parameters:
    ///   - cornerRadius: Radio de las esquinas (default: medium)
    ///   - shadowStyle: Estilo de sombra (default: soft)
    /// - Returns: View con estilo de card
    func cardStyle(
        cornerRadius: CGFloat = CornerRadius.large,
        shadowStyle: ShadowStyle = .soft
    ) -> some View {
        self
            .background(Color.backgroundSecondary)
            .cornerRadius(cornerRadius)
            .shadow(shadowStyle)
    }

    /// Aplica animación con haptic feedback
    /// - Parameters:
    ///   - animation: Tipo de animación
    ///   - value: Valor que dispara la animación
    ///   - haptic: Tipo de feedback háptico (nil = sin haptic)
    /// - Returns: View con animación y haptic
    func animateWithHaptic<V: Equatable>(
        _ animation: Animation,
        value: V,
        haptic: (() -> Void)? = nil
    ) -> some View {
        self
            .animation(animation, value: value)
            .onChange(of: value) { _, _ in
                haptic?()
            }
    }
}

// MARK: - Micro-Copy
/// Textos humanizados y consistentes para toda la app
enum MicroCopy {

    // MARK: Loading States
    static let loading = "Un momento..."
    static let loadingData = "Cargando información..."
    static let saving = "Guardando cambios..."
    static let deleting = "Eliminando..."
    static let uploading = "Subiendo archivo..."

    // MARK: Success Messages
    static let success = "¡Listo! ✓"
    static let savedSuccessfully = "Cambios guardados correctamente"
    static let createdSuccessfully = "Creado exitosamente"
    static let deletedSuccessfully = "Eliminado correctamente"

    // MARK: Error Messages
    static let errorGeneric = "Algo salió mal. Intenta de nuevo"
    static let errorNetwork = "Verifica tu conexión a internet"
    static let errorServer = "El servidor no responde. Intenta más tarde"
    static let errorNotFound = "No encontramos lo que buscas"

    // MARK: Empty States
    static let noData = "Aún no hay información aquí"
    static let noResults = "No encontramos resultados"
    static let noConnection = "Sin conexión"

    // MARK: Actions
    static let confirm = "Listo"
    static let cancel = "Mejor no"
    static let delete = "Eliminar"
    static let edit = "Editar información"
    static let save = "Guardar cambios"
    static let create = "Crear nuevo"
    static let retry = "Intentar de nuevo"
    static let dismiss = "Cerrar"

    // MARK: Confirmations
    static let areYouSure = "¿Estás seguro?"
    static let cannotBeUndone = "Esta acción no se puede deshacer"
}

// MARK: - Design Tokens Preview
#if DEBUG
/// Vista de preview para visualizar todos los design tokens
struct DesignSystemPreview: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.xl) {
                // Colors
                Text("Colores")
                    .font(.displaySmall)

                LazyVGrid(columns: [GridItem(.adaptive(minimum: 100))], spacing: Spacing.md) {
                    ColorSwatch(name: "agroGreen", color: .agroGreen)
                    ColorSwatch(name: "agroGreenLight", color: .agroGreenLight)
                    ColorSwatch(name: "agroGreenTint", color: .agroGreenTint)
                    ColorSwatch(name: "successGreen", color: .successGreen)
                    ColorSwatch(name: "errorRed", color: .errorRed)
                    ColorSwatch(name: "warningAmber", color: .warningAmber)
                }

                Divider()

                // Typography
                Text("Tipografía")
                    .font(.displaySmall)

                VStack(alignment: .leading, spacing: Spacing.sm) {
                    Text("Display Large").font(.displayLarge)
                    Text("Display Medium").font(.displayMedium)
                    Text("Display Small").font(.displaySmall)
                    Text("Body Large").font(.bodyLarge)
                    Text("Body Medium").font(.bodyMedium)
                    Text("Body Small").font(.bodySmall)
                    Text("Label Large").font(.labelLarge)
                    Text("Label Medium").font(.labelMedium)
                    Text("Label Small").font(.labelSmall)
                }
            }
            .padding(Spacing.lg)
        }
        .background(Color.backgroundPrimary)
    }
}

struct ColorSwatch: View {
    let name: String
    let color: Color

    var body: some View {
        VStack {
            Rectangle()
                .fill(color)
                .frame(height: 60)
                .cornerRadius(CornerRadius.small)

            Text(name)
                .font(.labelSmall)
                .foregroundColor(.textSecondary)
        }
    }
}

#Preview {
    DesignSystemPreview()
}
#endif
