import Foundation
import Combine

// MARK: - LoginViewModel
/// ViewModel para la pantalla de Login
@MainActor
class LoginViewModel: ObservableObject {
    // MARK: - Published Properties
    @Published var email = ""
    @Published var password = ""
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var showError = false

    // MARK: - Dependencies
    private let authService: AuthService

    // MARK: - Computed Properties
    /// Validación de email
    var isEmailValid: Bool {
        return email.isValidEmail
    }

    /// Validación de password
    var isPasswordValid: Bool {
        return password.count >= 6
    }

    /// Validación del formulario completo
    var isFormValid: Bool {
        return isEmailValid && isPasswordValid
    }

    // MARK: - Inicialización
    init(authService: AuthService = .shared) {
        self.authService = authService
    }

    // MARK: - Actions
    /// Realiza el login
    func login() async {
        // Limpiar errores previos
        errorMessage = nil
        showError = false
        isLoading = true

        defer { isLoading = false }

        do {
            try await authService.login(
                email: email.trimmed.lowercased(),
                password: password
            )

            // Login exitoso - AuthService maneja el estado

        } catch {
            // Manejar error
            errorMessage = (error as? NetworkError)?.errorDescription ?? error.localizedDescription
            showError = true
        }
    }

    /// Limpia el formulario
    func clearForm() {
        email = ""
        password = ""
        errorMessage = nil
        showError = false
    }
}
