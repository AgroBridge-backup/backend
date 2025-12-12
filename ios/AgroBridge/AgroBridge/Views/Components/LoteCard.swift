import SwiftUI

// MARK: - LoteCard
/// Card para mostrar un lote en la lista
struct LoteCard: View {
    let lote: Lote

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header: Nombre y Estado
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(lote.nombre)
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(.primary)

                    Text(lote.tipoCultivo)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.secondary)
                }

                Spacer()

                // Badge de estado
                EstadoBadge(estado: lote.estado)
            }

            // Información secundaria
            VStack(alignment: .leading, spacing: 8) {
                InfoRow(
                    icon: "location.fill",
                    text: lote.ubicacion,
                    color: .blue
                )

                if let area = lote.areaHectareas {
                    InfoRow(
                        icon: "ruler",
                        text: String(format: "%.1f hectáreas", area),
                        color: .green
                    )
                }

                InfoRow(
                    icon: "calendar",
                    text: lote.fechaCreacion.toStandardString(),
                    color: .orange
                )
            }
        }
        .padding(16)
        .background(Color.cardBackground)
        .cornerRadius(12)
        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
    }
}

// MARK: - EstadoBadge
struct EstadoBadge: View {
    let estado: LoteEstado

    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(colorForEstado(estado))
                .frame(width: 8, height: 8)

            Text(estado.displayName)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(colorForEstado(estado))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(colorForEstado(estado).opacity(0.15))
        .cornerRadius(12)
    }

    private func colorForEstado(_ estado: LoteEstado) -> Color {
        switch estado {
        case .activo:
            return .green
        case .inactivo:
            return .gray
        case .enCosecha:
            return .orange
        case .cosechado:
            return .blue
        }
    }
}

// MARK: - InfoRow (Reutilizable)
struct InfoRow: View {
    let icon: String
    let text: String
    let color: Color

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundColor(color)
                .frame(width: 20)

            Text(text)
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(.secondary)
        }
    }
}

// MARK: - Preview
struct LoteCard_Previews: PreviewProvider {
    static var previews: some View {
        VStack {
            LoteCard(lote: Lote(
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

            LoteCard(lote: Lote(
                id: "2",
                nombre: "Lote Sur",
                ubicacion: "Región Costera",
                tipoCultivo: "Fresa",
                areaHectareas: 2.3,
                fechaCreacion: Date().addingTimeInterval(-86400 * 30),
                estado: .enCosecha,
                productorId: "prod2",
                bloqueId: nil,
                metadata: nil
            ))
        }
        .padding()
        .previewLayout(.sizeThatFits)
    }
}
