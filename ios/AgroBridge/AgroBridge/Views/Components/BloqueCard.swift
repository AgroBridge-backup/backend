import SwiftUI

// MARK: - BloqueCard
/// Card component para mostrar información resumida de un bloque
struct BloqueCard: View {
    let bloque: Bloque

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header con nombre y estado
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(bloque.nombre)
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(.primary)

                    if let descripcion = bloque.descripcion, !descripcion.isEmpty {
                        Text(descripcion)
                            .font(.system(size: 14, weight: .regular))
                            .foregroundColor(.secondary)
                            .lineLimit(2)
                    }
                }

                Spacer()

                // Estado badge
                VStack(spacing: 4) {
                    Image(systemName: bloque.estado.icon)
                        .font(.system(size: 16))
                        .foregroundColor(colorForEstado(bloque.estado))

                    Text(bloque.estado.displayName)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(colorForEstado(bloque.estado))
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
                .background(colorForEstado(bloque.estado).opacity(0.15))
                .cornerRadius(8)
            }

            // Divider
            Divider()

            // Información adicional
            HStack(spacing: 16) {
                // Certificación
                if bloque.certificado {
                    HStack(spacing: 6) {
                        Image(systemName: "checkmark.seal.fill")
                            .font(.system(size: 14))
                            .foregroundColor(.green)

                        Text("Certificado")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(.green)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.green.opacity(0.15))
                    .cornerRadius(6)
                }

                Spacer()

                // Fecha de creación
                HStack(spacing: 4) {
                    Image(systemName: "calendar")
                        .font(.system(size: 12))
                        .foregroundColor(.secondary)

                    Text(bloque.fechaCreacion.toShortString())
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.secondary)
                }
            }

            // Total de lotes si existe
            if let loteIds = bloque.loteIds, !loteIds.isEmpty {
                HStack(spacing: 6) {
                    Image(systemName: "map.fill")
                        .font(.system(size: 12))
                        .foregroundColor(.blue)

                    Text("\(loteIds.count) lote\(loteIds.count == 1 ? "" : "s") asociado\(loteIds.count == 1 ? "" : "s")")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(.secondary)
                }
            }

            // Calidad promedio si existe
            if let metadata = bloque.metadata,
               let calidadPromedio = metadata.calidadPromedio {
                HStack(spacing: 6) {
                    Image(systemName: "star.fill")
                        .font(.system(size: 12))
                        .foregroundColor(.orange)

                    Text("Calidad: \(String(format: "%.1f", calidadPromedio))%")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(16)
        .background(Color.cardBackground)
        .cornerRadius(12)
        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
    }

    // MARK: - Helper Functions
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

// MARK: - Preview
struct BloqueCard_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 16) {
            BloqueCard(bloque: Bloque(
                id: "1",
                nombre: "Bloque Aguacate 2024 - Q1",
                descripcion: "Producción de aguacate orgánico certificado para exportación",
                productorId: "prod1",
                loteIds: ["lote1", "lote2", "lote3"],
                estado: .certificado,
                certificado: true,
                fechaCreacion: Date().addingTimeInterval(-86400 * 45),
                fechaActualizacion: Date(),
                fechaCertificacion: Date().addingTimeInterval(-86400 * 10),
                metadata: BloqueMetadata(
                    blockchainHash: "0x1234567890abcdef",
                    certificaciones: nil,
                    auditorias: nil,
                    calidadPromedio: 92.5,
                    totalKilosProducidos: 5000.0,
                    documentos: nil,
                    notas: nil
                )
            ))

            BloqueCard(bloque: Bloque(
                id: "2",
                nombre: "Bloque Café Especial",
                descripcion: "Café de altura premium",
                productorId: "prod2",
                loteIds: ["lote4", "lote5"],
                estado: .enCertificacion,
                certificado: false,
                fechaCreacion: Date().addingTimeInterval(-86400 * 20),
                fechaActualizacion: Date(),
                fechaCertificacion: nil,
                metadata: nil
            ))
        }
        .padding()
        .background(Color.secondaryBackground)
    }
}
