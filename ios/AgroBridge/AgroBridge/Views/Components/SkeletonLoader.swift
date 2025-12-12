import SwiftUI

// MARK: - Skeleton Loader
/// Skeleton con shimmer effect para loading states elegantes
/// Inspirado en Facebook/LinkedIn skeleton screens
struct SkeletonLoader: View {

    // MARK: - Properties
    let width: CGFloat?
    let height: CGFloat
    let cornerRadius: CGFloat

    @State private var isAnimating = false

    // MARK: - Initializer
    init(
        width: CGFloat? = nil,
        height: CGFloat,
        cornerRadius: CGFloat = CornerRadius.small
    ) {
        self.width = width
        self.height = height
        self.cornerRadius = cornerRadius
    }

    // MARK: - Body
    var body: some View {
        Rectangle()
            .fill(
                LinearGradient(
                    colors: [
                        Color.gray.opacity(0.15),
                        Color.gray.opacity(0.25),
                        Color.gray.opacity(0.15)
                    ],
                    startPoint: isAnimating ? .leading : .trailing,
                    endPoint: isAnimating ? .trailing : .leading
                )
            )
            .frame(width: width, height: height)
            .cornerRadius(cornerRadius)
            .onAppear {
                withAnimation(Animation.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                    isAnimating.toggle()
                }
            }
            .accessibilityLabel("Cargando")
            .accessibilityAddTraits(.updatesFrequently)
    }
}

// MARK: - Skeleton Presets

/// Skeleton para StatCard completo
struct SkeletonCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            HStack {
                SkeletonLoader(width: 48, height: 48, cornerRadius: 24)
                Spacer()
                SkeletonLoader(width: 60, height: 24, cornerRadius: CornerRadius.small)
            }

            SkeletonLoader(width: 120, height: 32, cornerRadius: CornerRadius.small)
            SkeletonLoader(width: 180, height: 16, cornerRadius: CornerRadius.small)
        }
        .padding(Spacing.lg)
        .background(Color.backgroundSecondary)
        .cornerRadius(CornerRadius.large)
        .shadow(ShadowStyle.soft)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Cargando estadística")
    }
}

/// Skeleton para lista item (LoteCard, ProductorCard, etc.)
struct SkeletonListItem: View {
    var body: some View {
        HStack(spacing: Spacing.md) {
            // Icon/Avatar placeholder
            SkeletonLoader(width: 56, height: 56, cornerRadius: CornerRadius.medium)

            VStack(alignment: .leading, spacing: Spacing.xs) {
                // Title
                SkeletonLoader(width: 180, height: 20, cornerRadius: CornerRadius.small)

                // Subtitle
                SkeletonLoader(width: 140, height: 16, cornerRadius: CornerRadius.small)

                // Detail
                SkeletonLoader(width: 100, height: 14, cornerRadius: CornerRadius.small)
            }

            Spacer()

            // Trailing icon
            SkeletonLoader(width: 24, height: 24, cornerRadius: CornerRadius.small)
        }
        .padding(Spacing.md)
        .background(Color.backgroundSecondary)
        .cornerRadius(CornerRadius.medium)
        .shadow(ShadowStyle.subtle)
    }
}

/// Skeleton para texto de párrafo
struct SkeletonText: View {
    let lines: Int
    let lastLineWidth: CGFloat?

    init(lines: Int = 3, lastLineWidth: CGFloat? = nil) {
        self.lines = lines
        self.lastLineWidth = lastLineWidth
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            ForEach(0..<lines, id: \.self) { index in
                if index == lines - 1 {
                    SkeletonLoader(
                        width: lastLineWidth,
                        height: 16,
                        cornerRadius: CornerRadius.small
                    )
                } else {
                    SkeletonLoader(
                        width: nil,
                        height: 16,
                        cornerRadius: CornerRadius.small
                    )
                }
            }
        }
    }
}

/// Skeleton para imagen cuadrada
struct SkeletonImage: View {
    let size: CGFloat
    let isCircle: Bool

    init(size: CGFloat = 120, isCircle: Bool = false) {
        self.size = size
        self.isCircle = isCircle
    }

    var body: some View {
        SkeletonLoader(
            width: size,
            height: size,
            cornerRadius: isCircle ? size / 2 : CornerRadius.medium
        )
    }
}

/// Skeleton para form field
struct SkeletonFormField: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            // Label
            SkeletonLoader(width: 100, height: 14, cornerRadius: CornerRadius.small)

            // Field
            SkeletonLoader(width: nil, height: 52, cornerRadius: CornerRadius.medium)
        }
    }
}

// MARK: - Loading View with Multiple Skeletons
/// Vista de loading completa con múltiples skeletons
struct SkeletonLoadingView: View {
    let type: SkeletonType

    enum SkeletonType {
        case dashboard
        case list
        case detail
        case form
    }

    var body: some View {
        ScrollView {
            VStack(spacing: Spacing.md) {
                switch type {
                case .dashboard:
                    dashboardSkeletons
                case .list:
                    listSkeletons
                case .detail:
                    detailSkeletons
                case .form:
                    formSkeletons
                }
            }
            .padding(Spacing.md)
        }
        .background(Color.backgroundPrimary)
        .accessibilityLabel("Cargando contenido")
    }

    // MARK: - Dashboard Skeletons
    private var dashboardSkeletons: some View {
        VStack(spacing: Spacing.md) {
            // Header
            SkeletonLoader(width: 200, height: 34, cornerRadius: CornerRadius.small)
                .padding(.bottom, Spacing.sm)

            // Stats Grid
            LazyVGrid(columns: [
                GridItem(.flexible(), spacing: Spacing.md),
                GridItem(.flexible(), spacing: Spacing.md)
            ], spacing: Spacing.md) {
                ForEach(0..<4, id: \.self) { _ in
                    SkeletonCard()
                }
            }

            // Section title
            SkeletonLoader(width: 150, height: 22, cornerRadius: CornerRadius.small)
                .padding(.top, Spacing.md)

            // List items
            ForEach(0..<3, id: \.self) { _ in
                SkeletonListItem()
            }
        }
    }

    // MARK: - List Skeletons
    private var listSkeletons: some View {
        VStack(spacing: Spacing.md) {
            ForEach(0..<8, id: \.self) { _ in
                SkeletonListItem()
            }
        }
    }

    // MARK: - Detail Skeletons
    private var detailSkeletons: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            // Hero image
            SkeletonImage(size: UIScreen.main.bounds.width - (Spacing.md * 2))

            // Title
            SkeletonLoader(width: 250, height: 28, cornerRadius: CornerRadius.small)

            // Subtitle
            SkeletonLoader(width: 180, height: 16, cornerRadius: CornerRadius.small)

            // Stats row
            HStack(spacing: Spacing.md) {
                ForEach(0..<3, id: \.self) { _ in
                    SkeletonLoader(width: nil, height: 60, cornerRadius: CornerRadius.medium)
                }
            }

            // Description
            SkeletonText(lines: 5, lastLineWidth: 200)
                .padding(.top, Spacing.sm)
        }
    }

    // MARK: - Form Skeletons
    private var formSkeletons: some View {
        VStack(spacing: Spacing.lg) {
            // Title
            SkeletonLoader(width: 200, height: 28, cornerRadius: CornerRadius.small)

            // Form fields
            ForEach(0..<5, id: \.self) { _ in
                SkeletonFormField()
            }

            // Button
            SkeletonLoader(width: nil, height: 52, cornerRadius: CornerRadius.medium)
                .padding(.top, Spacing.md)
        }
    }
}

// MARK: - Preview
#Preview("Basic Skeletons") {
    VStack(spacing: Spacing.xl) {
        Text("Skeleton Loader")
            .font(.displayMedium)

        SkeletonLoader(width: 200, height: 20)
        SkeletonLoader(width: 150, height: 20)
        SkeletonLoader(width: 100, height: 20)

        Divider()

        SkeletonCard()

        Divider()

        SkeletonListItem()

        Divider()

        SkeletonImage(size: 100, isCircle: true)
    }
    .padding()
    .background(Color.backgroundPrimary)
}

#Preview("Dashboard Loading") {
    SkeletonLoadingView(type: .dashboard)
}

#Preview("List Loading") {
    SkeletonLoadingView(type: .list)
}

#Preview("Detail Loading") {
    SkeletonLoadingView(type: .detail)
}

#Preview("Form Loading") {
    SkeletonLoadingView(type: .form)
}
