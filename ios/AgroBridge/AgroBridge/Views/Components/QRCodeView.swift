import SwiftUI

// MARK: - QRCodeView
/// Vista para mostrar código QR de un bloque
struct QRCodeView: View {
    let bloque: Bloque
    let size: CGFloat
    let includeDetails: Bool

    @State private var qrImage: UIImage?
    @State private var showShareSheet = false

    init(bloque: Bloque, size: CGFloat = 300, includeDetails: Bool = true) {
        self.bloque = bloque
        self.size = size
        self.includeDetails = includeDetails
    }

    var body: some View {
        VStack(spacing: 20) {
            if let qrImage = qrImage {
                VStack(spacing: 16) {
                    // Código QR
                    Image(uiImage: qrImage)
                        .interpolation(.none)
                        .resizable()
                        .scaledToFit()
                        .frame(width: size, height: size)
                        .background(Color.white)
                        .cornerRadius(16)
                        .shadow(color: Color.black.opacity(0.1), radius: 10, x: 0, y: 5)

                    // Información del bloque
                    VStack(spacing: 8) {
                        Text(bloque.nombre)
                            .font(.system(size: 18, weight: .bold))
                            .foregroundColor(.primary)

                        HStack(spacing: 6) {
                            Image(systemName: bloque.estado.icon)
                                .font(.system(size: 14))
                                .foregroundColor(colorForEstado(bloque.estado))

                            Text(bloque.estado.displayName)
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(colorForEstado(bloque.estado))
                        }

                        if bloque.certificado {
                            HStack(spacing: 6) {
                                Image(systemName: "checkmark.seal.fill")
                                    .font(.system(size: 14))
                                    .foregroundColor(.green)

                                Text("Certificado")
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundColor(.green)
                            }
                        }
                    }

                    // Botón compartir
                    Button(action: {
                        showShareSheet = true
                    }) {
                        HStack {
                            Image(systemName: "square.and.arrow.up")
                                .font(.system(size: 16, weight: .semibold))

                            Text("Compartir QR")
                                .font(.system(size: 17, weight: .semibold))
                        }
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(Color.agrobridgePrimary)
                        .cornerRadius(12)
                    }
                    .padding(.top, 8)
                }
            } else {
                // Loading placeholder
                VStack(spacing: 12) {
                    ProgressView()
                        .scaleEffect(1.5)

                    Text("Generando código QR...")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.secondary)
                }
                .frame(width: size, height: size)
            }
        }
        .onAppear {
            generateQRCode()
        }
        .sheet(isPresented: $showShareSheet) {
            if let qrImage = qrImage {
                ShareSheet(items: [qrImage, "Bloque: \(bloque.nombre)\nID: \(bloque.id)"])
            }
        }
    }

    // MARK: - Private Methods
    private func generateQRCode() {
        DispatchQueue.global(qos: .userInitiated).async {
            let image = QRCodeGenerator.shared.generateShareableQRCode(
                bloque,
                includeDetails: includeDetails,
                size: CGSize(width: size * 3, height: size * 3) // 3x for better quality
            )

            DispatchQueue.main.async {
                self.qrImage = image
            }
        }
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

// MARK: - ShareSheet
/// Vista para compartir contenido
struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(activityItems: items, applicationActivities: nil)
        return controller
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

// MARK: - QRCodeModalView
/// Vista modal completa para mostrar QR Code
struct QRCodeModalView: View {
    let bloque: Bloque
    @Environment(\.dismiss) var dismiss

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
                                Image(systemName: "qrcode")
                                    .font(.system(size: 32))
                                    .foregroundColor(.agrobridgePrimary)

                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Código QR")
                                        .font(.system(size: 24, weight: .bold))

                                    Text("Escanea para verificar trazabilidad")
                                        .font(.system(size: 14, weight: .medium))
                                        .foregroundColor(.secondary)
                                }

                                Spacer()
                            }
                        }
                        .padding(.horizontal)
                        .padding(.top)

                        // QR Code
                        QRCodeView(bloque: bloque, size: 280, includeDetails: true)
                            .padding(.horizontal)

                        // Información adicional
                        VStack(alignment: .leading, spacing: 12) {
                            SectionHeader(title: "Información de Verificación", icon: "info.circle")

                            VStack(spacing: 12) {
                                InfoRowQR(
                                    icon: "tag",
                                    title: "ID del Bloque",
                                    value: bloque.id
                                )

                                InfoRowQR(
                                    icon: "calendar",
                                    title: "Fecha de Creación",
                                    value: bloque.fechaCreacion.toStandardString()
                                )

                                if let hash = bloque.metadata?.blockchainHash {
                                    InfoRowQR(
                                        icon: "link.circle",
                                        title: "Hash Blockchain",
                                        value: String(hash.prefix(16)) + "..."
                                    )
                                }
                            }
                        }
                        .padding(20)
                        .background(Color.cardBackground)
                        .cornerRadius(16)
                        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
                        .padding(.horizontal)
                        .padding(.bottom)
                    }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Cerrar") {
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - InfoRowQR
struct InfoRowQR: View {
    let icon: String
    let title: String
    let value: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundColor(.agrobridgePrimary)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(.secondary)

                Text(value)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.primary)
                    .lineLimit(1)
            }

            Spacer()
        }
        .padding(12)
        .background(Color(.systemGray6).opacity(0.5))
        .cornerRadius(8)
    }
}

// MARK: - Preview
struct QRCodeView_Previews: PreviewProvider {
    static var previews: some View {
        VStack {
            QRCodeView(bloque: Bloque(
                id: "BLQ-2024-001",
                nombre: "Bloque Aguacate Orgánico",
                descripcion: "Producción certificada",
                productorId: "prod1",
                loteIds: ["lote1", "lote2"],
                estado: .certificado,
                certificado: true,
                fechaCreacion: Date(),
                fechaActualizacion: nil,
                fechaCertificacion: Date(),
                metadata: BloqueMetadata(
                    blockchainHash: "0x1a2b3c4d5e6f7g8h9i0j",
                    certificaciones: nil,
                    auditorias: nil,
                    calidadPromedio: nil,
                    totalKilosProducidos: nil,
                    documentos: nil,
                    notas: nil
                )
            ), size: 250)

            Spacer()
        }
        .padding()
        .background(Color.secondaryBackground)
    }
}
