import SwiftUI

// MARK: - SensoresView
/// Dashboard de sensores IoT
struct SensoresView: View {
    // MARK: - Properties
    @StateObject private var viewModel = SensoresViewModel()
    @State private var showFilters = false

    var body: some View {
        NavigationView {
            ZStack {
                Color.secondaryBackground
                    .ignoresSafeArea()

                if viewModel.isLoading && viewModel.sensores.isEmpty {
                    LoadingView(message: "Cargando sensores...")
                } else {
                    ScrollView {
                        VStack(spacing: 20) {
                            // Resumen de estado
                            if let resumen = viewModel.resumen {
                                SensoresResumenCard(resumen: resumen)
                                    .padding(.horizontal)
                            }

                            // Indicadores de estado
                            EstadoSensoresGrid(viewModel: viewModel)
                                .padding(.horizontal)

                            // Header de filtros
                            if viewModel.selectedTipoSensor != nil || viewModel.showOnlyAlertas {
                                ActiveSensorFiltersHeader(
                                    count: viewModel.filteredSensores.count,
                                    onClear: {
                                        viewModel.clearFilters()
                                    }
                                )
                                .padding(.horizontal)
                            }

                            // Lista de sensores
                            if viewModel.filteredSensores.isEmpty {
                                EmptyStateView(
                                    icon: "sensor",
                                    title: "No hay sensores",
                                    message: "No se encontraron sensores con los filtros aplicados.",
                                    actionTitle: "Limpiar Filtros",
                                    action: {
                                        viewModel.clearFilters()
                                    }
                                )
                                .padding()
                            } else {
                                LazyVStack(spacing: 12) {
                                    ForEach(viewModel.filteredSensores) { sensor in
                                        SensorCard(sensor: sensor)
                                            .padding(.horizontal)
                                    }
                                }
                            }
                        }
                        .padding(.vertical)
                    }
                    .refreshable {
                        await viewModel.refresh()
                    }
                }
            }
            .navigationTitle("Sensores IoT")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: {
                        showFilters = true
                    }) {
                        Image(systemName: "slider.horizontal.3")
                            .foregroundColor(.agrobridgePrimary)
                    }
                }
            }
        }
        .sheet(isPresented: $showFilters) {
            SensoresFilterSheet(viewModel: viewModel)
        }
        .alert("Error", isPresented: $viewModel.showError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(viewModel.errorMessage ?? "Ha ocurrido un error")
        }
    }
}

// MARK: - SensoresResumenCard
struct SensoresResumenCard: View {
    let resumen: ResumenSensores

    var body: some View {
        VStack(spacing: 16) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Estado de Sensores")
                        .font(.system(size: 20, weight: .bold))

                    Text("\(resumen.totalSensores) sensores en total")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.secondary)
                }

                Spacer()

                Image(systemName: "antenna.radiowaves.left.and.right")
                    .font(.system(size: 28))
                    .foregroundColor(.agrobridgePrimary)
            }

            Divider()

            HStack(spacing: 20) {
                ResumenMetric(
                    value: "\(resumen.sensoresActivos)",
                    label: "Activos",
                    color: .green
                )

                Divider()
                    .frame(height: 40)

                ResumenMetric(
                    value: "\(resumen.alertas)",
                    label: "Alertas",
                    color: .orange
                )

                Divider()
                    .frame(height: 40)

                ResumenMetric(
                    value: "\(resumen.sensoresOffline)",
                    label: "Offline",
                    color: .gray
                )
            }
        }
        .padding(20)
        .background(Color.cardBackground)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
    }
}

struct ResumenMetric: View {
    let value: String
    let label: String
    let color: Color

    var body: some View {
        VStack(spacing: 6) {
            Text(value)
                .font(.system(size: 24, weight: .bold))
                .foregroundColor(color)

            Text(label)
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - EstadoSensoresGrid
struct EstadoSensoresGrid: View {
    @ObservedObject var viewModel: SensoresViewModel

    var body: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 12) {
            EstadoCard(
                count: viewModel.sensoresNormales,
                label: "Normal",
                icon: "checkmark.circle.fill",
                color: .green
            )

            EstadoCard(
                count: viewModel.sensoresAdvertencia,
                label: "Advertencia",
                icon: "exclamationmark.triangle.fill",
                color: .orange
            )

            EstadoCard(
                count: viewModel.sensoresCriticos,
                label: "Críticos",
                icon: "xmark.octagon.fill",
                color: .red
            )

            EstadoCard(
                count: viewModel.sensoresOffline,
                label: "Sin Conexión",
                icon: "wifi.slash",
                color: .gray
            )
        }
    }
}

struct EstadoCard: View {
    let count: Int
    let label: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 24))
                .foregroundColor(color)

            Text("\(count)")
                .font(.system(size: 28, weight: .bold))
                .foregroundColor(.primary)

            Text(label)
                .font(.system(size: 13, weight: .medium))
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .background(color.opacity(0.1))
        .cornerRadius(12)
    }
}

// MARK: - SensorCard
struct SensorCard: View {
    let sensor: SensorData

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                Image(systemName: sensor.tipoSensor.icon)
                    .font(.system(size: 20))
                    .foregroundColor(.agrobridgePrimary)

                VStack(alignment: .leading, spacing: 2) {
                    Text(sensor.tipoSensor.displayName)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.primary)

                    if let loteNombre = sensor.loteNombre {
                        Text(loteNombre)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(.secondary)
                    }
                }

                Spacer()

                // Estado badge
                HStack(spacing: 4) {
                    Circle()
                        .fill(colorForEstado(sensor.estado))
                        .frame(width: 8, height: 8)

                    Text(sensor.estado.displayName)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(colorForEstado(sensor.estado))
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(colorForEstado(sensor.estado).opacity(0.15))
                .cornerRadius(6)
            }

            Divider()

            // Valor y timestamp
            HStack(alignment: .bottom, spacing: 8) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Lectura Actual")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(.secondary)

                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text(String(format: "%.1f", sensor.valor))
                            .font(.system(size: 28, weight: .bold))
                            .foregroundColor(.primary)

                        Text(sensor.unidad)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(.secondary)
                    }
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 2) {
                    Text("Actualizado")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(.secondary)

                    Text(sensor.timestamp.toRelativeString())
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(16)
        .background(Color.cardBackground)
        .cornerRadius(12)
        .shadow(color: Color.black.opacity(0.05), radius: 6, x: 0, y: 3)
    }

    private func colorForEstado(_ estado: EstadoSensor) -> Color {
        switch estado {
        case .normal: return .green
        case .advertencia: return .orange
        case .critico: return .red
        case .offline: return .gray
        }
    }
}

// MARK: - ActiveSensorFiltersHeader
struct ActiveSensorFiltersHeader: View {
    let count: Int
    let onClear: () -> Void

    var body: some View {
        HStack {
            HStack(spacing: 6) {
                Image(systemName: "line.3.horizontal.decrease.circle.fill")
                    .font(.system(size: 14))
                    .foregroundColor(.agrobridgePrimary)

                Text("\(count) sensor\(count == 1 ? "" : "es")")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.secondary)
            }

            Spacer()

            Button(action: onClear) {
                Text("Limpiar")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.agrobridgePrimary)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color.agrobridgePrimary.opacity(0.1))
        .cornerRadius(10)
    }
}

// MARK: - SensoresFilterSheet
struct SensoresFilterSheet: View {
    @ObservedObject var viewModel: SensoresViewModel
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("Tipo de Sensor")) {
                    ForEach([nil] + TipoSensor.allCases.map { $0 as TipoSensor? }, id: \.self) { tipo in
                        Button(action: {
                            viewModel.selectedTipoSensor = tipo
                        }) {
                            HStack {
                                if let tipo = tipo {
                                    Image(systemName: tipo.icon)
                                        .foregroundColor(.agrobridgePrimary)
                                        .frame(width: 24)

                                    Text(tipo.displayName)
                                        .foregroundColor(.primary)
                                } else {
                                    Text("Todos")
                                        .foregroundColor(.primary)
                                        .padding(.leading, 32)
                                }

                                Spacer()

                                if viewModel.selectedTipoSensor == tipo {
                                    Image(systemName: "checkmark")
                                        .foregroundColor(.agrobridgePrimary)
                                }
                            }
                        }
                    }
                }

                Section(header: Text("Estado")) {
                    Toggle(isOn: $viewModel.showOnlyAlertas) {
                        HStack {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(.orange)
                                .frame(width: 24)

                            Text("Solo Alertas")
                                .foregroundColor(.primary)
                        }
                    }
                    .tint(.agrobridgePrimary)
                }

                Section {
                    Button(action: {
                        viewModel.clearFilters()
                        dismiss()
                    }) {
                        HStack {
                            Spacer()
                            Text("Limpiar Filtros")
                                .foregroundColor(.red)
                            Spacer()
                        }
                    }
                }
            }
            .navigationTitle("Filtros")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Listo") {
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Date Extension
extension Date {
    func toRelativeString() -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: self, relativeTo: Date())
    }
}

// MARK: - Preview
struct SensoresView_Previews: PreviewProvider {
    static var previews: some View {
        SensoresView()
    }
}
