import Foundation
import Combine

// MARK: - SensoresViewModel
/// ViewModel para el dashboard de sensores IoT
@MainActor
class SensoresViewModel: ObservableObject {
    // MARK: - Published Properties
    @Published private(set) var sensores: [SensorData] = []
    @Published private(set) var resumen: ResumenSensores?
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?
    @Published var showError = false

    @Published var selectedTipoSensor: TipoSensor?
    @Published var showOnlyAlertas = false

    // MARK: - Computed Properties
    var filteredSensores: [SensorData] {
        var filtered = sensores

        // Filtrar por tipo de sensor
        if let tipo = selectedTipoSensor {
            filtered = filtered.filter { $0.tipoSensor == tipo }
        }

        // Filtrar solo alertas
        if showOnlyAlertas {
            filtered = filtered.filter { $0.estado != .normal }
        }

        return filtered.sorted { $0.timestamp > $1.timestamp }
    }

    var sensoresNormales: Int {
        sensores.filter { $0.estado == .normal }.count
    }

    var sensoresAdvertencia: Int {
        sensores.filter { $0.estado == .advertencia }.count
    }

    var sensoresCriticos: Int {
        sensores.filter { $0.estado == .critico }.count
    }

    var sensoresOffline: Int {
        sensores.filter { $0.estado == .offline }.count
    }

    // MARK: - Inicialización
    init() {
        // Cargar datos simulados
        loadSimulatedData()
    }

    // MARK: - Actions
    /// Carga datos simulados de sensores (para demo)
    func loadSimulatedData() {
        isLoading = true

        // Simular delay de red
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            self?.sensores = self?.generateSimulatedSensorData() ?? []
            self?.resumen = ResumenSensores(
                totalSensores: self?.sensores.count ?? 0,
                sensoresActivos: self?.sensores.filter { $0.estado != .offline }.count ?? 0,
                sensoresOffline: self?.sensoresOffline ?? 0,
                alertas: self?.sensores.filter { $0.estado == .advertencia || $0.estado == .critico }.count ?? 0
            )
            self?.isLoading = false
        }
    }

    /// Refresca los datos de sensores
    func refresh() async {
        isLoading = true

        // Simular delay
        try? await Task.sleep(nanoseconds: 800_000_000)

        loadSimulatedData()
    }

    /// Limpia filtros
    func clearFilters() {
        selectedTipoSensor = nil
        showOnlyAlertas = false
    }

    // MARK: - Private Methods
    private func generateSimulatedSensorData() -> [SensorData] {
        let tipos = TipoSensor.allCases
        var data: [SensorData] = []

        for (index, tipo) in tipos.enumerated() {
            let estado: EstadoSensor
            let valor: Double

            // Generar valores y estados realistas
            switch tipo {
            case .temperatura:
                valor = Double.random(in: 18...32)
                estado = valor > 30 ? .advertencia : (valor > 35 ? .critico : .normal)

            case .humedad:
                valor = Double.random(in: 40...90)
                estado = valor < 50 ? .advertencia : .normal

            case .humedadSuelo:
                valor = Double.random(in: 20...80)
                estado = valor < 30 ? .advertencia : (valor < 20 ? .critico : .normal)

            case .ph:
                valor = Double.random(in: 5.5...7.5)
                estado = (valor < 6.0 || valor > 7.0) ? .advertencia : .normal

            case .luminosidad:
                valor = Double.random(in: 10000...80000)
                estado = .normal

            case .precipitacion:
                valor = Double.random(in: 0...25)
                estado = valor > 20 ? .advertencia : .normal

            case .vientoVelocidad:
                valor = Double.random(in: 0...40)
                estado = valor > 30 ? .advertencia : .normal
            }

            let sensor = SensorData(
                id: "sensor_\(index + 1)",
                loteId: "lote_\((index % 3) + 1)",
                loteNombre: "Lote \(["Norte", "Sur", "Este"][index % 3])",
                tipoSensor: tipo,
                valor: valor,
                unidad: tipo.defaultUnit,
                timestamp: Date().addingTimeInterval(Double(-index * 300)),
                estado: index == 0 ? .advertencia : estado,
                ubicacion: UbicacionSensor(
                    latitud: 9.0 + Double.random(in: -0.1...0.1),
                    longitud: -79.5 + Double.random(in: -0.1...0.1),
                    altitud: 100 + Double.random(in: -20...20)
                )
            )

            data.append(sensor)
        }

        return data
    }
}
