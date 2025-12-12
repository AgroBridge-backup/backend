/*:
 # 🎨 AgroBridge Design System - Interactive Playground

 **Welcome!** This playground lets you experiment with the AgroBridge Design System.

 ## 📚 What You'll Learn
 - All design tokens (colors, typography, spacing, shadows)
 - How to build components using the design system
 - Best practices and common patterns
 - Interactive examples you can modify

 ---

 ## 🎯 How to Use This Playground
 1. **Read** the explanations in the comments
 2. **Run** the code to see results (▶️ button or Cmd+Shift+Enter)
 3. **Modify** values to experiment
 4. **Build** your own components using the tokens

 > **Tip:** Show the Live View for SwiftUI previews
 > Editor → Canvas (or Cmd+Option+Enter)

 ---
 */

import SwiftUI
import PlaygroundSupport

/*:
 ## 🎨 Part 1: Color System

 The AgroBridge Design System uses semantic colors that adapt to Dark Mode.
 All colors are defined as extensions on `Color`.
 */

// MARK: - Color System Implementation

extension Color {
    // MARK: Brand Colors
    static let agroGreen = Color(hex: "#2D5016")       // Primary
    static let agroGreenLight = Color(hex: "#57A02B")  // Accent/CTA
    static let agroGreenTint = Color(hex: "#E8F5E3")   // Subtle backgrounds
    static let agroEarth = Color(hex: "#8B6F47")       // Secondary
    static let agroSky = Color(hex: "#4A90E2")         // Tertiary

    // MARK: Semantic Colors
    static let successGreen = Color(hex: "#34C759")
    static let warningAmber = Color(hex: "#FF9500")
    static let errorRed = Color(hex: "#FF3B30")
    static let infoBlue = Color(hex: "#007AFF")

    // MARK: Text Colors
    static let textPrimary = Color(hex: "#1C1C1E")
    static let textSecondary = Color(hex: "#6C6C70")
    static let textTertiary = Color(hex: "#AEAEB2")

    // MARK: Background Colors
    static let backgroundPrimary = Color(hex: "#F8FAF7")
    static let backgroundSecondary = Color.white
    static let divider = Color(hex: "#E5E5EA")

    // MARK: Hex Initializer
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

/*:
 ### 🎨 Try It: Color Palette Preview

 Run this code to see all brand colors in action.
 **Exercise:** Change the colors and see the preview update!
 */

struct ColorPaletteView: View {
    var body: some View {
        VStack(spacing: 16) {
            Text("AgroBridge Color Palette")
                .font(.system(size: 24, weight: .bold))
                .foregroundColor(.textPrimary)

            // Brand Colors
            VStack(alignment: .leading, spacing: 8) {
                Text("Brand Colors")
                    .font(.headline)
                    .foregroundColor(.textSecondary)

                HStack(spacing: 12) {
                    ColorSwatch(color: .agroGreen, name: "Primary")
                    ColorSwatch(color: .agroGreenLight, name: "Accent")
                    ColorSwatch(color: .agroGreenTint, name: "Tint")
                }
            }

            // Semantic Colors
            VStack(alignment: .leading, spacing: 8) {
                Text("Semantic Colors")
                    .font(.headline)
                    .foregroundColor(.textSecondary)

                HStack(spacing: 12) {
                    ColorSwatch(color: .successGreen, name: "Success")
                    ColorSwatch(color: .warningAmber, name: "Warning")
                    ColorSwatch(color: .errorRed, name: "Error")
                    ColorSwatch(color: .infoBlue, name: "Info")
                }
            }
        }
        .padding(24)
        .background(Color.backgroundPrimary)
    }
}

struct ColorSwatch: View {
    let color: Color
    let name: String

    var body: some View {
        VStack(spacing: 4) {
            RoundedRectangle(cornerRadius: 8)
                .fill(color)
                .frame(width: 60, height: 60)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.divider, lineWidth: 1)
                )

            Text(name)
                .font(.caption)
                .foregroundColor(.textSecondary)
        }
    }
}

// Preview the color palette
PlaygroundPage.current.setLiveView(ColorPaletteView())

/*:
 ---
 ## 📝 Part 2: Typography System

 Typography uses SF Pro (Apple's system font) with a clear hierarchy.
 */

extension Font {
    // MARK: Display (Headlines, Titles)
    static let displayLarge = Font.system(size: 34, weight: .bold)
    static let displayMedium = Font.system(size: 28, weight: .semibold)
    static let displaySmall = Font.system(size: 22, weight: .semibold)

    // MARK: Body (Content)
    static let bodyLarge = Font.system(size: 17, weight: .regular)
    static let bodyMedium = Font.system(size: 15, weight: .regular)
    static let bodySmall = Font.system(size: 13, weight: .regular)

    // MARK: Label (UI Elements)
    static let labelLarge = Font.system(size: 17, weight: .semibold)
    static let labelMedium = Font.system(size: 15, weight: .medium)
    static let labelSmall = Font.system(size: 12, weight: .medium)
}

/*:
 ### 📝 Try It: Typography Hierarchy

 See how different text styles work together.
 **Exercise:** Try different font combinations!
 */

struct TypographyView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Typography Hierarchy")
                    .font(.displayLarge)
                    .foregroundColor(.textPrimary)

                VStack(alignment: .leading, spacing: 12) {
                    // Display fonts
                    Group {
                        Text("Display Large (34pt, bold)")
                            .font(.displayLarge)

                        Text("Display Medium (28pt, semibold)")
                            .font(.displayMedium)

                        Text("Display Small (22pt, semibold)")
                            .font(.displaySmall)
                    }
                    .foregroundColor(.textPrimary)

                    Divider()

                    // Body fonts
                    Group {
                        Text("Body Large (17pt, regular)")
                            .font(.bodyLarge)

                        Text("Body Medium (15pt, regular)")
                            .font(.bodyMedium)

                        Text("Body Small (13pt, regular)")
                            .font(.bodySmall)
                    }
                    .foregroundColor(.textSecondary)

                    Divider()

                    // Label fonts
                    Group {
                        Text("Label Large (17pt, semibold)")
                            .font(.labelLarge)

                        Text("Label Medium (15pt, medium)")
                            .font(.labelMedium)

                        Text("Label Small (12pt, medium)")
                            .font(.labelSmall)
                    }
                    .foregroundColor(.textPrimary)
                }
            }
            .padding(24)
        }
        .background(Color.backgroundPrimary)
    }
}

// Uncomment to preview typography:
// PlaygroundPage.current.setLiveView(TypographyView())

/*:
 ---
 ## 📐 Part 3: Spacing System (4pt Grid)

 All spacing follows a 4pt grid for visual consistency.
 */

enum Spacing {
    static let xxs: CGFloat = 4      // Tight
    static let xs: CGFloat = 8       // Compact
    static let sm: CGFloat = 12      // Comfortable
    static let md: CGFloat = 16      // Default ⭐
    static let lg: CGFloat = 20      // Generous
    static let xl: CGFloat = 24      // Spacious
    static let xxl: CGFloat = 32     // Large gaps
    static let xxxl: CGFloat = 48    // Hero spacing
}

/*:
 ### 📐 Try It: Spacing Visualization

 See how the 4pt grid system works.
 **Exercise:** Adjust spacing values and observe changes!
 */

struct SpacingView: View {
    var body: some View {
        VStack(spacing: Spacing.lg) {
            Text("Spacing System (4pt Grid)")
                .font(.displayMedium)
                .foregroundColor(.textPrimary)

            VStack(alignment: .leading, spacing: Spacing.md) {
                SpacingExample(spacing: Spacing.xxs, label: "xxs (4pt)")
                SpacingExample(spacing: Spacing.xs, label: "xs (8pt)")
                SpacingExample(spacing: Spacing.sm, label: "sm (12pt)")
                SpacingExample(spacing: Spacing.md, label: "md (16pt) ⭐")
                SpacingExample(spacing: Spacing.lg, label: "lg (20pt)")
                SpacingExample(spacing: Spacing.xl, label: "xl (24pt)")
                SpacingExample(spacing: Spacing.xxl, label: "xxl (32pt)")
                SpacingExample(spacing: Spacing.xxxl, label: "xxxl (48pt)")
            }
        }
        .padding(Spacing.xl)
        .background(Color.backgroundPrimary)
    }
}

struct SpacingExample: View {
    let spacing: CGFloat
    let label: String

    var body: some View {
        HStack {
            Rectangle()
                .fill(Color.agroGreen)
                .frame(width: spacing, height: 20)

            Text(label)
                .font(.bodyMedium)
                .foregroundColor(.textSecondary)
        }
    }
}

// Uncomment to preview spacing:
// PlaygroundPage.current.setLiveView(SpacingView())

/*:
 ---
 ## 🔘 Part 4: Corner Radius

 Consistent corner radius creates visual harmony.
 */

enum CornerRadius {
    static let small: CGFloat = 8
    static let medium: CGFloat = 12
    static let large: CGFloat = 16
    static let xlarge: CGFloat = 20
    static let xxlarge: CGFloat = 24
}

/*:
 ---
 ## 🌑 Part 5: Shadows (Elevation)

 Shadows create depth and visual hierarchy.
 */

struct ShadowStyle {
    let color: Color
    let radius: CGFloat
    let x: CGFloat
    let y: CGFloat

    static let subtle = ShadowStyle(
        color: Color.black.opacity(0.05),
        radius: 4,
        x: 0,
        y: 1
    )

    static let soft = ShadowStyle(
        color: Color.black.opacity(0.08),
        radius: 8,
        x: 0,
        y: 2
    )

    static let medium = ShadowStyle(
        color: Color.black.opacity(0.12),
        radius: 16,
        x: 0,
        y: 4
    )

    static let strong = ShadowStyle(
        color: Color.black.opacity(0.20),
        radius: 24,
        x: 0,
        y: 8
    )
}

extension View {
    func shadow(_ style: ShadowStyle) -> some View {
        self.shadow(
            color: style.color,
            radius: style.radius,
            x: style.x,
            y: style.y
        )
    }
}

/*:
 ---
 ## 🎨 Part 6: Building a Component

 Let's build a **StatCard** using the design system!
 */

struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    let trend: Trend?

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
            case .up(let value): return value
            case .down(let value): return value
            case .neutral: return "—"
            }
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            // Header with icon and trend
            HStack {
                // Icon circle
                ZStack {
                    Circle()
                        .fill(color.opacity(0.12))
                        .frame(width: 48, height: 48)

                    Image(systemName: icon)
                        .font(.system(size: 24, weight: .semibold))
                        .foregroundColor(color)
                }

                Spacer()

                // Trend badge
                if let trend = trend {
                    HStack(spacing: 4) {
                        Image(systemName: trend.icon)
                            .font(.system(size: 10, weight: .semibold))

                        Text(trend.text)
                            .font(.labelSmall)
                    }
                    .foregroundColor(trend.color)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(trend.color.opacity(0.12))
                    .cornerRadius(CornerRadius.small)
                }
            }

            // Value
            Text(value)
                .font(.displayMedium)
                .foregroundColor(.textPrimary)

            // Title
            Text(title)
                .font(.bodyMedium)
                .foregroundColor(.textSecondary)
        }
        .padding(Spacing.lg)
        .background(Color.backgroundSecondary)
        .cornerRadius(CornerRadius.large)
        .shadow(ShadowStyle.soft)
    }
}

/*:
 ### 🎯 Try It: Interactive StatCard

 Experiment with different values, icons, colors, and trends!
 **Exercise:** Create your own stat card variations below.
 */

struct StatCardDemo: View {
    var body: some View {
        ScrollView {
            VStack(spacing: Spacing.xl) {
                Text("StatCard Examples")
                    .font(.displayLarge)
                    .foregroundColor(.textPrimary)

                // Example 1: Producers (positive trend)
                StatCard(
                    title: "Total Productores",
                    value: "248",
                    icon: "person.3.fill",
                    color: .agroGreen,
                    trend: .up("+12%")
                )

                // Example 2: Active Lots (positive trend)
                StatCard(
                    title: "Lotes Activos",
                    value: "156",
                    icon: "leaf.fill",
                    color: .successGreen,
                    trend: .up("+8%")
                )

                // Example 3: Pending (negative trend)
                StatCard(
                    title: "Pendientes",
                    value: "24",
                    icon: "clock.fill",
                    color: .warningAmber,
                    trend: .down("-5%")
                )

                // Example 4: Certified Blocks (neutral)
                StatCard(
                    title: "Bloques Certificados",
                    value: "89",
                    icon: "checkmark.seal.fill",
                    color: .agroSky,
                    trend: .neutral
                )

                // 🎯 YOUR TURN: Create your own StatCard here!
                StatCard(
                    title: "Your Custom Stat",
                    value: "999",
                    icon: "star.fill",
                    color: .agroGreenLight,
                    trend: .up("+25%")
                )
            }
            .padding(Spacing.xl)
        }
        .background(Color.backgroundPrimary)
    }
}

// Preview the StatCard demo
PlaygroundPage.current.setLiveView(StatCardDemo())

/*:
 ---
 ## 🎨 Part 7: Custom Button Component

 Let's build a reusable button with multiple styles!
 */

struct CustomButton: View {
    let title: String
    let icon: String?
    let style: ButtonStyle
    let action: () -> Void

    @State private var isPressed = false

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
            case .secondary, .tertiary: return .agroGreen
            }
        }

        var borderColor: Color? {
            switch self {
            case .primary, .destructive: return nil
            case .secondary: return .agroGreen.opacity(0.3)
            case .tertiary: return .agroGreen.opacity(0.2)
            }
        }
    }

    var body: some View {
        Button(action: {
            isPressed = true
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                isPressed = false
                action()
            }
        }) {
            HStack(spacing: Spacing.xs) {
                if let icon = icon {
                    Image(systemName: icon)
                        .font(.labelLarge)
                }

                Text(title)
                    .font(.labelLarge)
            }
            .foregroundColor(style.foregroundColor)
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(style.backgroundColor)
            .cornerRadius(CornerRadius.medium)
            .overlay(
                RoundedRectangle(cornerRadius: CornerRadius.medium)
                    .stroke(style.borderColor ?? Color.clear, lineWidth: 1)
            )
        }
        .scaleEffect(isPressed ? 0.96 : 1.0)
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isPressed)
    }
}

/*:
 ### 🎯 Try It: Interactive Buttons

 Test all button styles and see the press animation!
 */

struct ButtonDemo: View {
    @State private var lastPressed = "None"

    var body: some View {
        VStack(spacing: Spacing.xl) {
            Text("CustomButton Styles")
                .font(.displayLarge)
                .foregroundColor(.textPrimary)

            Text("Last pressed: \(lastPressed)")
                .font(.bodyMedium)
                .foregroundColor(.textSecondary)

            VStack(spacing: Spacing.md) {
                CustomButton(
                    title: "Primary Button",
                    icon: "checkmark.circle.fill",
                    style: .primary
                ) {
                    lastPressed = "Primary"
                }

                CustomButton(
                    title: "Secondary Button",
                    icon: "arrow.right",
                    style: .secondary
                ) {
                    lastPressed = "Secondary"
                }

                CustomButton(
                    title: "Tertiary Button",
                    icon: "ellipsis",
                    style: .tertiary
                ) {
                    lastPressed = "Tertiary"
                }

                CustomButton(
                    title: "Destructive Button",
                    icon: "trash.fill",
                    style: .destructive
                ) {
                    lastPressed = "Destructive"
                }
            }
        }
        .padding(Spacing.xl)
        .background(Color.backgroundPrimary)
    }
}

// Uncomment to preview buttons:
// PlaygroundPage.current.setLiveView(ButtonDemo())

/*:
 ---
 ## 🎓 Exercises & Challenges

 ### Beginner
 1. ✅ Change the color of a StatCard
 2. ✅ Create a StatCard with your own data
 3. ✅ Try different button styles

 ### Intermediate
 4. 🎯 Build a complete card with image + text + button
 5. 🎯 Create a custom color and use it in components
 6. 🎯 Combine multiple components into a dashboard layout

 ### Advanced
 7. 🚀 Create a new component using the design system
 8. 🚀 Build an animated loading state
 9. 🚀 Design a complete screen with navigation

 ---

 ## 📚 What's Next?

 Explore other playgrounds:
 - **MVVM Architecture** - Learn the app's architecture patterns
 - **API Integration** - Work with network requests
 - **Component Gallery** - See all components in action

 ## 📖 Full Documentation

 - [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md) - Complete design system guide
 - [COMPONENTS.md](../COMPONENTS.md) - Component library reference
 - [ARCHITECTURE.md](../ARCHITECTURE.md) - Architecture documentation

 ---

 **Created by:** Alejandro Navarro Ayala - CEO & Senior Developer
 **Version:** 1.0.0
 **Last Updated:** November 28, 2024

 Happy coding! 🚀
 */
