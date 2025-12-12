import SwiftUI

// MARK: - LoadingView
/// Vista de carga con spinner y mensaje
/// Nota: Para skeletons elegantes, usar SkeletonLoadingView en su lugar
struct LoadingView: View {
    // MARK: - Properties
    var message: String = MicroCopy.loading

    // MARK: - Body
    var body: some View {
        VStack(spacing: Spacing.md) {
            ProgressView()
                .scaleEffect(1.2)
                .tint(.agroGreen)

            Text(message)
                .font(.bodyMedium)
                .foregroundColor(.textSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.backgroundPrimary)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(message)
        .accessibilityAddTraits(.updatesFrequently)
    }
}

// MARK: - LoadingOverlay
/// Overlay de carga que se muestra sobre el contenido
struct LoadingOverlay: View {
    // MARK: - Properties
    var message: String = MicroCopy.loading

    // MARK: - Body
    var body: some View {
        ZStack {
            Color.black.opacity(0.4)
                .ignoresSafeArea()

            VStack(spacing: Spacing.md) {
                ProgressView()
                    .scaleEffect(1.5)
                    .tint(.white)

                Text(message)
                    .font(.bodyMedium)
                    .foregroundColor(.white)
            }
            .padding(Spacing.xl)
            .background(
                Color.agroGreen
                    .opacity(0.95)
                    .blur(radius: 20)
            )
            .background(Color.agroGreen)
            .cornerRadius(CornerRadius.large)
            .shadow(ShadowStyle.strong)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(message)
        .accessibilityAddTraits(.updatesFrequently)
    }
}

// MARK: - Preview
#Preview("Loading View") {
    LoadingView(message: MicroCopy.loadingData)
}

#Preview("Loading Overlay") {
    ZStack {
        // Background content
        Color.backgroundPrimary
            .ignoresSafeArea()

        VStack {
            Text("Contenido de fondo")
                .font(.displayMedium)
        }

        // Overlay on top
        LoadingOverlay(message: MicroCopy.saving)
    }
}
