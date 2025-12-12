import SwiftUI

// MARK: - CreateLoteView
/// Pantalla para crear un nuevo lote
struct CreateLoteView: View {
    // MARK: - Properties
    @StateObject private var viewModel = CreateLoteViewModel()
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationView {
            ZStack {
                Color.backgroundPrimary
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: Spacing.xl) {
                        // Header informativo
                        VStack(alignment: .leading, spacing: Spacing.sm) {
                            HStack {
                                ZStack {
                                    Circle()
                                        .fill(Color.agroGreen.opacity(0.12))
                                        .frame(width: 56, height: 56)

                                    Image(systemName: "leaf.fill")
                                        .font(.system(size: 28, weight: .semibold))
                                        .foregroundColor(.agroGreen)
                                }

                                VStack(alignment: .leading, spacing: Spacing.xxs) {
                                    Text("Nuevo Lote")
                                        .font(.displayMedium)
                                        .foregroundColor(.textPrimary)

                                    Text("Completa los datos del lote de producción")
                                        .font(.bodyMedium)
                                        .foregroundColor(.textSecondary)
                                }

                                Spacer()
                            }
                        }
                        .padding(.horizontal, Spacing.lg)
                        .padding(.top, Spacing.md)

                        // Formulario
                        VStack(spacing: Spacing.lg) {
                            // Sección: Información Básica
                            SectionHeader(title: "Información Básica", icon: "info.circle.fill")

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
                            VStack(alignment: .leading, spacing: Spacing.xs) {
                                HStack(spacing: Spacing.xs) {
                                    Image(systemName: "note.text")
                                        .font(.labelMedium)
                                        .foregroundColor(.textSecondary)

                                    Text("Notas adicionales")
                                        .font(.labelMedium)
                                        .foregroundColor(.textSecondary)
                                }

                                TextEditor(text: $viewModel.notas)
                                    .frame(height: 120)
                                    .padding(Spacing.sm)
                                    .font(.bodyLarge)
                                    .foregroundColor(.textPrimary)
                                    .scrollContentBackground(.hidden)
                                    .background(Color.backgroundSecondary)
                                    .cornerRadius(CornerRadius.medium)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: CornerRadius.medium)
                                            .stroke(Color.divider, lineWidth: 1)
                                    )
                            }

                            // Nota informativa
                            HStack(spacing: Spacing.xs) {
                                Image(systemName: "info.circle.fill")
                                    .foregroundColor(.infoBlue)
                                    .font(.labelSmall)
                                Text("Los campos marcados con * son obligatorios")
                                    .font(.bodySmall)
                                    .foregroundColor(.textSecondary)
                                Spacer()
                            }
                            .padding(.top, Spacing.xs)
                        }
                        .padding(.horizontal, Spacing.lg)

                        // Botones
                        VStack(spacing: Spacing.md) {
                            // Botón crear
                            CustomButton(
                                title: "Crear Lote",
                                icon: "checkmark.circle.fill",
                                style: .primary,
                                isLoading: viewModel.isLoading
                            ) {
                                HapticFeedback.medium()
                                Task {
                                    let success = await viewModel.createLote()
                                    if success {
                                        HapticFeedback.success()
                                        // Cerrar vista después de crear
                                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                                            dismiss()
                                        }
                                    } else {
                                        HapticFeedback.error()
                                    }
                                }
                            }
                            .disabled(!viewModel.isFormValid || viewModel.isLoading)

                            // Botón cancelar
                            CustomButton(
                                title: MicroCopy.cancel,
                                icon: "xmark",
                                style: .secondary
                            ) {
                                HapticFeedback.light()
                                dismiss()
                            }
                            .disabled(viewModel.isLoading)
                        }
                        .padding(.horizontal, Spacing.lg)
                        .padding(.bottom, Spacing.lg)
                    }
                }
            }
            .navigationBarHidden(true)
        }
        .alert("Error", isPresented: $viewModel.showError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(viewModel.errorMessage ?? MicroCopy.errorGeneric)
        }
        .alert("¡Listo!", isPresented: $viewModel.showSuccess) {
            Button("OK", role: .cancel) {
                dismiss()
            }
        } message: {
            Text(MicroCopy.createdSuccessfully)
        }
    }
}

// MARK: - SectionHeader
struct SectionHeader: View {
    let title: String
    let icon: String

    var body: some View {
        HStack(spacing: Spacing.xs) {
            Image(systemName: icon)
                .font(.labelLarge)
                .foregroundColor(.agroGreen)

            Text(title)
                .font(.displaySmall)
                .foregroundColor(.textPrimary)

            Spacer()
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(title)
        .accessibilityAddTraits(.isHeader)
    }
}

// MARK: - Preview
#Preview {
    CreateLoteView()
}
