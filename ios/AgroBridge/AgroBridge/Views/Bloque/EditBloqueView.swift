import SwiftUI

// MARK: - EditBloqueView
/// Vista para editar un bloque existente
struct EditBloqueView: View {
    // MARK: - Properties
    @StateObject private var viewModel: EditBloqueViewModel
    @Environment(\.dismiss) var dismiss

    // MARK: - Inicialización
    init(bloque: Bloque) {
        _viewModel = StateObject(wrappedValue: EditBloqueViewModel(bloque: bloque))
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
                                    Text("Editar Bloque")
                                        .font(.system(size: 24, weight: .bold))

                                    Text("Modifica los datos del bloque")
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
                            // Sección: Información Básica
                            SectionHeader(title: "Información Básica", icon: "info.circle")

                            CustomTextField(
                                placeholder: "Nombre del bloque *",
                                icon: "cube.fill",
                                text: $viewModel.nombre,
                                autocapitalization: .words
                            )

                            CustomTextField(
                                placeholder: "Descripción",
                                icon: "doc.text.fill",
                                text: $viewModel.descripcion,
                                autocapitalization: .sentences
                            )

                            // Sección: Lotes Asociados
                            SectionHeader(title: "Lotes Asociados", icon: "map.fill")

                            if viewModel.availableLotes.isEmpty {
                                VStack(spacing: 8) {
                                    Image(systemName: "map.slash")
                                        .font(.system(size: 32))
                                        .foregroundColor(.secondary)

                                    Text("No hay lotes disponibles")
                                        .font(.system(size: 14, weight: .medium))
                                        .foregroundColor(.secondary)
                                }
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(Color(.systemGray6))
                                .cornerRadius(10)
                            } else {
                                VStack(alignment: .leading, spacing: 12) {
                                    Text("\(viewModel.selectedLoteIds.count) lote\(viewModel.selectedLoteIds.count == 1 ? "" : "s") seleccionado\(viewModel.selectedLoteIds.count == 1 ? "" : "s")")
                                        .font(.system(size: 13, weight: .semibold))
                                        .foregroundColor(.agrobridgePrimary)

                                    ScrollView(.horizontal, showsIndicators: false) {
                                        HStack(spacing: 12) {
                                            ForEach(viewModel.availableLotes) { lote in
                                                LoteSelectionChip(
                                                    lote: lote,
                                                    isSelected: viewModel.isLoteSelected(lote.id),
                                                    onTap: {
                                                        viewModel.toggleLoteSelection(lote.id)
                                                    }
                                                )
                                            }
                                        }
                                    }
                                }
                            }

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
                                    let success = await viewModel.updateBloque()
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
            Text(viewModel.errorMessage ?? "Ha ocurrido un error actualizando el bloque")
        }
        .alert("Éxito", isPresented: $viewModel.showSuccess) {
            Button("OK", role: .cancel) {
                dismiss()
            }
        } message: {
            Text("Bloque actualizado exitosamente")
        }
    }
}

// MARK: - Preview
struct EditBloqueView_Previews: PreviewProvider {
    static var previews: some View {
        EditBloqueView(bloque: Bloque(
            id: "1",
            nombre: "Bloque Aguacate 2024",
            descripcion: "Producción orgánica certificada",
            productorId: "prod1",
            loteIds: ["lote1", "lote2"],
            estado: .activo,
            certificado: false,
            fechaCreacion: Date(),
            fechaActualizacion: nil,
            fechaCertificacion: nil,
            metadata: nil
        ))
    }
}
