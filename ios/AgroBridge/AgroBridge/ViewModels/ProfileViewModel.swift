import Foundation
import Combine

// MARK: - ProfileViewModel
/// ViewModel para la vista de perfil de usuario
@MainActor
class ProfileViewModel: ObservableObject {
    // MARK: - Constants
    // FIXED: LOW-013 - Extract magic number to constant for placeholder account age
    private let PLACEHOLDER_ACCOUNT_AGE_DAYS = 30

    // MARK: - Published Properties
    @Published private(set) var currentUser: User?
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?
    @Published var showError = false
    @Published var showEditProfile = false
    @Published var showChangePassword = false
    @Published var showSettings = false
    @Published var showLogoutConfirmation = false

    // MARK: - Dependencies
    private let authService: AuthService
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Computed Properties
    var userName: String {
        return currentUser?.nombre ?? "Usuario"
    }

    var userEmail: String {
        return currentUser?.email ?? ""
    }

    var userRole: String {
        return currentUser?.rol.displayName ?? ""
    }

    var accountAge: String {
        guard let user = currentUser else { return "N/A" }

        // Calcular días desde creación (usando fecha actual como placeholder)
        return "\(PLACEHOLDER_ACCOUNT_AGE_DAYS) días"
    }

    var initials: String {
        let name = userName
        let components = name.components(separatedBy: " ")

        if components.count >= 2 {
            let firstInitial = components[0].prefix(1)
            let lastInitial = components[1].prefix(1)
            return "\(firstInitial)\(lastInitial)".uppercased()
        } else if let firstInitial = name.first {
            return String(firstInitial).uppercased()
        }

        return "U"
    }

    // MARK: - Inicialización
    init(authService: AuthService = .shared) {
        self.authService = authService

        // Observar cambios en el usuario actual
        authService.$currentUser
            .sink { [weak self] user in
                self?.currentUser = user
            }
            .store(in: &cancellables)
    }

    // MARK: - Actions
    /// Refresca los datos del usuario
    func refresh() async {
        isLoading = true
        errorMessage = nil
        showError = false

        defer { isLoading = false }

        // TODO: Implementar refresh desde backend cuando esté disponible
        // Por ahora solo esperar un momento
        try? await Task.sleep(nanoseconds: 500_000_000)
    }

    /// Cierra sesión del usuario
    func logout() async {
        isLoading = true
        defer { isLoading = false }

        await authService.logout()
    }

    /// Muestra confirmación de cierre de sesión
    func confirmLogout() {
        showLogoutConfirmation = true
    }

    /// Abre la vista de editar perfil
    func openEditProfile() {
        showEditProfile = true
    }

    /// Abre la vista de cambiar contraseña
    func openChangePassword() {
        showChangePassword = true
    }

    /// Abre la vista de configuración
    func openSettings() {
        showSettings = true
    }
}
