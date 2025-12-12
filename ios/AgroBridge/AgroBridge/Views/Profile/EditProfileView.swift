import SwiftUI

// MARK: - EditProfileView
/// Vista para editar el perfil del usuario
struct EditProfileView: View {
    // MARK: - Properties
    @Environment(\.dismiss) var dismiss
    @StateObject private var authService = AuthService.shared

    @State private var nombre: String = ""
    @State private var email: String = ""
    @State private var isLoading = false
    @State private var showError = false
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
                                Image(systemName: "person.crop.circle.fill.badge.checkmark")
                                    .font(.system(size: 32))
                                    .foregroundColor(.agrobridgePrimary)

                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Editar Perfil")
                                        .font(.system(size: 24, weight: .bold))

                                    Text("Actualiza tu información personal")
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
                            SectionHeader(title: "Información Personal", icon: "person.fill")

                            CustomTextField(
                                placeholder: "Nombre completo",
                                icon: "person.fill",
                                text: $nombre,
                                autocapitalization: .words
                            )

                            CustomTextField(
                                placeholder: "Email",
                                icon: "envelope.fill",
                                text: $email,
                                keyboardType: .emailAddress,
                                autocapitalization: .never
                            )

                            // Nota informativa
                            HStack {
                                Image(systemName: "info.circle.fill")
                                    .foregroundColor(.info)
                                Text("Los cambios se guardarán en tu perfil")
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
                                title: "Guardar Cambios",
                                icon: "checkmark",
                                isLoading: isLoading,
                                style: .primary
                            ) {
                                // TODO: Implementar actualización cuando backend esté disponible
                                dismiss()
                            }
                            .disabled(nombre.isBlank || isLoading)

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
        .onAppear {
            // Pre-llenar con datos actuales
            if let user = authService.currentUser {
                nombre = user.nombre
                email = user.email
            }
        }
        .alert("Error", isPresented: $showError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "Ha ocurrido un error")
        }
    }
}

// MARK: - Preview
struct EditProfileView_Previews: PreviewProvider {
    static var previews: some View {
        EditProfileView()
    }
}
