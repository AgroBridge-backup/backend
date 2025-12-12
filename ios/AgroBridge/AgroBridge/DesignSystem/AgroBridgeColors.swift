import SwiftUI

// MARK: - Color Extensions
extension Color {
    // MARK: - Primary Colors
    static let agroGreen = Color(red: 45/255, green: 80/255, blue: 22/255)
    static let agroGreenLight = Color(red: 76/255, green: 175/255, blue: 80/255)
    static let agroGreenDark = Color(red: 27/255, green: 94/255, blue: 32/255)

    // MARK: - Neutral Colors
    static let textPrimary = Color(red: 33/255, green: 33/255, blue: 33/255)
    static let textSecondary = Color(red: 117/255, green: 117/255, blue: 117/255)
    static let backgroundPrimary = Color(red: 250/255, green: 250/255, blue: 250/255)
    static let backgroundSecondary = Color(red: 245/255, green: 245/255, blue: 245/255)

    // MARK: - Semantic Colors
    static let success = Color.green
    static let warning = Color.orange
    static let error = Color.red
    static let info = Color.blue

    // MARK: - Status Colors
    static let statusActive = Color.green
    static let statusInactive = Color.gray
    static let statusPending = Color.orange
    static let statusCertified = Color.blue
}

// MARK: - Font Extensions
extension Font {
    static let agroLargeTitle = Font.system(size: 34, weight: .bold)
    static let agroTitle1 = Font.system(size: 28, weight: .bold)
    static let agroTitle2 = Font.system(size: 22, weight: .bold)
    static let agroTitle3 = Font.system(size: 20, weight: .semibold)
    static let agroHeadline = Font.system(size: 17, weight: .semibold)
    static let agroBody = Font.system(size: 17, weight: .regular)
    static let agroCallout = Font.system(size: 16, weight: .regular)
    static let agroSubheadline = Font.system(size: 15, weight: .regular)
    static let agroFootnote = Font.system(size: 13, weight: .regular)
    static let agroCaption1 = Font.system(size: 12, weight: .regular)
    static let agroCaption2 = Font.system(size: 11, weight: .regular)
}

// MARK: - Spacing Constants
extension CGFloat {
    static let spacing4: CGFloat = 4
    static let spacing8: CGFloat = 8
    static let spacing12: CGFloat = 12
    static let spacing16: CGFloat = 16
    static let spacing20: CGFloat = 20
    static let spacing24: CGFloat = 24
    static let spacing32: CGFloat = 32
    static let spacing40: CGFloat = 40
    static let spacing48: CGFloat = 48

    static let cornerRadius8: CGFloat = 8
    static let cornerRadius12: CGFloat = 12
    static let cornerRadius16: CGFloat = 16
    static let cornerRadius20: CGFloat = 20
    static let cornerRadius24: CGFloat = 24
}

// MARK: - Shadow Modifiers
struct CardShadow: ViewModifier {
    func body(content: Content) -> some View {
        content
            .shadow(color: .black.opacity(0.1), radius: 8, x: 0, y: 2)
    }
}

struct ElevatedShadow: ViewModifier {
    func body(content: Content) -> some View {
        content
            .shadow(color: .black.opacity(0.15), radius: 12, x: 0, y: 4)
    }
}

extension View {
    func cardShadow() -> some View {
        modifier(CardShadow())
    }

    func elevatedShadow() -> some View {
        modifier(ElevatedShadow())
    }
}
