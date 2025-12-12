import SwiftUI

// MARK: - CreateProductorView
/// Vista para crear un nuevo productor
struct CreateProductorView: View {
    // MARK: - Properties
    @StateObject private var viewModel = CreateProductorViewModel()
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationView {
            ZStack {
                Color.secondaryBackground
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 24) {
                        // Header informativo
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Image(systemName: "person.crop.circle.fill.badge.plus")
                                    .font(.system(size: 32))
                                    .foregroundColor(.agrobridgePrimary)

                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Nuevo Productor")
                                        .font(.system(size: 24, weight: .bold))

                                    Text("Registra un nuevo productor en el sistema")
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
                            // Sección: Información Personal
                            SectionHeader(title: "Información Personal", icon: "person.fill")

                            CustomTextField(
                                placeholder: "Nombre completo *",
                                icon: "person.fill",
                                text: $viewModel.nombre,
                                autocapitalization: .words
                            )

                            CustomTextField(
                                placeholder: "Email",
                                icon: "envelope.fill",
                                text: $viewModel.email,
                                keyboardType: .emailAddress,
                                autocapitalization: .never
                            )

                            CustomTextField(
                                placeholder: "Teléfono",
                                icon: "phone.fill",
                                text: $viewModel.telefono,
                                keyboardType: .phonePad
                            )

                            // Sección: Ubicación
                            SectionHeader(title: "Ubicación", icon: "location.fill")

                            CustomTextField(
                                placeholder: "Dirección completa",
                                icon: "house.fill",
                                text: $viewModel.direccion,
                                autocapitalization: .words
                            )

                            CustomTextField(
                                placeholder: "Ubicación/Región",
                                icon: "map.fill",
                                text: $viewModel.ubicacion,
                                autocapitalization: .words
                            )

                            // Sección: Documentación
                            SectionHeader(title: "Documentación", icon: "doc.text.fill")

                            // Tipo de documento (Picker)
                            VStack(alignment: .leading, spacing: 8) {
                                HStack {
                                    Image(systemName: "doc.fill")
                                        .font(.system(size: 14))
                                        .foregroundColor(.secondary)

                                    Text("Tipo de Documento")
                                        .font(.system(size: 14, weight: .medium))
                                        .foregroundColor(.secondary)
                                }

                                Picker("Tipo de Documento", selection: $viewModel.tipoDocumento) {
                                    ForEach(TipoDocumento.allCases, id: \.self) { tipo in
                                        Text(tipo.displayName).tag(tipo)
                                    }
                                }
                                .pickerStyle(.segmented)
                            }

                            CustomTextField(
                                placeholder: "Número de documento",
                                icon: "number",
                                text: $viewModel.documentoIdentidad
                            )

                            // Sección: Notas Adicionales
                            SectionHeader(title: "Notas Adicionales", icon: "note.text")

                            // Campo de notas (TextEditor)
                            VStack(alignment: .leading, spacing: 8) {
                                TextEditor(text: $viewModel.notas)
                                    .frame(height: 100)
                                    .padding(8)
                                    .background(Color(.systemGray6))
                                    .cornerRadius(10)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 10)
                                            .stroke(Color.border.opacity(0.3), lineWidth: 1)
                                    )

                                if viewModel.notas.isEmpty {
                                    Text("Certificaciones, especialidades u otras observaciones...")
                                        .font(.system(size: 14))
                                        .foregroundColor(.secondary.opacity(0.7))
                                        .padding(.leading, 8)
                                        .padding(.top, -90)
                                        .allowsHitTesting(false)
                                }
                            }

                            // Nota informativa
                            HStack {
                                Image(systemName: "info.circle.fill")
                                    .foregroundColor(.info)
                                Text("Los campos marcados con * son obligatorios")
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundColor(.secondary)
                                Spacer()
                            }
                            .padding(.top, 8)

                            // Validación de email
                            if !viewModel.email.isEmpty && !viewModel.isEmailValid {
                                HStack {
                                    Image(systemName: "exclamationmark.triangle.fill")
                                        .foregroundColor(.red)
                                    Text("El email ingresado no es válido")
                                        .font(.system(size: 12, weight: .medium))
                                        .foregroundColor(.red)
                                    Spacer()
                                }
                            }
                        }
                        .padding(.horizontal)

                        // Botones
                        VStack(spacing: 12) {
                            // Botón crear productor
                            CustomButton(
                                title: "Crear Productor",
                                icon: "checkmark",
                                isLoading: viewModel.isLoading,
                                style: .primary
                            ) {
                                Task {
                                    let success = await viewModel.createProductor()
                                    if success {
                                        // Cerrar vista después de crear
                                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                                            dismiss()
                                        }
                                    }
                                }
                            }
                            .disabled(!viewModel.isFormValid || !viewModel.isEmailValid || viewModel.isLoading)

                            // Botón cancelar
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
                            .disabled(viewModel.isLoading)
                        }
                        .padding(.horizontal)
                        .padding(.bottom)
                    }
                }
            }
            .navigationBarHidden(true)
        }
        .alert("Error", isPresented: $viewModel.showError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(viewModel.errorMessage ?? "Ha ocurrido un error creando el productor")
        }
        .alert("Éxito", isPresented: $viewModel.showSuccess) {
            Button("OK", role: .cancel) {
                dismiss()
            }
        } message: {
            Text("Productor creado exitosamente")
        }
    }
}

// MARK: - Preview
struct CreateProductorView_Previews: PreviewProvider {
    static var previews: some View {
        CreateProductorView()
    }
}
