import SwiftUI

// MARK: - EditLoteView
/// Vista para editar un lote existente
struct EditLoteView: View {
    // MARK: - Properties
    @StateObject private var viewModel: EditLoteViewModel
    @Environment(\.dismiss) var dismiss

    // MARK: - Inicialización
    init(lote: Lote) {
        _viewModel = StateObject(wrappedValue: EditLoteViewModel(lote: lote))
    }

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
                                Image(systemName: "pencil.circle.fill")
                                    .font(.system(size: 32))
                                    .foregroundColor(.agrobridgePrimary)

                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Editar Lote")
                                        .font(.system(size: 24, weight: .bold))

                                    Text("Modifica los datos del lote")
                                        .font(.system(size: 14, weight: .medium))
                                        .foregroundColor(.secondary)
                                }

                                Spacer()
                            }
                        }
                        .padding(.horizontal)
                        .padding(.top)

                        // Formulario (reutilizando el mismo diseño de CreateLoteView)
                        VStack(spacing: 16) {
                            // Sección: Información Básica
                            SectionHeader(title: "Información Básica", icon: "info.circle")

                            CustomTextField(
                                placeholder: "Nombre del lote *",
                                icon: "tag.fill",
                                text: $viewModel.nombre,
                                autocapitalization: .words
                            )

                            CustomTextField(
                                placeholder: "Ubicación *",
                                icon: "location.fill",
                                text: $viewModel.ubicacion,
                                autocapitalization: .words
                            )

                            CustomTextField(
                                placeholder: "Tipo de cultivo *",
                                icon: "leaf.fill",
                                text: $viewModel.tipoCultivo,
                                autocapitalization: .words
                            )

                            // Sección: Detalles Opcionales
                            SectionHeader(title: "Detalles Opcionales", icon: "square.and.pencil")

                            CustomTextField(
                                placeholder: "Área (hectáreas)",
                                icon: "ruler",
                                text: $viewModel.areaHectareas,
                                keyboardType: .decimalPad
                            )

                            // Campo de notas (TextEditor)
                            VStack(alignment: .leading, spacing: 8) {
                                HStack {
                                    Image(systemName: "note.text")
                                        .font(.system(size: 14))
                                        .foregroundColor(.secondary)

                                    Text("Notas adicionales")
                                        .font(.system(size: 14, weight: .medium))
                                        .foregroundColor(.secondary)
                                }

                                TextEditor(text: $viewModel.notas)
                                    .frame(height: 100)
                                    .padding(8)
                                    .background(Color(.systemGray6))
                                    .cornerRadius(10)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 10)
                                            .stroke(Color.border.opacity(0.3), lineWidth: 1)
                                    )
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
                        }
                        .padding(.horizontal)

                        // Botones
                        VStack(spacing: 12) {
                            // Botón guardar cambios
                            CustomButton(
                                title: "Guardar Cambios",
                                icon: "checkmark",
                                isLoading: viewModel.isLoading,
                                style: .primary
                            ) {
                                Task {
                                    let success = await viewModel.updateLote()
                                    if success {
                                        // Cerrar vista después de guardar
                                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                                            dismiss()
                                        }
                                    }
                                }
                            }
                            .disabled(!viewModel.isFormValid || viewModel.isLoading)

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
            Text(viewModel.errorMessage ?? "Ha ocurrido un error actualizando el lote")
        }
        .alert("Éxito", isPresented: $viewModel.showSuccess) {
            Button("OK", role: .cancel) {
                dismiss()
            }
        } message: {
            Text("Lote actualizado exitosamente")
        }
    }
}

// MARK: - Preview
struct EditLoteView_Previews: PreviewProvider {
    static var previews: some View {
        EditLoteView(lote: Lote(
            id: "1",
            nombre: "Lote Norte",
            ubicacion: "Valle Central",
            tipoCultivo: "Aguacate",
            areaHectareas: 5.5,
            fechaCreacion: Date(),
            estado: .activo,
            productorId: "prod1",
            bloqueId: nil,
            metadata: nil
        ))
    }
}
