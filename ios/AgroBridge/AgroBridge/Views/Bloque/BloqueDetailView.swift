import SwiftUI

// MARK: - BloqueDetailView
/// Vista de detalle de un bloque
struct BloqueDetailView: View {
    // MARK: - Properties
    @StateObject private var viewModel: BloqueDetailViewModel
    @Environment(\.dismiss) var dismiss
    @State private var showQRCode = false
    @State private var showingShareSheet = false
    @State private var pdfURL: URL?

    // MARK: - Inicialización
    init(bloque: Bloque) {
        _viewModel = StateObject(wrappedValue: BloqueDetailViewModel(bloque: bloque))
    }

    var body: some View {
        ZStack {
            Color.secondaryBackground
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 20) {
                    // Header con nombre y estado
                    BloqueHeaderCard(bloque: viewModel.bloque)
                        .padding(.horizontal)

                    // Información principal
                    BloqueInfoSection(bloque: viewModel.bloque)
                        .padding(.horizontal)

                    // Estadísticas
                    if let stats = viewModel.stats {
                        BloqueStatsSection(stats: stats)
                            .padding(.horizontal)
                    }

                    // Lotes asociados
                    if let loteIds = viewModel.bloque.loteIds, !loteIds.isEmpty {
                        LotesAsociadosSection(loteIds: loteIds)
                            .padding(.horizontal)
                    }

                    // Certificaciones
                    if let metadata = viewModel.bloque.metadata,
                       let certificaciones = metadata.certificaciones,
                       !certificaciones.isEmpty {
                        CertificacionesSection(certificaciones: certificaciones)
                            .padding(.horizontal)
                    }

                    // Blockchain info
                    if let metadata = viewModel.bloque.metadata,
                       let blockchainHash = metadata.blockchainHash {
                        BlockchainSection(hash: blockchainHash)
                            .padding(.horizontal)
                    }

                    // Notas
                    if let metadata = viewModel.bloque.metadata,
                       let notas = metadata.notas,
                       !notas.isEmpty {
                        NotasSection(notas: notas)
                            .padding(.horizontal)
                    }

                    // Código QR
                    QRCodeSection(onShowQR: {
                        showQRCode = true
                    })
                    .padding(.horizontal)

                    // Botones de acción
                    BloqueActionButtonsSection(
                        bloque: viewModel.bloque,
                        onEdit: {
                            viewModel.showEditBloque = true
                        },
                        onDelete: {
                            viewModel.confirmDelete()
                        },
                        onGenerateCertificate: {
                            generateCertificatePDF()
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
        .navigationTitle("Detalle del Bloque")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $viewModel.showEditBloque) {
            EditBloqueView(bloque: viewModel.bloque)
        }
        .sheet(isPresented: $showQRCode) {
            QRCodeModalView(bloque: viewModel.bloque)
        }
        .alert("Eliminar Bloque", isPresented: $viewModel.showDeleteConfirmation) {
            Button("Cancelar", role: .cancel) {}
            Button("Eliminar", role: .destructive) {
                Task {
                    let success = await viewModel.deleteBloque()
                    if success {
                        dismiss()
                    }
                }
            }
        } message: {
            Text("¿Estás seguro de que deseas eliminar el bloque \"\(viewModel.bloque.nombre)\"? Esta acción no se puede deshacer.")
        }
        .alert("Error", isPresented: $viewModel.showError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(viewModel.errorMessage ?? "Ha ocurrido un error")
        }
        .sheet(isPresented: $showingShareSheet) {
            if let url = pdfURL {
                ShareSheet(items: [url])
            }
        }
        .task {
            await viewModel.loadStats()
        }
    }

    // MARK: - PDF Generation
    /// Genera certificado PDF y muestra sheet para compartir
    private func generateCertificatePDF() {
        print("📄 Generando certificado PDF para bloque: \(viewModel.bloque.nombre)")

        // Generar PDF
        let pdfData = PDFGenerator.shared.generateBloqueCertificate(bloque: viewModel.bloque)

        // Guardar en archivo temporal
        let filename = "certificado_bloque_\(viewModel.bloque.nombre.replacingOccurrences(of: " ", with: "_"))_\(Date().timeIntervalSince1970).pdf"
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(filename)

        do {
            try pdfData.write(to: tempURL)
            pdfURL = tempURL
            showingShareSheet = true
            print("✅ PDF guardado: \(tempURL.path)")
        } catch {
            print("❌ Error guardando PDF: \(error.localizedDescription)")
        }
    }
}

// MARK: - BloqueHeaderCard
struct BloqueHeaderCard: View {
    let bloque: Bloque

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                VStack(alignment: .leading, spacing: 8) {
                    Text(bloque.nombre)
                        .font(.system(size: 28, weight: .bold))
                        .foregroundColor(.primary)

                    if let descripcion = bloque.descripcion, !descripcion.isEmpty {
                        Text(descripcion)
                            .font(.system(size: 16, weight: .medium))
                            .foregroundColor(.secondary)
                    }
                }

                Spacer()

                // Estado badge grande
                VStack(spacing: 4) {
                    Image(systemName: bloque.estado.icon)
                        .font(.system(size: 20))
                        .foregroundColor(colorForEstado(bloque.estado))

                    Text(bloque.estado.displayName)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(colorForEstado(bloque.estado))
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(colorForEstado(bloque.estado).opacity(0.15))
                .cornerRadius(10)
            }

            // Certificación badge
            if bloque.certificado {
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.system(size: 16))
                        .foregroundColor(.green)

                    Text("Bloque Certificado")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(.green)

                    if let fechaCert = bloque.fechaCertificacion {
                        Text("• \(fechaCert.toShortString())")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(.secondary)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color.green.opacity(0.15))
                .cornerRadius(8)
            }
        }
        .padding(20)
        .background(Color.cardBackground)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
    }

    private func colorForEstado(_ estado: BloqueEstado) -> Color {
        switch estado {
        case .enPreparacion: return .gray
        case .activo: return .blue
        case .enCertificacion: return .orange
        case .certificado: return .green
        case .finalizado: return .purple
        case .rechazado: return .red
        }
    }
}

// MARK: - BloqueInfoSection
struct BloqueInfoSection: View {
    let bloque: Bloque

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Información", icon: "info.circle")

            VStack(spacing: 12) {
                DetailInfoRow(
                    icon: "calendar",
                    title: "Fecha de Creación",
                    value: bloque.fechaCreacion.toStandardString(),
                    color: .blue
                )

                if let fechaActualizacion = bloque.fechaActualizacion {
                    DetailInfoRow(
                        icon: "clock",
                        title: "Última Actualización",
                        value: fechaActualizacion.toStandardString(),
                        color: .orange
                    )
                }

                DetailInfoRow(
                    icon: "tag",
                    title: "ID del Bloque",
                    value: bloque.id,
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

// MARK: - BloqueStatsSection
struct BloqueStatsSection: View {
    let stats: BloqueStats

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Estadísticas", icon: "chart.bar")

            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 12) {
                MetricCard(
                    title: "Lotes Totales",
                    value: "\(stats.totalLotes)",
                    icon: "map",
                    color: .blue
                )

                MetricCard(
                    title: "Lotes Activos",
                    value: "\(stats.lotesActivos)",
                    icon: "checkmark.circle",
                    color: .green
                )

                if let totalKilos = stats.totalKilos {
                    MetricCard(
                        title: "Producción",
                        value: String(format: "%.0f kg", totalKilos),
                        icon: "scalemass",
                        color: .orange
                    )
                }

                if let calidad = stats.calidadPromedio {
                    MetricCard(
                        title: "Calidad",
                        value: String(format: "%.1f%%", calidad),
                        icon: "star.fill",
                        color: .yellow
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

// MARK: - LotesAsociadosSection
struct LotesAsociadosSection: View {
    let loteIds: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Lotes Asociados", icon: "map.fill")

            VStack(spacing: 8) {
                ForEach(loteIds, id: \.self) { loteId in
                    HStack {
                        Image(systemName: "map.circle.fill")
                            .font(.system(size: 14))
                            .foregroundColor(.blue)

                        Text("Lote ID: \(loteId)")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(.primary)

                        Spacer()

                        Image(systemName: "chevron.right")
                            .font(.system(size: 12))
                            .foregroundColor(.secondary)
                    }
                    .padding(12)
                    .background(Color(.systemGray6).opacity(0.5))
                    .cornerRadius(8)
                }
            }
        }
        .padding(20)
        .background(Color.cardBackground)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
    }
}

// MARK: - CertificacionesSection
struct CertificacionesSection: View {
    let certificaciones: [CertificacionInfo]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Certificaciones", icon: "checkmark.seal")

            VStack(spacing: 12) {
                ForEach(Array(certificaciones.enumerated()), id: \.offset) { _, cert in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Image(systemName: "checkmark.seal.fill")
                                .foregroundColor(.green)

                            Text(cert.tipo)
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundColor(.primary)

                            Spacer()
                        }

                        Text(cert.entidadCertificadora)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(.secondary)

                        if let numero = cert.numeroRegistro {
                            Text("Registro: \(numero)")
                                .font(.system(size: 12))
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(12)
                    .background(Color.green.opacity(0.1))
                    .cornerRadius(8)
                }
            }
        }
        .padding(20)
        .background(Color.cardBackground)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
    }
}

// MARK: - BlockchainSection
struct BlockchainSection: View {
    let hash: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Blockchain", icon: "link.circle")

            HStack(spacing: 12) {
                Image(systemName: "cube.transparent")
                    .font(.system(size: 20))
                    .foregroundColor(.purple)

                VStack(alignment: .leading, spacing: 4) {
                    Text("Hash de Blockchain")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.secondary)

                    Text(hash)
                        .font(.system(size: 13, weight: .regular, design: .monospaced))
                        .foregroundColor(.primary)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
            }
            .padding(12)
            .background(Color.purple.opacity(0.1))
            .cornerRadius(8)
        }
        .padding(20)
        .background(Color.cardBackground)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
    }
}

// MARK: - QRCodeSection
struct QRCodeSection: View {
    let onShowQR: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Trazabilidad QR", icon: "qrcode")

            Button(action: onShowQR) {
                HStack {
                    Image(systemName: "qrcode.viewfinder")
                        .font(.system(size: 20))
                        .foregroundColor(.agrobridgePrimary)

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Ver Código QR")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(.primary)

                        Text("Genera código QR para verificación de trazabilidad")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(.secondary)
                    }

                    Spacer()

                    Image(systemName: "chevron.right")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.secondary)
                }
                .padding(16)
                .background(Color.agrobridgePrimary.opacity(0.1))
                .cornerRadius(12)
            }
            .buttonStyle(.plain)
        }
        .padding(20)
        .background(Color.cardBackground)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
    }
}

// MARK: - BloqueActionButtonsSection
struct BloqueActionButtonsSection: View {
    let bloque: Bloque
    let onEdit: () -> Void
    let onDelete: () -> Void
    let onGenerateCertificate: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            // Botón Generar Certificado (solo si está certificado)
            if bloque.certificado {
                Button(action: onGenerateCertificate) {
                    HStack {
                        Image(systemName: "doc.fill")
                            .font(.system(size: 16, weight: .semibold))

                        Text("Descargar Certificado PDF")
                            .font(.system(size: 17, weight: .semibold))
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                    .background(Color.green)
                    .cornerRadius(12)
                }
            }

            // Botón Editar
            Button(action: onEdit) {
                HStack {
                    Image(systemName: "pencil")
                        .font(.system(size: 16, weight: .semibold))

                    Text("Editar Bloque")
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

                    Text("Eliminar Bloque")
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
struct BloqueDetailView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationView {
            BloqueDetailView(bloque: Bloque(
                id: "1",
                nombre: "Bloque Aguacate Orgánico Q1-2024",
                descripcion: "Producción de aguacate orgánico certificado para exportación a mercados internacionales",
                productorId: "prod1",
                loteIds: ["lote1", "lote2", "lote3"],
                estado: .certificado,
                certificado: true,
                fechaCreacion: Date().addingTimeInterval(-86400 * 90),
                fechaActualizacion: Date(),
                fechaCertificacion: Date().addingTimeInterval(-86400 * 30),
                metadata: BloqueMetadata(
                    blockchainHash: "0x1a2b3c4d5e6f7g8h9i0j",
                    certificaciones: [
                        CertificacionInfo(
                            tipo: "Orgánico Internacional",
                            entidadCertificadora: "USDA Organic",
                            numeroRegistro: "ORG-2024-001234",
                            fechaEmision: Date().addingTimeInterval(-86400 * 30),
                            fechaVencimiento: Date().addingTimeInterval(86400 * 335),
                            estado: "Vigente"
                        )
                    ],
                    auditorias: nil,
                    calidadPromedio: 94.5,
                    totalKilosProducidos: 12500.0,
                    documentos: nil,
                    notas: "Bloque con certificación orgánica completa y trazabilidad blockchain implementada."
                )
            ))
        }
    }
}
