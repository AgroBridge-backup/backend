import SwiftUI

// MARK: - ProductorDetailView
/// Vista de detalle de un productor
struct ProductorDetailView: View {
    // MARK: - Properties
    @StateObject private var viewModel: ProductorDetailViewModel
    @Environment(\.dismiss) var dismiss

    // MARK: - Inicialización
    init(productor: Productor) {
        _viewModel = StateObject(wrappedValue: ProductorDetailViewModel(productor: productor))
    }

    var body: some View {
        ZStack {
            Color.secondaryBackground
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 20) {
                    // Header con nombre y estado
                    ProductorHeaderCard(productor: viewModel.productor)
                        .padding(.horizontal)

                    // Información de contacto
                    ContactInfoSection(productor: viewModel.productor)
                        .padding(.horizontal)

                    // Información de ubicación
                    if viewModel.productor.direccion != nil || viewModel.productor.ubicacion != nil {
                        LocationInfoSection(productor: viewModel.productor)
                            .padding(.horizontal)
                    }

                    // Información de documentación
                    if viewModel.productor.documentoIdentidad != nil {
                        DocumentationSection(productor: viewModel.productor)
                            .padding(.horizontal)
                    }

                    // Métricas
                    ProductorMetricsSection(productor: viewModel.productor)
                        .padding(.horizontal)

                    // Notas
                    if let metadata = viewModel.productor.metadata,
                       let notas = metadata.notas,
                       !notas.isEmpty {
                        NotasSection(notas: notas)
                            .padding(.horizontal)
                    }

                    // Botones de acción
                    ProductorActionButtonsSection(
                        onEdit: {
                            viewModel.showEditProductor = true
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
        .navigationTitle("Detalle del Productor")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $viewModel.showEditProductor) {
            // TODO: EditProductorView(productor: viewModel.productor)
            Text("Editar \(viewModel.productor.nombre)")
        }
        .alert("Eliminar Productor", isPresented: $viewModel.showDeleteConfirmation) {
            Button("Cancelar", role: .cancel) {}
            Button("Eliminar", role: .destructive) {
                Task {
                    let success = await viewModel.deleteProductor()
                    if success {
                        dismiss()
                    }
                }
            }
        } message: {
            Text("¿Estás seguro de que deseas eliminar al productor \"\(viewModel.productor.nombre)\"? Esta acción no se puede deshacer.")
        }
        .alert("Error", isPresented: $viewModel.showError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(viewModel.errorMessage ?? "Ha ocurrido un error")
        }
    }
}

// MARK: - ProductorHeaderCard
struct ProductorHeaderCard: View {
    let productor: Productor

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                VStack(alignment: .leading, spacing: 8) {
                    Text(productor.nombre)
                        .font(.system(size: 28, weight: .bold))
                        .foregroundColor(.primary)

                    if let email = productor.email {
                        HStack(spacing: 6) {
                            Image(systemName: "envelope.fill")
                                .font(.system(size: 14))
                                .foregroundColor(.agrobridgePrimary)

                            Text(email)
                                .font(.system(size: 16, weight: .medium))
                                .foregroundColor(.secondary)
                        }
                    }
                }

                Spacer()

                // Estado badge grande
                VStack(spacing: 4) {
                    Image(systemName: productor.estado.icon)
                        .font(.system(size: 20))
                        .foregroundColor(colorForEstado(productor.estado))

                    Text(productor.estado.displayName)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(colorForEstado(productor.estado))
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(colorForEstado(productor.estado).opacity(0.15))
                .cornerRadius(10)
            }
        }
        .padding(20)
        .background(Color.cardBackground)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
    }

    private func colorForEstado(_ estado: ProductorEstado) -> Color {
        switch estado {
        case .activo: return .green
        case .inactivo: return .gray
        case .suspendido: return .red
        }
    }
}

// MARK: - ContactInfoSection
struct ContactInfoSection: View {
    let productor: Productor

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Información de Contacto", icon: "phone.circle")

            VStack(spacing: 12) {
                if let telefono = productor.telefono {
                    DetailInfoRow(
                        icon: "phone.fill",
                        title: "Teléfono",
                        value: telefono,
                        color: .blue
                    )
                }

                if let email = productor.email {
                    DetailInfoRow(
                        icon: "envelope.fill",
                        title: "Email",
                        value: email,
                        color: .agrobridgePrimary
                    )
                }

                if telefono == nil && email == nil {
                    Text("No hay información de contacto disponible")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.secondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding()
                }
            }
        }
        .padding(20)
        .background(Color.cardBackground)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
    }

    private var telefono: String? { productor.telefono }
    private var email: String? { productor.email }
}

// MARK: - LocationInfoSection
struct LocationInfoSection: View {
    let productor: Productor

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Ubicación", icon: "location.circle")

            VStack(spacing: 12) {
                if let direccion = productor.direccion {
                    DetailInfoRow(
                        icon: "house.fill",
                        title: "Dirección",
                        value: direccion,
                        color: .orange
                    )
                }

                if let ubicacion = productor.ubicacion {
                    DetailInfoRow(
                        icon: "map.fill",
                        title: "Región",
                        value: ubicacion,
                        color: .green
                    )
                }
            }
        }
        .padding(20)
        .background(Color.cardBackground)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
    }
}

// MARK: - DocumentationSection
struct DocumentationSection: View {
    let productor: Productor

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Documentación", icon: "doc.text")

            VStack(spacing: 12) {
                if let tipoDocumento = productor.tipoDocumento {
                    DetailInfoRow(
                        icon: "doc.fill",
                        title: "Tipo de Documento",
                        value: tipoDocumento.displayName,
                        color: .purple
                    )
                }

                if let documentoIdentidad = productor.documentoIdentidad {
                    DetailInfoRow(
                        icon: "number",
                        title: "Número de Documento",
                        value: documentoIdentidad,
                        color: .indigo
                    )
                }
            }
        }
        .padding(20)
        .background(Color.cardBackground)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
    }
}

// MARK: - ProductorMetricsSection
struct ProductorMetricsSection: View {
    let productor: Productor

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Métricas", icon: "chart.bar")

            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 12) {
                MetricCard(
                    title: "Lotes",
                    value: "\(productor.totalLotes ?? 0)",
                    icon: "map",
                    color: .green
                )

                if let fechaRegistro = productor.fechaRegistro {
                    MetricCard(
                        title: "Antigüedad",
                        value: daysAgoString(fechaRegistro),
                        icon: "clock",
                        color: .blue
                    )
                }
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

// MARK: - ProductorActionButtonsSection
struct ProductorActionButtonsSection: View {
    let onEdit: () -> Void
    let onDelete: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            // Botón Editar
            Button(action: onEdit) {
                HStack {
                    Image(systemName: "pencil")
                        .font(.system(size: 16, weight: .semibold))

                    Text("Editar Productor")
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

                    Text("Eliminar Productor")
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

// MARK: - Preview
struct ProductorDetailView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationView {
            ProductorDetailView(productor: Productor(
                id: "1",
                nombre: "Juan Pérez García",
                email: "juan.perez@example.com",
                telefono: "+34 612 345 678",
                direccion: "Calle Principal 123, Piso 2",
                ubicacion: "Valle Central",
                documentoIdentidad: "12345678A",
                tipoDocumento: .dni,
                totalLotes: 8,
                estado: .activo,
                fechaRegistro: Date().addingTimeInterval(-86400 * 180),
                metadata: ProductorMetadata(
                    certificaciones: ["Orgánico", "Fair Trade"],
                    experienciaAnos: 15,
                    especialidades: ["Aguacate", "Café"],
                    notas: "Productor con amplia experiencia en cultivos orgánicos certificados.",
                    avatar: nil
                )
            ))
        }
    }
}
