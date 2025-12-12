import SwiftUI

// MARK: - ChangePasswordView
/// Vista para cambiar la contraseña del usuario
struct ChangePasswordView: View {
    // MARK: - Properties
    @Environment(\.dismiss) var dismiss

    @State private var currentPassword = ""
    @State private var newPassword = ""
    @State private var confirmPassword = ""
    @State private var showCurrentPassword = false
    @State private var showNewPassword = false
    @State private var showConfirmPassword = false
    @State private var isLoading = false
    @State private var showError = false
    @State private var showSuccess = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationView {
            ZStack {
                Color.secondaryBackground
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 24) {
                        // Header
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Image(systemName: "lock.shield.fill")
                                    .font(.system(size: 32))
                                    .foregroundColor(.agrobridgePrimary)

                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Cambiar Contraseña")
                                        .font(.system(size: 24, weight: .bold))

                                    Text("Actualiza tu contraseña de acceso")
                                        .font(.system(size: 14, weight: .medium))
                                        .foregroundColor(.secondary)
                                }

                                Spacer()
                            }
                        }
                        .padding(.horizontal)
                        .padding(.top)

                        // Formulario
                        VStack(spacing: 16) {
                            SectionHeader(title: "Seguridad", icon: "lock.fill")

                            // Contraseña actual
                            HStack {
                                Image(systemName: "lock.fill")
                                    .foregroundColor(.secondary)
                                    .frame(width: 20)

                                if showCurrentPassword {
                                    TextField("Contraseña actual", text: $currentPassword)
                                        .autocapitalization(.none)
                                        .disableAutocorrection(true)
                                } else {
                                    SecureField("Contraseña actual", text: $currentPassword)
                                }

                                Button(action: {
                                    showCurrentPassword.toggle()
                                }) {
                                    Image(systemName: showCurrentPassword ? "eye.slash.fill" : "eye.fill")
                                        .foregroundColor(.secondary)
                                }
                            }
                            .padding()
                            .background(Color(.systemGray6))
                            .cornerRadius(10)

                            // Nueva contraseña
                            HStack {
                                Image(systemName: "lock.fill")
                                    .foregroundColor(.secondary)
                                    .frame(width: 20)

                                if showNewPassword {
                                    TextField("Nueva contraseña", text: $newPassword)
                                        .autocapitalization(.none)
                                        .disableAutocorrection(true)
                                } else {
                                    SecureField("Nueva contraseña", text: $newPassword)
                                }

                                Button(action: {
                                    showNewPassword.toggle()
                                }) {
                                    Image(systemName: showNewPassword ? "eye.slash.fill" : "eye.fill")
                                        .foregroundColor(.secondary)
                                }
                            }
                            .padding()
                            .background(Color(.systemGray6))
                            .cornerRadius(10)

                            // Confirmar contraseña
                            HStack {
                                Image(systemName: "lock.fill")
                                    .foregroundColor(.secondary)
                                    .frame(width: 20)

                                if showConfirmPassword {
                                    TextField("Confirmar contraseña", text: $confirmPassword)
                                        .autocapitalization(.none)
                                        .disableAutocorrection(true)
                                } else {
                                    SecureField("Confirmar contraseña", text: $confirmPassword)
                                }

                                Button(action: {
                                    showConfirmPassword.toggle()
                                }) {
                                    Image(systemName: showConfirmPassword ? "eye.slash.fill" : "eye.fill")
                                        .foregroundColor(.secondary)
                                }
                            }
                            .padding()
                            .background(Color(.systemGray6))
                            .cornerRadius(10)

                            // Validaciones
                            VStack(alignment: .leading, spacing: 8) {
                                if !newPassword.isEmpty {
                                    ValidationRow(
                                        isValid: newPassword.count >= 6,
                                        text: "Mínimo 6 caracteres"
                                    )

                                    ValidationRow(
                                        isValid: !confirmPassword.isEmpty && newPassword == confirmPassword,
                                        text: "Las contraseñas coinciden"
                                    )
                                }
                            }
                            .padding(.top, 8)

                            // Nota informativa
                            HStack {
                                Image(systemName: "info.circle.fill")
                                    .foregroundColor(.info)
                                Text("La nueva contraseña debe tener al menos 6 caracteres")
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundColor(.secondary)
                                Spacer()
                            }
                            .padding(.top, 8)
                        }
                        .padding(.horizontal)

                        // Botones
                        VStack(spacing: 12) {
                            CustomButton(
                                title: "Cambiar Contraseña",
                                icon: "checkmark",
                                isLoading: isLoading,
                                style: .primary
                            ) {
                                changePassword()
                            }
                            .disabled(!isFormValid || isLoading)

                            Button(action: {
                                dismiss()
                            }) {
                                Text("Cancelar")
                                    .font(.system(size: 17, weight: .semibold))
                                    .foregroundColor(.agrobridgePrimary)
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 52)
                                    .background(Color.clear)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 12)
                                            .stroke(Color.agrobridgePrimary, lineWidth: 2)
                                    )
                            }
                        }
                        .padding(.horizontal)
                        .padding(.bottom)
                    }
                }
            }
            .navigationBarHidden(true)
        }
        .alert("Error", isPresented: $showError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "Ha ocurrido un error")
        }
        .alert("Éxito", isPresented: $showSuccess) {
            Button("OK", role: .cancel) {
                dismiss()
            }
        } message: {
            Text("Contraseña actualizada exitosamente")
        }
    }

    // MARK: - Computed Properties
    private var isFormValid: Bool {
        return !currentPassword.isEmpty &&
               !newPassword.isEmpty &&
               !confirmPassword.isEmpty &&
               newPassword.count >= 6 &&
               newPassword == confirmPassword
    }

    // MARK: - Actions
    private func changePassword() {
        guard isFormValid else { return }

        // TODO: Implementar cambio de contraseña cuando backend esté disponible
        // Por ahora, simular éxito
        isLoading = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            isLoading = false
            showSuccess = true
        }
    }
}

// MARK: - ValidationRow
struct ValidationRow: View {
    let isValid: Bool
    let text: String

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: isValid ? "checkmark.circle.fill" : "xmark.circle.fill")
                .font(.system(size: 14))
                .foregroundColor(isValid ? .green : .red)

            Text(text)
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(isValid ? .green : .secondary)
        }
    }
}

// MARK: - Preview
struct ChangePasswordView_Previews: PreviewProvider {
    static var previews: some View {
        ChangePasswordView()
    }
}
