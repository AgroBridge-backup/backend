import SwiftUI

// MARK: - Custom Button (Jony Ive Edition)
/// Button premium con haptics, animaciones y 4 styles variados
/// "Design is not just what it looks like, design is how it works" - Jony Ive
struct CustomButton: View {

    // MARK: - Properties
    let title: String
    let icon: String?
    let style: ButtonStyle
    let isLoading: Bool
    let isDisabled: Bool
    let action: () -> Void

    @State private var isPressed = false

    // MARK: - Button Style
    enum ButtonStyle {
        case primary
        case secondary
        case tertiary
        case destructive

        var backgroundColor: Color {
            switch self {
            case .primary: return .agroGreen
            case .secondary: return .backgroundSecondary
            case .tertiary: return .clear
            case .destructive: return .errorRed
            }
        }

        var foregroundColor: Color {
            switch self {
            case .primary, .destructive: return .white
            case .secondary: return .agroGreen
            case .tertiary: return .agroGreen
            }
        }

        var borderColor: Color? {
            switch self {
            case .secondary: return .agroGreen.opacity(0.3)
            case .tertiary: return .agroGreen.opacity(0.2)
            default: return nil
            }
        }

        var shadowStyle: ShadowStyle? {
            switch self {
            case .primary, .destructive: return .soft
            default: return nil
            }
        }
    }

    // MARK: - Initializers

    /// Inicializador completo
    init(
        title: String,
        icon: String? = nil,
        style: ButtonStyle = .primary,
        isLoading: Bool = false,
        isDisabled: Bool = false,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.icon = icon
        self.style = style
        self.isLoading = isLoading
        self.isDisabled = isDisabled
        self.action = action
    }

    // MARK: - Legacy Support (compatibilidad con código existente)

    /// Inicializador con ButtonStyleType legacy
    init(
        title: String,
        icon: String? = nil,
        isLoading: Bool = false,
        style: ButtonStyleType = .primary,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.icon = icon
        self.isLoading = isLoading
        self.isDisabled = false
        self.action = action

        // Mapear de ButtonStyleType a ButtonStyle
        switch style {
        case .primary:
            self.style = .primary
        case .secondary:
            self.style = .secondary
        case .danger:
            self.style = .destructive
        case .outline:
            self.style = .tertiary
        }
    }

    // MARK: - Body
    var body: some View {
        Button(action: {
            guard !isLoading && !isDisabled else { return }

            // Haptic feedback
            HapticFeedback.medium()

            // Visual feedback
            withAnimation(AnimationPreset.spring) {
                isPressed = true
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                withAnimation(AnimationPreset.spring) {
                    isPressed = false
                }
                action()
            }
        }) {
            HStack(spacing: Spacing.xs) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: style.foregroundColor))
                        .scaleEffect(0.9)
                } else {
                    if let icon = icon {
                        Image(systemName: icon)
                            .font(.labelLarge)
                    }

                    Text(title)
                        .font(.labelLarge)
                }
            }
            .foregroundColor(style.foregroundColor)
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(style.backgroundColor)
            .cornerRadius(CornerRadius.medium)
            .overlay(
                RoundedRectangle(cornerRadius: CornerRadius.medium)
                    .stroke(style.borderColor ?? Color.clear, lineWidth: 1.5)
            )
        }
        .disabled(isLoading || isDisabled)
        .opacity((isLoading || isDisabled) ? 0.6 : 1.0)
        .scaleEffect(isPressed ? 0.96 : 1.0)
        .animation(AnimationPreset.spring, value: isPressed)
        .if(style.shadowStyle != nil) { view in
            view.shadow(style.shadowStyle!)
        }
        .accessibilityLabel(title)
        .accessibilityHint(isLoading ? "Procesando" : "Toca dos veces para activar")
        .accessibilityAddTraits(isDisabled ? .isButton : [.isButton])
    }
}

// MARK: - View Extension (Conditional Modifier)
extension View {
    /// Aplica modificador solo si condición es verdadera
    @ViewBuilder
    func `if`<Content: View>(_ condition: Bool, transform: (Self) -> Content) -> some View {
        if condition {
            transform(self)
        } else {
            self
        }
    }
}

// MARK: - ButtonStyleType (Legacy Support)
/// Enum legacy para compatibilidad con código existente
/// ⚠️ DEPRECATED: Usar CustomButton.ButtonStyle en lugar de este enum
enum ButtonStyleType {
    case primary
    case secondary
    case danger
    case outline

    var backgroundColor: Color {
        switch self {
        case .primary:
            return .agroGreen
        case .secondary:
            return .backgroundSecondary
        case .danger:
            return .errorRed
        case .outline:
            return .clear
        }
    }

    var textColor: Color {
        switch self {
        case .primary, .danger:
            return .white
        case .secondary:
            return .agroGreen
        case .outline:
            return .agroGreen
        }
    }
}

// MARK: - Preview
#Preview {
    VStack(spacing: Spacing.md) {
        // Primary
        CustomButton(
            title: "Crear Lote",
            icon: "plus.circle.fill",
            style: .primary,
            action: {}
        )

        // Secondary
        CustomButton(
            title: "Cancelar",
            icon: "xmark",
            style: .secondary,
            action: {}
        )

        // Tertiary
        CustomButton(
            title: "Más opciones",
            icon: "ellipsis",
            style: .tertiary,
            action: {}
        )

        // Destructive
        CustomButton(
            title: "Eliminar",
            icon: "trash.fill",
            style: .destructive,
            action: {}
        )

        // Loading state
        CustomButton(
            title: "Guardando cambios...",
            style: .primary,
            isLoading: true,
            action: {}
        )

        // Disabled state
        CustomButton(
            title: "Botón deshabilitado",
            style: .primary,
            isDisabled: true,
            action: {}
        )
    }
    .padding()
    .background(Color.backgroundPrimary)
}
