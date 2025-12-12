import SwiftUI

// MARK: - LoteDetailView
/// Vista de detalle de un lote
struct LoteDetailView: View {
    // MARK: - Properties
    @StateObject private var viewModel: LoteDetailViewModel
    @Environment(\.dismiss) var dismiss

    // MARK: - Inicialización
    init(lote: Lote) {
        _viewModel = StateObject(wrappedValue: LoteDetailViewModel(lote: lote))
    }

    var body: some View {
        ZStack {
            Color.secondaryBackground
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 20) {
                    // Header con nombre y estado
                    LoteHeaderCard(lote: viewModel.lote)
                        .padding(.horizontal)

                    // Información principal
                    InfoSection(lote: viewModel.lote)
                        .padding(.horizontal)

                    // Métricas
                    if viewModel.lote.areaHectareas != nil {
                        MetricsSection(lote: viewModel.lote)
                            .padding(.horizontal)
                    }

                    // Notas
                    if let metadata = viewModel.lote.metadata,
                       let notas = metadata.notas,
                       !notas.isEmpty {
                        NotasSection(notas: notas)
                            .padding(.horizontal)
                    }

                    // Botones de acción
                    ActionButtonsSection(
                        onEdit: {
                            viewModel.showEditLote = true
                        },
                        onDelete: {
                            viewModel.confirmDelete()
                        }
                    )
                    .padding(.horizontal)
                    .padding(.bottom)
                }
                .padding(.vertical)
            }
            .refreshable {
                await viewModel.refresh()
            }

            // Loading overlay
            if viewModel.isLoading {
                LoadingOverlay(message: "Actualizando...")
            }
        }
        .navigationTitle("Detalle del Lote")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $viewModel.showEditLote) {
            EditLoteView(lote: viewModel.lote)
        }
        .alert("Eliminar Lote", isPresented: $viewModel.showDeleteConfirmation) {
            Button("Cancelar", role: .cancel) {}
            Button("Eliminar", role: .destructive) {
                Task {
                    let success = await viewModel.deleteLote()
                    if success {
                        dismiss()
                    }
                }
            }
        } message: {
            Text("¿Estás seguro de que deseas eliminar el lote \"\(viewModel.lote.nombre)\"? Esta acción no se puede deshacer.")
        }
        .alert("Error", isPresented: $viewModel.showError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(viewModel.errorMessage ?? "Ha ocurrido un error")
        }
    }
}

// MARK: - LoteHeaderCard
struct LoteHeaderCard: View {
    let lote: Lote

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                VStack(alignment: .leading, spacing: 8) {
                    Text(lote.nombre)
                        .font(.system(size: 28, weight: .bold))
                        .foregroundColor(.primary)

                    Text(lote.tipoCultivo)
                        .font(.system(size: 18, weight: .medium))
                        .foregroundColor(.agrobridgePrimary)
                }

                Spacer()

                // Estado badge grande
                VStack(spacing: 4) {
                    Circle()
                        .fill(colorForEstado(lote.estado))
                        .frame(width: 16, height: 16)

                    Text(lote.estado.displayName)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(colorForEstado(lote.estado))
                }
            }
        }
        .padding(20)
        .background(Color.cardBackground)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
    }

    private func colorForEstado(_ estado: LoteEstado) -> Color {
        switch estado {
        case .activo: return .green
        case .inactivo: return .gray
        case .enCosecha: return .orange
        case .cosechado: return .blue
        }
    }
}

// MARK: - InfoSection
struct InfoSection: View {
    let lote: Lote

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Información", icon: "info.circle")

            VStack(spacing: 12) {
                DetailInfoRow(
                    icon: "location.fill",
                    title: "Ubicación",
                    value: lote.ubicacion,
                    color: .blue
                )

                DetailInfoRow(
                    icon: "calendar",
                    title: "Fecha de Creación",
                    value: lote.fechaCreacion.toStandardString(),
                    color: .orange
                )

                if let area = lote.areaHectareas {
                    DetailInfoRow(
                        icon: "ruler",
                        title: "Área",
                        value: String(format: "%.1f hectáreas", area),
                        color: .green
                    )
                }

                DetailInfoRow(
                    icon: "tag",
                    title: "ID del Lote",
                    value: lote.id,
                    color: .purple
                )
            }
        }
        .padding(20)
        .background(Color.cardBackground)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
    }
}

// MARK: - MetricsSection
struct MetricsSection: View {
    let lote: Lote

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Métricas", icon: "chart.bar")

            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 12) {
                MetricCard(
                    title: "Área",
                    value: String(format: "%.1f ha", lote.areaHectareas ?? 0),
                    icon: "ruler",
                    color: .green
                )

                MetricCard(
                    title: "Antigüedad",
                    value: daysAgoString(lote.fechaCreacion),
                    icon: "clock",
                    color: .blue
                )
            }
        }
        .padding(20)
        .background(Color.cardBackground)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
    }

    private func daysAgoString(_ date: Date) -> String {
        let days = Calendar.current.dateComponents([.day], from: date, to: Date()).day ?? 0
        return "\(days) días"
    }
}

// MARK: - NotasSection
struct NotasSection: View {
    let notas: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Notas", icon: "note.text")

            Text(notas)
                .font(.system(size: 15, weight: .regular))
                .foregroundColor(.secondary)
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.systemGray6))
                .cornerRadius(10)
        }
        .padding(20)
        .background(Color.cardBackground)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
    }
}

// MARK: - ActionButtonsSection
struct ActionButtonsSection: View {
    let onEdit: () -> Void
    let onDelete: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            // Botón Editar
            Button(action: onEdit) {
                HStack {
                    Image(systemName: "pencil")
                        .font(.system(size: 16, weight: .semibold))

                    Text("Editar Lote")
                        .font(.system(size: 17, weight: .semibold))
                }
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 52)
                .background(Color.agrobridgePrimary)
                .cornerRadius(12)
            }

            // Botón Eliminar
            Button(action: onDelete) {
                HStack {
                    Image(systemName: "trash")
                        .font(.system(size: 16, weight: .semibold))

                    Text("Eliminar Lote")
                        .font(.system(size: 17, weight: .semibold))
                }
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 52)
                .background(Color.red)
                .cornerRadius(12)
            }
        }
    }
}

// MARK: - DetailInfoRow
struct DetailInfoRow: View {
    let icon: String
    let title: String
    let value: String
    let color: Color

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 18))
                .foregroundColor(color)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(.secondary)

                Text(value)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(.primary)
            }

            Spacer()
        }
        .padding(12)
        .background(Color(.systemGray6).opacity(0.5))
        .cornerRadius(10)
    }
}

// MARK: - MetricCard
struct MetricCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 24))
                .foregroundColor(color)

            Text(value)
                .font(.system(size: 20, weight: .bold))
                .foregroundColor(.primary)

            Text(title)
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .background(color.opacity(0.1))
        .cornerRadius(12)
    }
}

// MARK: - Preview
struct LoteDetailView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationView {
            LoteDetailView(lote: Lote(
                id: "1",
                nombre: "Lote Norte",
                ubicacion: "Valle Central",
                tipoCultivo: "Aguacate",
                areaHectareas: 5.5,
                fechaCreacion: Date().addingTimeInterval(-86400 * 30),
                estado: .activo,
                productorId: "prod1",
                bloqueId: nil,
                metadata: LoteMetadata(
                    coordenadasGPS: nil,
                    fotos: nil,
                    notas: "Lote con buen rendimiento y calidad de fruta excelente."
                )
            ))
        }
    }
}
