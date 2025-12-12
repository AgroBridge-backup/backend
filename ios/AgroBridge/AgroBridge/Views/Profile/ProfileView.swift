import SwiftUI

// MARK: - ProfileView
/// Vista del perfil de usuario
struct ProfileView: View {
    // MARK: - Properties
    @StateObject private var viewModel = ProfileViewModel()

    var body: some View {
        NavigationView {
            ZStack {
                Color.secondaryBackground
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 24) {
                        // Header con avatar y nombre
                        ProfileHeaderCard(
                            initials: viewModel.initials,
                            name: viewModel.userName,
                            email: viewModel.userEmail,
                            role: viewModel.userRole
                        )
                        .padding(.horizontal)
                        .padding(.top)

                        // Información de la cuenta
                        AccountInfoSection(accountAge: viewModel.accountAge)
                            .padding(.horizontal)

                        // Opciones del perfil
                        ProfileOptionsSection(
                            onEditProfile: {
                                viewModel.openEditProfile()
                            },
                            onChangePassword: {
                                viewModel.openChangePassword()
                            },
                            onSettings: {
                                viewModel.openSettings()
                            }
                        )
                        .padding(.horizontal)

                        // Botón de cerrar sesión
                        Button(action: {
                            viewModel.confirmLogout()
                        }) {
                            HStack {
                                Image(systemName: "rectangle.portrait.and.arrow.right")
                                    .font(.system(size: 16, weight: .semibold))

                                Text("Cerrar Sesión")
                                    .font(.system(size: 17, weight: .semibold))
                            }
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 52)
                            .background(Color.red)
                            .cornerRadius(12)
                        }
                        .padding(.horizontal)
                        .padding(.bottom)

                        // Versión de la app
                        Text("AgroBridge v1.0.0")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(.secondary)
                            .padding(.bottom)
                    }
                }
                .refreshable {
                    await viewModel.refresh()
                }

                // Loading overlay
                if viewModel.isLoading {
                    LoadingOverlay(message: "Cargando...")
                }
            }
            .navigationTitle("Perfil")
            .navigationBarTitleDisplayMode(.large)
        }
        .sheet(isPresented: $viewModel.showEditProfile) {
            EditProfileView()
        }
        .sheet(isPresented: $viewModel.showChangePassword) {
            ChangePasswordView()
        }
        .sheet(isPresented: $viewModel.showSettings) {
            SettingsView()
        }
        .alert("Cerrar Sesión", isPresented: $viewModel.showLogoutConfirmation) {
            Button("Cancelar", role: .cancel) {}
            Button("Cerrar Sesión", role: .destructive) {
                Task {
                    await viewModel.logout()
                }
            }
        } message: {
            Text("¿Estás seguro de que deseas cerrar sesión?")
        }
        .alert("Error", isPresented: $viewModel.showError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(viewModel.errorMessage ?? "Ha ocurrido un error")
        }
    }
}

// MARK: - ProfileHeaderCard
struct ProfileHeaderCard: View {
    let initials: String
    let name: String
    let email: String
    let role: String

    var body: some View {
        VStack(spacing: 16) {
            // Avatar circular con iniciales
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            gradient: Gradient(colors: [Color.agrobridgePrimary, Color.agrobridgePrimary.opacity(0.7)]),
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 100, height: 100)

                Text(initials)
                    .font(.system(size: 36, weight: .bold))
                    .foregroundColor(.white)
            }

            // Nombre y email
            VStack(spacing: 8) {
                Text(name)
                    .font(.system(size: 24, weight: .bold))
                    .foregroundColor(.primary)

                Text(email)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(.secondary)

                // Badge de rol
                HStack(spacing: 6) {
                    Image(systemName: "person.badge.shield.checkmark.fill")
                        .font(.system(size: 12))
                        .foregroundColor(.agrobridgePrimary)

                    Text(role)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.agrobridgePrimary)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Color.agrobridgePrimary.opacity(0.15))
                .cornerRadius(8)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
        .background(Color.cardBackground)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
    }
}

// MARK: - AccountInfoSection
struct AccountInfoSection: View {
    let accountAge: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Información de la Cuenta", icon: "info.circle")

            HStack(spacing: 20) {
                // Antigüedad
                HStack(spacing: 8) {
                    Image(systemName: "calendar")
                        .font(.system(size: 16))
                        .foregroundColor(.blue)

                    VStack(alignment: .leading, spacing: 2) {
                        Text("Miembro desde")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(.secondary)

                        Text(accountAge)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(.primary)
                    }
                }

                Spacer()
            }
            .padding()
            .background(Color(.systemGray6).opacity(0.5))
            .cornerRadius(10)
        }
        .padding(20)
        .background(Color.cardBackground)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
    }
}

// MARK: - ProfileOptionsSection
struct ProfileOptionsSection: View {
    let onEditProfile: () -> Void
    let onChangePassword: () -> Void
    let onSettings: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Opciones", icon: "gear")

            VStack(spacing: 0) {
                ProfileOptionRow(
                    icon: "pencil",
                    title: "Editar Perfil",
                    iconColor: .blue,
                    action: onEditProfile
                )

                Divider()
                    .padding(.leading, 44)

                ProfileOptionRow(
                    icon: "lock.shield",
                    title: "Cambiar Contraseña",
                    iconColor: .orange,
                    action: onChangePassword
                )

                Divider()
                    .padding(.leading, 44)

                ProfileOptionRow(
                    icon: "gear",
                    title: "Configuración",
                    iconColor: .purple,
                    action: onSettings
                )
            }
            .background(Color.cardBackground)
            .cornerRadius(12)
        }
        .padding(20)
        .background(Color.cardBackground)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
    }
}

// MARK: - ProfileOptionRow
struct ProfileOptionRow: View {
    let icon: String
    let title: String
    let iconColor: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 16))
                    .foregroundColor(iconColor)
                    .frame(width: 28)

                Text(title)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(.primary)

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.secondary)
            }
            .padding(.vertical, 12)
            .padding(.horizontal, 8)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Preview
struct ProfileView_Previews: PreviewProvider {
    static var previews: some View {
        ProfileView()
    }
}
