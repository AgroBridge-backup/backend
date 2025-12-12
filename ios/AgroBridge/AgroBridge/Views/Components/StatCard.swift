import SwiftUI

// MARK: - Stat Card (Jony Ive Edition)
/// Card de estadística con depth, micro-animaciones y visual delight
/// "Good design is actually a lot harder to notice than poor design" - Jony Ive
struct StatCard: View {

    // MARK: - Properties
    let title: String
    let value: String
    let icon: String
    let trend: Trend?
    let color: Color

    @State private var isPressed = false
    @State private var appeared = false

    // MARK: - Trend Enum
    /// Representa tendencias numéricas con dirección y valor
    enum Trend {
        case up(String)
        case down(String)
        case neutral

        var color: Color {
            switch self {
            case .up: return .successGreen
            case .down: return .errorRed
            case .neutral: return .textSecondary
            }
        }

        var icon: String {
            switch self {
            case .up: return "arrow.up.right"
            case .down: return "arrow.down.right"
            case .neutral: return "minus"
            }
        }

        var text: String {
            switch self {
            case .up(let value), .down(let value): return value
            case .neutral: return "Sin cambios"
            }
        }
    }

    // MARK: - Initializers

    /// Inicializador completo con trend
    init(
        title: String,
        value: String,
        icon: String,
        trend: Trend? = nil,
        color: Color
    ) {
        self.title = title
        self.value = value
        self.icon = icon
        self.trend = trend
        self.color = color
    }

    /// Inicializador sin trend (compatibilidad con código existente)
    init(
        title: String,
        value: String,
        icon: String,
        color: Color
    ) {
        self.init(title: title, value: value, icon: icon, trend: nil, color: color)
    }

    // MARK: - Body
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            // Icon + Trend
            HStack {
                // Icon con background circular
                ZStack {
                    Circle()
                        .fill(color.opacity(0.12))
                        .frame(width: 48, height: 48)

                    Image(systemName: icon)
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundColor(color)
                }
                .scaleEffect(appeared ? 1.0 : 0.8)
                .animation(AnimationPreset.springBouncy.delay(0.1), value: appeared)

                Spacer()

                // Trend badge
                if let trend = trend {
                    HStack(spacing: 4) {
                        Image(systemName: trend.icon)
                            .font(.system(size: 10, weight: .bold))
                        Text(trend.text)
                            .font(.labelSmall)
                    }
                    .foregroundColor(trend.color)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(trend.color.opacity(0.12))
                    .cornerRadius(CornerRadius.small)
                    .opacity(appeared ? 1.0 : 0.0)
                    .animation(AnimationPreset.easeOut.delay(0.2), value: appeared)
                }
            }

            // Value
            Text(value)
                .font(.displayMedium)
                .foregroundColor(.textPrimary)
                .opacity(appeared ? 1.0 : 0.0)
                .offset(y: appeared ? 0 : 10)
                .animation(AnimationPreset.easeOut.delay(0.15), value: appeared)

            // Title
            Text(title)
                .font(.bodyMedium)
                .foregroundColor(.textSecondary)
                .lineLimit(2)
                .minimumScaleFactor(0.8)
                .opacity(appeared ? 1.0 : 0.0)
                .animation(AnimationPreset.easeOut.delay(0.2), value: appeared)
        }
        .padding(Spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.backgroundSecondary)
        .cornerRadius(CornerRadius.large)
        .shadow(
            color: ShadowStyle.soft.color,
            radius: isPressed ? ShadowStyle.soft.radius * 0.5 : ShadowStyle.soft.radius,
            x: ShadowStyle.soft.x,
            y: isPressed ? ShadowStyle.soft.y * 0.5 : ShadowStyle.soft.y
        )
        .scaleEffect(isPressed ? 0.97 : 1.0)
        .animation(AnimationPreset.spring, value: isPressed)
        .onAppear {
            appeared = true
        }
        .onTapGesture {
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
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title): \(value). \(trend != nil ? "Tendencia: \(trend!.text)" : "")")
    }
}

// MARK: - Preview
#Preview {
    VStack(spacing: Spacing.md) {
        StatCard(
            title: "Productores Activos",
            value: "248",
            icon: "person.3.fill",
            trend: .up("+12%"),
            color: .agroGreen
        )

        StatCard(
            title: "Lotes Certificados",
            value: "1,456",
            icon: "checkmark.seal.fill",
            trend: .neutral,
            color: .successGreen
        )

        StatCard(
            title: "Bloques Pendientes",
            value: "24",
            icon: "hourglass",
            trend: .down("-8%"),
            color: .warningAmber
        )

        // Card sin trend (compatibilidad)
        StatCard(
            title: "Total Producción",
            value: "12.5 ton",
            icon: "scalemass.fill",
            color: .agroSky
        )
    }
    .padding()
    .background(Color.backgroundPrimary)
}
