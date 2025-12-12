import SwiftUI

// MARK: - LoginView
/// Pantalla de inicio de sesión con gradient y animated logo
struct LoginView: View {
    // MARK: - Properties
    @StateObject private var viewModel = LoginViewModel()
    @EnvironmentObject var authService: AuthService

    @State private var logoScale: CGFloat = 0.5
    @State private var logoOpacity: Double = 0.0

    var body: some View {
        ZStack {
            // MARK: - Animated Background
            ZStack {
                // Gradient background
                LinearGradient(
                    colors: [
                        Color.agroGreen.opacity(0.8),
                        Color.agroGreen,
                        Color.agroGreen.opacity(0.6)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()

                // Subtle pattern overlay
                Image(systemName: "leaf.fill")
                    .font(.system(size: 300))
                    .foregroundColor(.white.opacity(0.03))
                    .rotationEffect(.degrees(-15))
                    .offset(x: 100, y: -200)
            }

            ScrollView {
                VStack(spacing: 30) {
                    Spacer()
                        .frame(height: 40)

                    // Logo y Header
                    VStack(spacing: Spacing.md) {
                        // Animated logo con glow
                        ZStack {
                            // Glow effect
                            Circle()
                                .fill(
                                    RadialGradient(
                                        colors: [
                                            Color.white.opacity(0.3),
                                            Color.white.opacity(0.1),
                                            Color.clear
                                        ],
                                        center: .center,
                                        startRadius: 10,
                                        endRadius: 60
                                    )
                                )
                                .frame(width: 120, height: 120)

                            // Logo icon
                            Image(systemName: "leaf.fill")
                                .font(.system(size: 64, weight: .semibold))
                                .foregroundColor(.white)
                                .shadow(color: Color.black.opacity(0.2), radius: 8, x: 0, y: 4)
                        }
                        .scaleEffect(logoScale)
                        .opacity(logoOpacity)

                        Text("AgroBridge")
                            .font(.displayLarge)
                            .foregroundColor(.white)
                            .opacity(logoOpacity)

                        Text("Conectando productores con el futuro")
                            .font(.bodyMedium)
                            .foregroundColor(.white.opacity(0.9))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                            .opacity(logoOpacity)
                    }
                    .padding(.bottom, Spacing.lg)

                    // Formulario
                    VStack(spacing: 16) {
                        // Email
                        CustomTextField(
                            placeholder: "Email",
                            icon: "envelope.fill",
                            text: $viewModel.email,
                            keyboardType: .emailAddress,
                            autocapitalization: .never
                        )

                        // Password
                        CustomTextField(
                            placeholder: "Contraseña",
                            icon: "lock.fill",
                            text: $viewModel.password,
                            isSecure: true
                        )

                        // Mensaje de error
                        if let errorMessage = viewModel.errorMessage {
                            HStack(spacing: Spacing.xs) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .foregroundColor(.errorRed)
                                Text(errorMessage)
                                    .font(.bodySmall)
                                    .foregroundColor(.errorRed)
                                Spacer()
                            }
                            .padding(Spacing.sm)
                            .background(Color.errorRed.opacity(0.1))
                            .cornerRadius(CornerRadius.small)
                        }

                        // Botón de login
                        CustomButton(
                            title: "Iniciar Sesión",
                            icon: "arrow.right",
                            isLoading: viewModel.isLoading,
                            style: .primary
                        ) {
                            Task {
                                await viewModel.login()
                            }
                        }
                        .disabled(!viewModel.isFormValid || viewModel.isLoading)
                        .padding(.top, 8)

                        // Link de recuperar contraseña
                        Button(action: {
                            // TODO: Implementar recuperar contraseña
                            HapticFeedback.light()
                            print("Recuperar contraseña")
                        }) {
                            Text("¿Olvidaste tu contraseña?")
                                .font(.labelMedium)
                                .foregroundColor(.white.opacity(0.9))
                        }
                        .padding(.top, Spacing.xs)
                    }
                    .padding(.horizontal, 24)

                    Spacer()

                    // Footer
                    VStack(spacing: Spacing.xs) {
                        Text("Versión \(AppConfiguration.appVersion)")
                            .font(.bodySmall)
                            .foregroundColor(.white.opacity(0.6))

                        Text("Entorno: \(AppConfiguration.environment.displayName)")
                            .font(.labelSmall)
                            .foregroundColor(.white.opacity(0.5))
                    }
                    .padding(.bottom, Spacing.lg)
                }
            }
        }
        .onAppear {
            // Animar logo al aparecer
            withAnimation(AnimationPreset.springBouncy) {
                logoScale = 1.0
            }

            withAnimation(AnimationPreset.easeOut.delay(0.1)) {
                logoOpacity = 1.0
            }
        }
        .alert("Error", isPresented: $viewModel.showError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(viewModel.errorMessage ?? MicroCopy.errorGeneric)
        }
    }
}

// MARK: - Preview
struct LoginView_Previews: PreviewProvider {
    static var previews: some View {
        LoginView()
            .environmentObject(AuthService.shared)
    }
}
