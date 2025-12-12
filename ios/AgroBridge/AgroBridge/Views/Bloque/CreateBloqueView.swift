import SwiftUI

// MARK: - CreateBloqueView
/// Vista para crear un nuevo bloque
struct CreateBloqueView: View {
    // MARK: - Properties
    @StateObject private var viewModel = CreateBloqueViewModel()
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
                                Image(systemName: "cube.box.fill")
                                    .font(.system(size: 32))
                                    .foregroundColor(.agrobridgePrimary)

                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Nuevo Bloque")
                                        .font(.system(size: 24, weight: .bold))

                                    Text("Crea un bloque de trazabilidad para certificación")
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
                            SectionHeader(title: "Lotes Asociados (Opcional)", icon: "map.fill")

                            if viewModel.availableLotes.isEmpty {
                                VStack(spacing: 8) {
                                    Image(systemName: "map.slash")
                                        .font(.system(size: 32))
                                        .foregroundColor(.secondary)

                                    Text("No hay lotes disponibles")
                                        .font(.system(size: 14, weight: .medium))
                                        .foregroundColor(.secondary)

                                    Text("Crea lotes primero para asociarlos a este bloque")
                                        .font(.system(size: 12))
                                        .foregroundColor(.secondary)
                                        .multilineTextAlignment(.center)
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

                                if viewModel.notas.isEmpty {
                                    Text("Información adicional, certificaciones, auditorías...")
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
                        }
                        .padding(.horizontal)

                        // Botones
                        VStack(spacing: 12) {
                            // Botón crear bloque
                            CustomButton(
                                title: "Crear Bloque",
                                icon: "checkmark",
                                isLoading: viewModel.isLoading,
                                style: .primary
                            ) {
                                Task {
                                    let success = await viewModel.createBloque()
                                    if success {
                                        // Cerrar vista después de crear
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
            Text(viewModel.errorMessage ?? "Ha ocurrido un error creando el bloque")
        }
        .alert("Éxito", isPresented: $viewModel.showSuccess) {
            Button("OK", role: .cancel) {
                dismiss()
            }
        } message: {
            Text("Bloque creado exitosamente")
        }
    }
}

// MARK: - LoteSelectionChip
struct LoteSelectionChip: View {
    let lote: Lote
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(lote.nombre)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(isSelected ? .white : .primary)

                    if isSelected {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 14))
                            .foregroundColor(.white)
                    }
                }

                Text(lote.tipoCultivo)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(isSelected ? .white.opacity(0.9) : .secondary)

                if let area = lote.areaHectareas {
                    Text(String(format: "%.1f ha", area))
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(isSelected ? .white.opacity(0.8) : .secondary)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(isSelected ? Color.agrobridgePrimary : Color(.systemGray6))
            .cornerRadius(10)
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(isSelected ? Color.agrobridgePrimary : Color.border.opacity(0.3), lineWidth: isSelected ? 2 : 1)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Preview
struct CreateBloqueView_Previews: PreviewProvider {
    static var previews: some View {
        CreateBloqueView()
    }
}
