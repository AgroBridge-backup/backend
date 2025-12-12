import SwiftUI

// MARK: - ProductorCard
/// Card component para mostrar información resumida de un productor
struct ProductorCard: View {
    let productor: Productor

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header con nombre y estado
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(productor.nombre)
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(.primary)

                    if let email = productor.email {
                        HStack(spacing: 4) {
                            Image(systemName: "envelope.fill")
                                .font(.system(size: 12))
                                .foregroundColor(.secondary)

                            Text(email)
                                .font(.system(size: 14, weight: .regular))
                                .foregroundColor(.secondary)
                        }
                    }
                }

                Spacer()

                // Estado badge
                HStack(spacing: 6) {
                    Image(systemName: productor.estado.icon)
                        .font(.system(size: 12))
                        .foregroundColor(colorForEstado(productor.estado))

                    Text(productor.estado.displayName)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(colorForEstado(productor.estado))
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(colorForEstado(productor.estado).opacity(0.15))
                .cornerRadius(8)
            }

            // Divider
            Divider()

            // Información adicional
            HStack(spacing: 20) {
                // Ubicación
                if let ubicacion = productor.ubicacion {
                    HStack(spacing: 6) {
                        Image(systemName: "location.fill")
                            .font(.system(size: 14))
                            .foregroundColor(.blue)

                        Text(ubicacion)
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(.secondary)
                    }
                }

                Spacer()

                // Total de lotes
                if let totalLotes = productor.totalLotes {
                    HStack(spacing: 6) {
                        Image(systemName: "map.fill")
                            .font(.system(size: 14))
                            .foregroundColor(.green)

                        Text("\(totalLotes) lote\(totalLotes == 1 ? "" : "s")")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(.primary)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Color.green.opacity(0.1))
                    .cornerRadius(6)
                }
            }

            // Teléfono si existe
            if let telefono = productor.telefono {
                HStack(spacing: 6) {
                    Image(systemName: "phone.fill")
                        .font(.system(size: 12))
                        .foregroundColor(.agrobridgePrimary)

                    Text(telefono)
                        .font(.system(size: 14, weight: .medium))
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
    private func colorForEstado(_ estado: ProductorEstado) -> Color {
        switch estado {
        case .activo: return .green
        case .inactivo: return .gray
        case .suspendido: return .red
        }
    }
}

// MARK: - Preview
struct ProductorCard_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 16) {
            ProductorCard(productor: Productor(
                id: "1",
                nombre: "Juan Pérez García",
                email: "juan.perez@example.com",
                telefono: "+34 612 345 678",
                direccion: "Calle Principal 123",
                ubicacion: "Valle Central",
                documentoIdentidad: "12345678A",
                tipoDocumento: .dni,
                totalLotes: 5,
                estado: .activo,
                fechaRegistro: Date(),
                metadata: nil
            ))

            ProductorCard(productor: Productor(
                id: "2",
                nombre: "María López",
                email: "maria.lopez@example.com",
                telefono: nil,
                direccion: nil,
                ubicacion: "Región Norte",
                documentoIdentidad: nil,
                tipoDocumento: nil,
                totalLotes: 12,
                estado: .inactivo,
                fechaRegistro: Date(),
                metadata: nil
            ))
        }
        .padding()
        .background(Color.secondaryBackground)
    }
}
